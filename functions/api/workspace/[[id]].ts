/**
 * Cloudflare Pages Function – workspace CRUD on KV.
 * Auth required for GET / PUT / DELETE – workspace id is not a capability token.
 * Maintains user:ws:{userId} index for listing.
 */

import {
  type Env,
  requireUser,
  cors,
} from '../auth/_shared'

const MAX_BYTES = 900_000
const KEY_PREFIX = 'ws:'
const META_PREFIX = 'wsmeta:'
const USER_WS_PREFIX = 'user:ws:'

interface WorkspaceMeta {
  ownerId: string
  updatedAt: number
}

async function addUserWorkspace(kv: KVNamespace, userId: string, id: string) {
  const key = USER_WS_PREFIX + userId
  const raw = await kv.get(key)
  let ids: string[] = []
  try {
    ids = raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    ids = []
  }
  if (!ids.includes(id)) {
    ids.push(id)
    await kv.put(key, JSON.stringify(ids.slice(-50)))
  }
}

async function removeUserWorkspace(kv: KVNamespace, userId: string, id: string) {
  const key = USER_WS_PREFIX + userId
  const raw = await kv.get(key)
  if (!raw) return
  try {
    const ids = (JSON.parse(raw) as string[]).filter((x) => x !== id)
    await kv.put(key, JSON.stringify(ids))
  } catch {
    /* */
  }
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

  const auth = await requireUser(context.env, context.request)
  if (auth instanceof Response) return auth

  const meta = await readMeta(context.env.WORKSPACE_KV, id)
  if (meta && meta.ownerId !== auth.user.id && auth.user.role !== 'admin') {
    return bad('forbidden', 403, context.request)
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
  const ownerId = meta?.ownerId ?? auth.user.id
  await writeMeta(context.env.WORKSPACE_KV, id, {
    ownerId,
    updatedAt: Date.now(),
  })
  await addUserWorkspace(context.env.WORKSPACE_KV, ownerId, id)

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
  if (meta) await removeUserWorkspace(context.env.WORKSPACE_KV, meta.ownerId, id)
  else await removeUserWorkspace(context.env.WORKSPACE_KV, auth.user.id, id)
  return json({ ok: true }, 200, context.request)
}
