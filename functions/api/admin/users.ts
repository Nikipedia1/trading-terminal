import {
  type Env,
  cors,
  json,
  bad,
  requireAdmin,
  listUsers,
  publicUser,
} from '../auth/_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

/** List users – never includes password hashes */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const r = await requireAdmin(ctx.env, ctx.request)
  if (r instanceof Response) return r
  if (!ctx.env.WORKSPACE_KV) return bad('KV not configured', 503, ctx.request)
  const users = await listUsers(ctx.env.WORKSPACE_KV)
  return json({ users: users.map(publicUser) }, 200, ctx.request)
}
