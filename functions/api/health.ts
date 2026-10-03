/**
 * GET /api/health – liveness + KV + optional upstream probes (news, calendar).
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

async function probe(
  url: string,
  timeoutMs = 4000
): Promise<{ ok: boolean; ms: number; detail?: string }> {
  const t0 = Date.now()
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    return {
      ok: res.ok,
      ms: Date.now() - t0,
      detail: res.ok ? undefined : `HTTP ${res.status}`,
    }
  } catch (e: any) {
    return { ok: false, ms: Date.now() - t0, detail: e?.message || 'fail' }
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

  const origin = new URL(ctx.request.url).origin
  const deep = new URL(ctx.request.url).searchParams.get('deep') === '1'

  const upstream: Record<string, { ok: boolean; ms: number; detail?: string }> = {}
  if (deep) {
    upstream.news = await probe(`${origin}/api/news`)
    upstream.calendar = await probe(`${origin}/api/calendar`)
  }

  const body = {
    ok: kv !== 'error',
    service: 'nacs-lab-terminal',
    time: new Date().toISOString(),
    latencyMs: Date.now() - started,
    checks: {
      kv,
      runtime: 'cloudflare-pages',
      functions: 'ok',
    },
    upstream: deep ? upstream : undefined,
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
