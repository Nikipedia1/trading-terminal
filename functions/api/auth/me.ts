import {
  type Env,
  cors,
  json,
  requireUser,
  publicUser,
} from './_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const r = await requireUser(ctx.env, ctx.request)
  if (r instanceof Response) return r
  return json({ user: publicUser(r.user) }, 200, ctx.request)
}
