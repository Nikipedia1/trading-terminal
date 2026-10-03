/** List / revoke sessions for the current user (record keeping + security). */

import {
  type Env,
  bad,
  cors,
  json,
  requireUser,
  extractToken,
  sessionKey,
  destroySession,
  clientIp,
} from './_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  const auth = await requireUser(env, request)
  if (auth instanceof Response) return auth

  // KV list by prefix is expensive; store session index per user
  const idxKey = `auth:sessions:user:${auth.user.id}`
  const raw = await env.WORKSPACE_KV.get(idxKey)
  let sessions: { id: string; createdAt: number; current: boolean }[] = []
  try {
    const list = raw ? (JSON.parse(raw) as { token: string; createdAt: number }[]) : []
    const current = extractToken(request, env)
    sessions = list.map((s) => ({
      id: s.token.slice(0, 8) + '…',
      createdAt: s.createdAt,
      current: s.token === current,
    }))
  } catch {
    sessions = []
  }
  return json({ sessions }, 200, request)
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  const auth = await requireUser(env, request)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const all = url.searchParams.get('all') === '1'
  const idxKey = `auth:sessions:user:${auth.user.id}`
  const raw = await env.WORKSPACE_KV.get(idxKey)
  let list: { token: string; createdAt: number }[] = []
  try {
    list = raw ? (JSON.parse(raw) as { token: string; createdAt: number }[]) : []
  } catch {
    list = []
  }

  if (all) {
    for (const s of list) {
      await destroySession(env.WORKSPACE_KV, s.token)
    }
    await env.WORKSPACE_KV.put(idxKey, JSON.stringify([]))
    // also clear current cookie via client logout recommended
    return json({ ok: true, revoked: list.length, ip: clientIp(request) }, 200, request)
  }

  // revoke current only
  await destroySession(env.WORKSPACE_KV, auth.token)
  list = list.filter((s) => s.token !== auth.token)
  await env.WORKSPACE_KV.put(idxKey, JSON.stringify(list))
  return json({ ok: true, revoked: 1 }, 200, request)
}
