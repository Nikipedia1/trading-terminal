/**
 * GET /api/market/klines?symbol=AAPL&interval=1d&range=1y&limit=500
 * Proxies Yahoo Finance chart API (avoids browser CORS). No synthetic data.
 */

import { cors, type Env } from '../auth/_shared'

interface CandleDto {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const symbol = (url.searchParams.get('symbol') || '').trim()
  const interval = (url.searchParams.get('interval') || '1d').trim()
  const range = (url.searchParams.get('range') || '1y').trim()
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') || '500', 10) || 500, 1),
    2500
  )

  if (!symbol || symbol.length > 32) {
    return new Response(JSON.stringify({ error: 'invalid symbol' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const okInt = new Set([
    '1m',
    '2m',
    '5m',
    '15m',
    '30m',
    '60m',
    '90m',
    '1h',
    '1d',
    '5d',
    '1wk',
    '1mo',
    '3mo',
  ])
  const okRange = new Set([
    '1d',
    '5d',
    '1mo',
    '3mo',
    '6mo',
    '1y',
    '2y',
    '5y',
    '10y',
    'ytd',
    'max',
  ])
  if (!okInt.has(interval) || !okRange.has(range)) {
    return new Response(JSON.stringify({ error: 'invalid interval or range' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const yahooUrl =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`

  try {
    const res = await fetch(yahooUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; NACS-Lab/1.0)',
      },
    })
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `yahoo HTTP ${res.status}` }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const data = (await res.json()) as any
    const result = data?.chart?.result?.[0]
    if (!result) {
      return new Response(JSON.stringify({ error: 'empty result', candles: [] }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const ts: number[] = result.timestamp ?? []
    const q = result.indicators?.quote?.[0] ?? {}
    const opens = q.open ?? []
    const highs = q.high ?? []
    const lows = q.low ?? []
    const closes = q.close ?? []
    const vols = q.volume ?? []
    const candles: CandleDto[] = []
    for (let i = 0; i < ts.length; i++) {
      const o = opens[i]
      const h = highs[i]
      const l = lows[i]
      const c = closes[i]
      if (o == null || h == null || l == null || c == null) continue
      candles.push({
        time: ts[i]!,
        open: Number(o),
        high: Number(h),
        low: Number(l),
        close: Number(c),
        volume: Number(vols[i] ?? 0),
      })
    }
    const sliced = candles.slice(-limit)
    return new Response(
      JSON.stringify({
        symbol,
        interval,
        range,
        source: 'yahoo',
        candles: sliced,
      }),
      {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30',
        },
      }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'proxy failed' }),
      {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }
    )
  }
}
