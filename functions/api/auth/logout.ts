import {
  type Env,
  cors,
  json,
  extractToken,
  destroySession,
  clearSessionCookie,
} from './_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  if (env.WORKSPACE_KV) {
    await destroySession(env.WORKSPACE_KV, extractToken(request))
  }
  return json({ ok: true }, 200, request, {
    'Set-Cookie': clearSessionCookie(request),
  })
}
