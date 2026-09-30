/**
 * Proxy Fear & Greed Index (alternative.me) – avoids browser CORS / ad-block.
 * GET /api/sentiment/fng
 */

import { cors, json, bad, type Env } from '../auth/_shared'

export const onRequestOptions: PagesFunction<Env> = async (ctx) =>
  new Response(null, { status: 204, headers: cors(ctx.request) })

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return bad(`upstream ${res.status}`, 502, ctx.request)
    const data = (await res.json()) as {
      data?: Array<{ value: string; value_classification?: string; timestamp?: string }>
    }
    const row = data?.data?.[0]
    const value = Number(row?.value)
    if (!Number.isFinite(value)) return bad('invalid upstream payload', 502, ctx.request)
    return json(
      {
        value,
        classification: row?.value_classification ?? null,
        timestamp: row?.timestamp ? Number(row.timestamp) * 1000 : Date.now(),
        source: 'alternative.me',
      },
      200,
      ctx.request
    )
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'fetch failed', 502, ctx.request)
  }
}
