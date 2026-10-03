/**
 * Password reset – token stored in KV; email delivery is operator-configured.
 * Without SMTP, returns resetToken only when AUTH_DEV_RESET=1 (dev).
 */

import {
  type Env,
  bad,
  cors,
  json,
  normalizeEmail,
  validatePassword,
  hashPassword,
  getUserByEmail,
  saveUser,
  checkRateLimit,
  clientIp,
  readJsonBody,
} from './_shared'

interface ResetEnv extends Env {
  AUTH_DEV_RESET?: string
}

export const onRequestOptions: PagesFunction<ResetEnv> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestPost: PagesFunction<ResetEnv> = async (ctx) => {
  const { env, request } = ctx
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)

  const ip = clientIp(request)
  const rl = await checkRateLimit(env.WORKSPACE_KV, `pwreset:ip:${ip}`, 5, 3600)
  if (!rl.ok) return bad(`rate limit – retry in ${rl.retryAfterSec}s`, 429, request)

  const bodyRes = await readJsonBody<{
    action?: string
    email?: string
    token?: string
    password?: string
  }>(request)
  if (!bodyRes.ok) return bodyRes.response
  const body = bodyRes.data
  const action = String(body.action || 'request')

  if (action === 'request') {
    const email = normalizeEmail(String(body.email || ''))
    if (!email) return bad('invalid email', 400, request)
    const user = await getUserByEmail(env.WORKSPACE_KV, email)
    // Always generic response to avoid email enumeration
    if (!user || user.disabled) {
      return json({ ok: true, message: 'If the account exists, a reset was issued' }, 200, request)
    }
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    await env.WORKSPACE_KV.put(
      `auth:pwreset:${token}`,
      JSON.stringify({ userId: user.id, email, createdAt: Date.now() }),
      { expirationTtl: 3600 }
    )
    const payload: Record<string, unknown> = {
      ok: true,
      message: 'If the account exists, a reset was issued',
    }
    if (env.AUTH_DEV_RESET === '1') {
      payload.resetToken = token
    }
    return json(payload, 200, request)
  }

  if (action === 'confirm') {
    const token = String(body.token || '')
    const pwErr = validatePassword(String(body.password || ''))
    if (pwErr) return bad(pwErr, 400, request)
    const raw = await env.WORKSPACE_KV.get(`auth:pwreset:${token}`)
    if (!raw) return bad('invalid or expired token', 400, request)
    let rec: { userId: string; email: string }
    try {
      rec = JSON.parse(raw)
    } catch {
      return bad('invalid token', 400, request)
    }
    const user = await getUserByEmail(env.WORKSPACE_KV, rec.email)
    if (!user || user.id !== rec.userId) return bad('invalid token', 400, request)
    const { salt, passwordHash } = await hashPassword(String(body.password))
    user.salt = salt
    user.passwordHash = passwordHash
    user.updatedAt = Date.now()
    await saveUser(env.WORKSPACE_KV, user)
    await env.WORKSPACE_KV.delete(`auth:pwreset:${token}`)
    return json({ ok: true }, 200, request)
  }

  return bad('unknown action', 400, request)
}
