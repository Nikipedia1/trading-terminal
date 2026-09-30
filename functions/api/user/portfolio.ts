/**
 * Server-side backup of paper / bots slim state per authenticated user.
 */

import {
  type Env,
  bad,
  cors,
  json,
  requireUser,
} from '../auth/_shared'

const MAX_BYTES = 400_000

function portfolioKey(userId: string) {
  return `user:portfolio:${userId}`
}

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  const auth = await requireUser(env, request)
  if (auth instanceof Response) return auth
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)

  const raw = await env.WORKSPACE_KV.get(portfolioKey(auth.user.id))
  if (!raw) return json({ portfolio: null }, 200, request)
  try {
    return json({ portfolio: JSON.parse(raw) }, 200, request)
  } catch {
    return json({ portfolio: null }, 200, request)
  }
}

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  const auth = await requireUser(env, request)
  if (auth instanceof Response) return auth
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return bad('invalid json', 400, request)
  }
  const serialized = JSON.stringify(body)
  if (serialized.length > MAX_BYTES) return bad('payload too large', 413, request)

  await env.WORKSPACE_KV.put(portfolioKey(auth.user.id), serialized)
  return json({ ok: true }, 200, request)
}
