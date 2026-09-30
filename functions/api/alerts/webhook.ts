/**
 * POST /api/alerts/webhook – register user webhook or dispatch (auth).
 */

import {
  type Env,
  requireUser,
  cors,
  json,
  bad,
  readJsonBody,
} from '../auth/_shared'

function hookKey(userId: string) {
  return `alert:webhook:${userId}`
}

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)

  const auth = await requireUser(env, request)
  if (auth instanceof Response) return auth

  const bodyRes = await readJsonBody<{
    action?: string
    url?: string
    title?: string
    body?: string
  }>(request, 8_192)
  if (!bodyRes.ok) return bodyRes.response
  const { action, url, title, body } = bodyRes.data

  if (action === 'register') {
    const u = String(url || '').trim()
    if (!u) {
      await env.WORKSPACE_KV.delete(hookKey(auth.user.id))
      return json({ ok: true, cleared: true }, 200, request)
    }
    if (!/^https:\/\//i.test(u) || u.length > 500) {
      return bad('webhook must be https URL ≤500 chars', 400, request)
    }
    await env.WORKSPACE_KV.put(hookKey(auth.user.id), u)
    return json({ ok: true, registered: true }, 200, request)
  }

  if (action === 'dispatch') {
    const stored = await env.WORKSPACE_KV.get(hookKey(auth.user.id))
    if (!stored) return bad('no webhook registered', 400, request)
    const text = `${title || 'Alert'}\n${body || ''}`.slice(0, 3500)
    const isDiscord = /discord(?:app)?\.com\/api\/webhooks/i.test(stored)
    try {
      const res = await fetch(stored, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: isDiscord
          ? JSON.stringify({ content: text.slice(0, 1900) })
          : JSON.stringify({ text }),
      })
      return json(
        { ok: res.ok || res.status === 204, status: res.status },
        res.ok || res.status === 204 ? 200 : 502,
        request
      )
    } catch {
      return bad('webhook delivery failed', 502, request)
    }
  }

  return bad('action must be register|dispatch', 400, request)
}
