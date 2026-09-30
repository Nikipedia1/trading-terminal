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
} from './_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return bad('invalid json', 400, request)
  }

  const email = normalizeEmail(body.email || '')
  if (!email) return bad('invalid email', 400, request)
  const pwErr = validatePassword(body.password || '')
  if (pwErr) return bad(pwErr, 400, request)

  const existing = await getUserByEmail(env.WORKSPACE_KV, email)
  if (existing) return bad('email already registered', 409, request)

  const users = await listUsers(env.WORKSPACE_KV)
  const isFirst = users.length === 0

  const { salt, passwordHash } = await hashPassword(body.password!)
  const now = Date.now()
  const user: UserRecord = {
    id: crypto.randomUUID(),
    email,
    salt,
    passwordHash,
    role: isFirst ? 'admin' : 'user',
    createdAt: now,
    updatedAt: now,
  }

  await saveUser(env.WORKSPACE_KV, user)
  const token = await createSession(env.WORKSPACE_KV, user)

  return json(
    { user: publicUser(user), token },
    201,
    request,
    { 'Set-Cookie': sessionCookie(token, request) }
  )
}
