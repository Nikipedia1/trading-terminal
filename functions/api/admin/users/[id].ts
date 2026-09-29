import {
  type Env,
  cors,
  json,
  bad,
  requireAdmin,
  getUserById,
  saveUser,
  hashPassword,
  validatePassword,
  publicUser,
  listUsers,
} from '../../auth/_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

/**
 * PATCH: { role?, disabled?, newPassword? }
 * Admin sets a new password (hashed). Never returns passwords.
 */
export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const r = await requireAdmin(ctx.env, ctx.request)
  if (r instanceof Response) return r
  if (!ctx.env.WORKSPACE_KV) return bad('KV not configured', 503, ctx.request)

  const rawId = ctx.params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (!id || typeof id !== 'string') return bad('invalid id', 400, ctx.request)

  const user = await getUserById(ctx.env.WORKSPACE_KV, id)
  if (!user) return bad('user not found', 404, ctx.request)

  let body: { role?: string; disabled?: boolean; newPassword?: string }
  try {
    body = await ctx.request.json()
  } catch {
    return bad('invalid json', 400, ctx.request)
  }

  if (body.role === 'user' || body.role === 'admin') {
    if (user.role === 'admin' && body.role === 'user') {
      const all = await listUsers(ctx.env.WORKSPACE_KV)
      const admins = all.filter((u) => u.role === 'admin' && !u.disabled)
      if (admins.length <= 1) {
        return bad('cannot demote last admin', 400, ctx.request)
      }
    }
    user.role = body.role
  }

  if (typeof body.disabled === 'boolean') {
    if (body.disabled && user.id === r.user.id) {
      return bad('cannot disable yourself', 400, ctx.request)
    }
    user.disabled = body.disabled
  }

  if (typeof body.newPassword === 'string') {
    const err = validatePassword(body.newPassword)
    if (err) return bad(err, 400, ctx.request)
    const { salt, passwordHash } = await hashPassword(body.newPassword)
    user.salt = salt
    user.passwordHash = passwordHash
  }

  user.updatedAt = Date.now()
  await saveUser(ctx.env.WORKSPACE_KV, user)
  return json({ user: publicUser(user) }, 200, ctx.request)
}
