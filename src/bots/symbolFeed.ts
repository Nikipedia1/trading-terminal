/**
 * Secondary symbol candle/price feed for multi-pair bots.
 * Primary chart uses marketStore; others use Binance public REST (cached).
 */

import type { CandleLike } from './engine'

const CACHE_MS = 15_000
const cache = new Map<
  string,
  { candles: CandleLike[]; price: number; at: number }
>()

function mapInterval(iv: string): string {
  const m: Record<string, string> = {
    '1m': '1m',
    '3m': '3m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '2h': '2h',
    '4h': '4h',
    '6h': '6h',
    '8h': '8h',
    '12h': '12h',
    '1d': '1d',
    '3d': '3d',
    '1w': '1w',
    '1M': '1M',
  }
  return m[iv] ?? '1m'
}

export async function fetchSymbolFeed(
  symbol: string,
  interval = '1m',
  limit = 120
): Promise<{ candles: CandleLike[]; price: number } | null> {
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!sym) return null
  const key = `${sym}:${interval}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return { candles: hit.candles, price: hit.price }
  }
  try {
    const iv = mapInterval(interval)
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${iv}&limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) return hit ? { candles: hit.candles, price: hit.price } : null
    const rows = (await res.json()) as unknown[]
    if (!Array.isArray(rows) || rows.length === 0) return null
    const candles: CandleLike[] = rows.map((r) => {
      const a = r as (string | number)[]
      return {
        time: Math.floor(Number(a[0]) / 1000),
        open: Number(a[1]),
        high: Number(a[2]),
        low: Number(a[3]),
        close: Number(a[4]),
        volume: Number(a[5]),
      }
    })
    const price = candles[candles.length - 1].close
    cache.set(key, { candles, price, at: Date.now() })
    return { candles, price }
  } catch {
    return hit ? { candles: hit.candles, price: hit.price } : null
  }
}
