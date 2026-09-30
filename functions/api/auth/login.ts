import {
  type Env,
  bad,
  cors,
  json,
  normalizeEmail,
  validatePassword,
  verifyPassword,
  getUserByEmail,
  createSession,
  sessionCookie,
  publicUser,
  checkRateLimit,
  clientIp,
} from './_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)

  const ip = clientIp(request)
  const rl = await checkRateLimit(env.WORKSPACE_KV, `login:ip:${ip}`, 20, 60)
  if (!rl.ok) {
    return bad(`rate limit exceeded – retry in ${rl.retryAfterSec}s`, 429, request)
  }

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return bad('invalid json', 400, request)
  }

  const email = normalizeEmail(body.email || '')
  if (!email) return bad('invalid email', 400, request)
  const rlEmail = await checkRateLimit(env.WORKSPACE_KV, `login:email:${email}`, 10, 60)
  if (!rlEmail.ok) {
    return bad(`rate limit exceeded – retry in ${rlEmail.retryAfterSec}s`, 429, request)
  }
  const pwErr = validatePassword(body.password || '')
  if (pwErr) return bad('invalid credentials', 401, request)

  const user = await getUserByEmail(env.WORKSPACE_KV, email)
  if (!user || user.disabled) return bad('invalid credentials', 401, request)

  const ok = await verifyPassword(body.password!, user.salt, user.passwordHash)
  if (!ok) return bad('invalid credentials', 401, request)

  const token = await createSession(env.WORKSPACE_KV, user)
  return json(
    { user: publicUser(user), token },
    200,
    request,
    { 'Set-Cookie': sessionCookie(token, request) }
  )
}
