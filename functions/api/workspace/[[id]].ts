/**
 * Cloudflare Pages Function – workspace CRUD on KV.
 * Free tier: no auth beyond opaque workspace id (treat id as a secret link).
 *
 * Routes:
 *   GET  /api/workspace/:id
 *   PUT  /api/workspace/:id   body: WorkspaceDocument JSON
 *   DELETE /api/workspace/:id
 */

export interface Env {
  WORKSPACE_KV: KVNamespace
}

const MAX_BYTES = 900_000
const KEY_PREFIX = 'ws:'

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function json(data: unknown, status = 200, request: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request),
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

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(context.request),
  })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = parseId(context)
  if (!id) return bad('invalid workspace id', 400, context.request)
  if (!context.env.WORKSPACE_KV) {
    return bad(
      'WORKSPACE_KV not bound – create KV namespace and update wrangler.toml',
      503,
      context.request
    )
  }

  const raw = await context.env.WORKSPACE_KV.get(KEY_PREFIX + id)
  if (!raw) return bad('workspace not found', 404, context.request)

  return new Response(raw, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(context.request),
    },
  })
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const id = parseId(context)
  if (!id) return bad('invalid workspace id', 400, context.request)
  if (!context.env.WORKSPACE_KV) {
    return bad(
      'WORKSPACE_KV not bound – create KV namespace and update wrangler.toml',
      503,
      context.request
    )
  }

  let body: string
  try {
    body = await context.request.text()
  } catch {
    return bad('unreadable body', 400, context.request)
  }
  if (!body || body.length > MAX_BYTES) {
    return bad(`body missing or exceeds ${MAX_BYTES} bytes`, 413, context.request)
  }

  let parsed: { version?: number }
  try {
    parsed = JSON.parse(body)
  } catch {
    return bad('body must be JSON', 400, context.request)
  }
  if (parsed.version !== 1) {
    return bad('unsupported workspace version (expected 1)', 400, context.request)
  }

  const doc = {
    ...parsed,
    id,
    updatedAt: Date.now(),
  }
  const payload = JSON.stringify(doc)
  if (payload.length > MAX_BYTES) {
    return bad('workspace too large', 413, context.request)
  }

  await context.env.WORKSPACE_KV.put(KEY_PREFIX + id, payload)
  return json(
    { ok: true, id, updatedAt: doc.updatedAt, bytes: payload.length },
    200,
    context.request
  )
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const id = parseId(context)
  if (!id) return bad('invalid workspace id', 400, context.request)
  if (!context.env.WORKSPACE_KV) {
    return bad('WORKSPACE_KV not bound', 503, context.request)
  }
  await context.env.WORKSPACE_KV.delete(KEY_PREFIX + id)
  return json({ ok: true, id }, 200, context.request)
}
