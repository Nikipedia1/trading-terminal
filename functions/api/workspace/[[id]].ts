/**
 * Cloudflare Pages Function – workspace CRUD on KV.
 * Auth required for PUT/DELETE; GET requires owner match when meta exists.
 * Legacy workspaces without meta remain readable until claimed on next PUT.
 *
 * Routes:
 *   GET  /api/workspace/:id
 *   PUT  /api/workspace/:id   body: WorkspaceDocument JSON
 *   DELETE /api/workspace/:id
 */

import {
  type Env,
  requireUser,
  cors,
  extractToken,
  getSession,
  getUserById,
} from '../auth/_shared'

const MAX_BYTES = 900_000
const KEY_PREFIX = 'ws:'
const META_PREFIX = 'wsmeta:'

interface WorkspaceMeta {
  ownerId: string
  updatedAt: number
}

function json(data: unknown, status = 200, request: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors(request),
    },
  })
}

function bad(msg: string, status: number, request: Request): Response {
  return json({ error: msg }, status, request)
}

function parseId(
  context: EventContext<Env, 'id', Record<string, unknown>>
): string | null {
  const raw = context.params.id
  const id = Array.isArray(raw) ? raw.join('/') : raw
  if (!id || typeof id !== 'string') return null
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) return null
  return id
}

async function readMeta(
  kv: KVNamespace,
  id: string
): Promise<WorkspaceMeta | null> {
  const raw = await kv.get(META_PREFIX + id)
  if (!raw) return null
  try {
    return JSON.parse(raw) as WorkspaceMeta
  } catch {
    return null
  }
}

async function writeMeta(
  kv: KVNamespace,
  id: string,
  meta: WorkspaceMeta
): Promise<void> {
  await kv.put(META_PREFIX + id, JSON.stringify(meta))
}

async function optionalUserId(
  env: Env,
  request: Request
): Promise<{ userId: string; role: string } | null> {
  if (!env.WORKSPACE_KV) return null
  const token = extractToken(request)
  const sess = await getSession(env.WORKSPACE_KV, token)
  if (!sess || !token) return null
  const user = await getUserById(env.WORKSPACE_KV, sess.userId)
  if (!user || user.disabled) return null
  return { userId: user.id, role: user.role }
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: cors(context.request),
  })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = parseId(context)
  if (!id) return bad('invalid workspace id', 400, context.request)
  if (!context.env.WORKSPACE_KV) {
    return bad('WORKSPACE_KV not bound', 503, context.request)
  }

  const meta = await readMeta(context.env.WORKSPACE_KV, id)
  if (meta) {
    const auth = await optionalUserId(context.env, context.request)
    if (!auth) return bad('unauthorized', 401, context.request)
    if (auth.userId !== meta.ownerId && auth.role !== 'admin') {
      return bad('forbidden', 403, context.request)
    }
  }

  const raw = await context.env.WORKSPACE_KV.get(KEY_PREFIX + id)
  if (!raw) return bad('workspace not found', 404, context.request)

  return new Response(raw, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors(context.request),
    },
  })
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const id = parseId(context)
  if (!id) return bad('invalid workspace id', 400, context.request)
  if (!context.env.WORKSPACE_KV) {
    return bad('WORKSPACE_KV not bound', 503, context.request)
  }

  const auth = await requireUser(context.env, context.request)
  if (auth instanceof Response) return auth

  const meta = await readMeta(context.env.WORKSPACE_KV, id)
  if (meta && meta.ownerId !== auth.user.id && auth.user.role !== 'admin') {
    return bad('forbidden', 403, context.request)
  }

  let body: string
  try {
    body = await context.request.text()
  } catch {
    return bad('unreadable body', 400, context.request)
  }
  if (!body || body.length > MAX_BYTES) {
    return bad('body empty or too large', 400, context.request)
  }
  try {
    JSON.parse(body)
  } catch {
    return bad('invalid json', 400, context.request)
  }

  await context.env.WORKSPACE_KV.put(KEY_PREFIX + id, body)
  await writeMeta(context.env.WORKSPACE_KV, id, {
    ownerId: meta?.ownerId ?? auth.user.id,
    updatedAt: Date.now(),
  })

  return json({ ok: true, id }, 200, context.request)
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const id = parseId(context)
  if (!id) return bad('invalid workspace id', 400, context.request)
  if (!context.env.WORKSPACE_KV) {
    return bad('WORKSPACE_KV not bound', 503, context.request)
  }

  const auth = await requireUser(context.env, context.request)
  if (auth instanceof Response) return auth

  const meta = await readMeta(context.env.WORKSPACE_KV, id)
  if (meta && meta.ownerId !== auth.user.id && auth.user.role !== 'admin') {
    return bad('forbidden', 403, context.request)
  }

  await context.env.WORKSPACE_KV.delete(KEY_PREFIX + id)
  await context.env.WORKSPACE_KV.delete(META_PREFIX + id)
  return json({ ok: true }, 200, context.request)
}
