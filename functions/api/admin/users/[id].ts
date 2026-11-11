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
  VALID_ROLES,
  VALID_PLANS,
  VALID_LEVELS,
  type UserRole,
  type PlanId,
  type UserLevel,
} from '../../auth/_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

/**
 * PATCH: { role?, level?, planId?, planNote?, disabled?, newPassword? }
 * Admin assigns desk role, course level, and commercial plan (e.g. after payment).
 * Never returns passwords.
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

  let body: {
    role?: string
    level?: string
    planId?: string
    planNote?: string
    disabled?: boolean
    newPassword?: string
  }
  try {
    body = await ctx.request.json()
  } catch {
    return bad('invalid json', 400, ctx.request)
  }

  if (typeof body.role === 'string') {
    const role = body.role.toLowerCase() as UserRole
    if (!VALID_ROLES.includes(role)) {
      return bad(`role must be one of: ${VALID_ROLES.join(', ')}`, 400, ctx.request)
    }
    if (user.role === 'admin' && role !== 'admin') {
      const all = await listUsers(ctx.env.WORKSPACE_KV)
      const admins = all.filter((u) => u.role === 'admin' && !u.disabled)
      if (admins.length <= 1) {
        return bad('cannot demote last admin', 400, ctx.request)
      }
    }
    user.role = role
  }

  if (typeof body.level === 'string') {
    const level = body.level.toLowerCase() as UserLevel
    if (!VALID_LEVELS.includes(level)) {
      return bad(`level must be one of: ${VALID_LEVELS.join(', ')}`, 400, ctx.request)
    }
    user.level = level
  }

  if (typeof body.planId === 'string') {
    const planId = body.planId.toLowerCase() as PlanId
    if (!VALID_PLANS.includes(planId)) {
      return bad(`planId must be one of: ${VALID_PLANS.join(', ')}`, 400, ctx.request)
    }
    user.planId = planId
    user.planUpdatedAt = Date.now()
    if (typeof body.planNote === 'string') {
      user.planNote = body.planNote.slice(0, 200)
    }
  } else if (typeof body.planNote === 'string') {
    user.planNote = body.planNote.slice(0, 200)
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
