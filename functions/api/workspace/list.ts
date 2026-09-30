/** GET /api/workspace/list – workspace ids owned by current user */

import {
  type Env,
  requireUser,
  cors,
  json,
  bad,
} from '../auth/_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { env, request } = ctx
  const auth = await requireUser(env, request)
  if (auth instanceof Response) return auth
  if (!env.WORKSPACE_KV) return bad('KV not configured', 503, request)

  const raw = await env.WORKSPACE_KV.get(`user:ws:${auth.user.id}`)
  let ids: string[] = []
  try {
    ids = raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    ids = []
  }
  return json({ workspaces: ids }, 200, request)
}
