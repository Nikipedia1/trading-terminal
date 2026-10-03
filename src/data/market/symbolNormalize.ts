/**
 * Multi-exchange symbol & interval normalization.
 * Canonical form: BASEQUOTE (e.g. BTCUSDT). Venue-specific wire formats derived here.
 */

import type { ExchangeId, Interval } from '@/types'

/** Canonical instrument id used across the desk. */
export function toCanonicalSymbol(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[-_/:]/g, '')
    .replace(/\s+/g, '')
}

/**
 * Map canonical symbol → venue wire symbol.
 * Examples: BTCUSDT → BTC-USDT (OKX), BTC-USDT (KuCoin often), BTCUSDT (Binance).
 */
export function toVenueSymbol(canonical: string, exchange: ExchangeId): string {
  const s = toCanonicalSymbol(canonical)
  // Split common quote suffixes
  const quotes = ['USDT', 'USDC', 'BUSD', 'USD', 'BTC', 'ETH', 'EUR']
  let base = s
  let quote = ''
  for (const q of quotes) {
    if (s.endsWith(q) && s.length > q.length) {
      base = s.slice(0, -q.length)
      quote = q
      break
    }
  }
  if (!quote) return s

  switch (exchange) {
    case 'okx':
      return `${base}-${quote}`
    case 'kucoin':
      return `${base}-${quote}`
    case 'bybit':
    case 'binance':
    case 'binance_futures':
    default:
      return `${base}${quote}`
  }
}

/** Parse venue symbol back to canonical when possible. */
export function fromVenueSymbol(venueSymbol: string, _exchange: ExchangeId): string {
  return toCanonicalSymbol(venueSymbol)
}

/** Intervals supported uniformly on the desk. */
export const CANONICAL_INTERVALS: Interval[] = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '12h',
  '1d',
  '1w',
]

/** Venue-specific interval string (most venues already use same tokens). */
export function toVenueInterval(interval: Interval, exchange: ExchangeId): string {
  // OKX uses same candle tokens for common set; Bybit v5 uses same; KuCoin uses 1min etc.
  if (exchange === 'kucoin') {
    const map: Partial<Record<Interval, string>> = {
      '1m': '1min',
      '3m': '3min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '1hour',
      '2h': '2hour',
      '4h': '4hour',
      '6h': '6hour',
      '12h': '12hour',
      '1d': '1day',
      '1w': '1week',
    }
    return map[interval] ?? interval
  }
  return interval
}

export interface NormalizedInstrument {
  canonical: string
  exchange: ExchangeId
  venueSymbol: string
  interval: Interval
  venueInterval: string
}

export function normalizeInstrument(
  exchange: ExchangeId,
  symbol: string,
  interval: Interval
): NormalizedInstrument {
  const canonical = toCanonicalSymbol(symbol)
  return {
    canonical,
    exchange,
    venueSymbol: toVenueSymbol(canonical, exchange),
    interval,
    venueInterval: toVenueInterval(interval, exchange),
  }
}
