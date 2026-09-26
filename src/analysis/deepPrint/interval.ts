import type { Interval } from '@/types'

/** Interval length in seconds (for candle trade window). */
export function intervalToSeconds(interval: Interval): number {
  switch (interval) {
    case '1m':
      return 60
    case '3m':
      return 180
    case '5m':
      return 300
    case '15m':
      return 900
    case '30m':
      return 1800
    case '1h':
      return 3600
    case '2h':
      return 7200
    case '4h':
      return 14400
    case '6h':
      return 21600
    case '8h':
      return 28800
    case '12h':
      return 43200
    case '1d':
      return 86400
    case '3d':
      return 259200
    case '1w':
      return 604800
    case '1M':
      return 2_592_000 // approx 30d
    default:
      return 60
  }
}

/**
 * Heuristic tick size from price magnitude.
 * Good enough for print grouping without exchange filters API.
 */
export function inferTickSize(price: number): number {
  const p = Math.abs(price)
  if (p >= 10_000) return 1
  if (p >= 1_000) return 0.1
  if (p >= 100) return 0.01
  if (p >= 10) return 0.001
  if (p >= 1) return 0.0001
  if (p >= 0.1) return 0.00001
  return 0.000001
}

export function roundToTick(price: number, tick: number): number {
  if (tick <= 0) return price
  const n = Math.round(price / tick) * tick
  // avoid float noise in keys
  const decimals = Math.min(8, (tick.toString().split('.')[1] || '').length)
  return Number(n.toFixed(decimals))
}
