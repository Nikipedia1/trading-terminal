/**
 * POST /api/support/ticket – store support ticket in KV (no fake inbox).
 * Body: { email, subject, message, plan? }
 */

import {
  cors,
  json,
  bad,
  readJsonBody,
  checkRateLimit,
  clientIp,
  normalizeEmail,
  type Env,
} from '../auth/_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  if (!env.WORKSPACE_KV) {
    return bad('Support queue requires WORKSPACE_KV', 503, request)
  }

  const rl = await checkRateLimit(env.WORKSPACE_KV, `support:${clientIp(request)}`, 5, 3600)
  if (!rl.ok) {
    return json({ error: 'rate limit', retryAfterSec: rl.retryAfterSec }, 429, request, {
      'Retry-After': String(rl.retryAfterSec),
    })
  }

  const body = await readJsonBody<{
    email?: string
    subject?: string
    message?: string
    plan?: string
  }>(request, 8_000)
  if (!body.ok) return body.response

  const email = normalizeEmail(String(body.data.email ?? ''))
  if (!email) return bad('valid email required', 400, request)
  const subject = String(body.data.subject ?? '').trim().slice(0, 200)
  const message = String(body.data.message ?? '').trim().slice(0, 4000)
  if (subject.length < 3 || message.length < 10) {
    return bad('subject and message required', 400, request)
  }

  const id = crypto.randomUUID()
  const ticket = {
    id,
    email,
    subject,
    message,
    plan: String(body.data.plan ?? '').slice(0, 32),
    createdAt: Date.now(),
    status: 'open' as const,
    ip: clientIp(request),
  }
  await env.WORKSPACE_KV.put(`support:ticket:${id}`, JSON.stringify(ticket), {
    expirationTtl: 60 * 60 * 24 * 90,
  })
  // index recent
  const idxKey = 'support:tickets:recent'
  let recent: string[] = []
  try {
    recent = (await env.WORKSPACE_KV.get(idxKey, 'json')) as string[] || []
  } catch {
    recent = []
  }
  if (!Array.isArray(recent)) recent = []
  recent = [id, ...recent].slice(0, 200)
  await env.WORKSPACE_KV.put(idxKey, JSON.stringify(recent), {
    expirationTtl: 60 * 60 * 24 * 90,
  })

  return json(
    {
      ok: true,
      id,
      message: 'Ticket recorded. We will respond via email when support is staffed.',
    },
    201,
    request
  )
}
