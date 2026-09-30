/**
 * GET /api/health – liveness for Pages + optional KV probe.
 */

interface Env {
  WORKSPACE_KV?: KVNamespace
}

function cors(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const started = Date.now()
  let kv: 'ok' | 'missing' | 'error' = 'missing'
  if (ctx.env.WORKSPACE_KV) {
    try {
      await ctx.env.WORKSPACE_KV.get('health:ping')
      kv = 'ok'
    } catch {
      kv = 'error'
    }
  }

  const body = {
    ok: kv !== 'error',
    service: 'trading-terminal',
    time: new Date().toISOString(),
    uptimeMs: started,
    checks: {
      kv,
      runtime: 'cloudflare-pages',
    },
  }

  return new Response(JSON.stringify(body), {
    status: kv === 'error' ? 503 : 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors(ctx.request),
    },
  })
}
