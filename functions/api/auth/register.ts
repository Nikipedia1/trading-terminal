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
  createSession,
  sessionCookie,
  publicUser,
  listUsers,
  type UserRecord,
  checkRateLimit,
  clientIp,
  readJsonBody,
} from './_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

function cleanStr(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim().replace(/\s+/g, ' ')
  if (!s) return undefined
  return s.slice(0, max)
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)

  const ip = clientIp(request)
  const rl = await checkRateLimit(env.WORKSPACE_KV, `register:ip:${ip}`, 5, 3600)
  if (!rl.ok) {
    return bad(`rate limit exceeded – retry in ${rl.retryAfterSec}s`, 429, request)
  }

  const bodyRes = await readJsonBody<{
    email?: string
    password?: string
    fullName?: string
    company?: string
    phone?: string
    telegramUsername?: string
    acceptTerms?: boolean
    acceptRisk?: boolean
  }>(request)
  if (!bodyRes.ok) return bodyRes.response
  const body = bodyRes.data

  const email = normalizeEmail(String(body.email || ''))
  if (!email) return bad('email non valida', 400, request)

  const fullName = cleanStr(body.fullName, 80)
  if (!fullName || fullName.length < 2) {
    return bad('nome completo obbligatorio (min 2 caratteri)', 400, request)
  }

  const pwErr = validatePassword(String(body.password || ''))
  if (pwErr) return bad(pwErr, 400, request)

  if (body.acceptTerms !== true) {
    return bad('devi accettare i Termini di servizio', 400, request)
  }
  if (body.acceptRisk !== true) {
    return bad('devi accettare l avviso sui rischi di trading', 400, request)
  }

  const company = cleanStr(body.company, 80)
  const phone = cleanStr(body.phone, 32)
  let telegramUsername = cleanStr(body.telegramUsername, 64)
  if (telegramUsername) {
    telegramUsername = telegramUsername.replace(/^@/, '')
    if (!/^[A-Za-z0-9_]{3,64}$/.test(telegramUsername)) {
      return bad('username Telegram non valido', 400, request)
    }
  }

  const existing = await getUserByEmail(env.WORKSPACE_KV, email)
  if (existing) return bad('email già registrata', 409, request)

  const users = await listUsers(env.WORKSPACE_KV)
  const isFirst = users.length === 0

  const { salt, passwordHash } = await hashPassword(String(body.password))
  const now = Date.now()
  const user: UserRecord = {
    id: crypto.randomUUID(),
    email,
    salt,
    passwordHash,
    role: isFirst ? 'admin' : 'user',
    planId: 'free',
    level: 'base',
    fullName,
    company,
    phone,
    telegramUsername,
    acceptedTermsAt: now,
    acceptedRiskAt: now,
    createdAt: now,
    updatedAt: now,
  }

  await saveUser(env.WORKSPACE_KV, user)
  const token = await createSession(env.WORKSPACE_KV, user)

  return json(
    { user: publicUser(user) },
    201,
    request,
    { 'Set-Cookie': sessionCookie(token, request) }
  )
}
