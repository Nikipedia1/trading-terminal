/**
 * Light price vs delta divergence flags (annotation only – not trade signals).
 *
 * Bearish: price higher high, cumulative/candle delta lower high
 * Bullish: price lower low, cumulative/candle delta higher low
 */

import type { Candle } from '@/types'
import type { CandleDeltaBar } from '@/analysis/deepPrint/types'

export interface DivergenceMarker {
  time: number
  /** 'bearish' = price HH + delta LH; 'bullish' = price LL + delta HL */
  kind: 'bearish' | 'bullish'
  price: number
}

/**
 * Swing-based divergence on recent bars using simple pivot of length 2.
 * Uses candle high/low vs candle delta (not CVD) for local structure.
 */
export function detectDivergences(
  candles: Candle[],
  deltas: CandleDeltaBar[],
  lookback = 40
): DivergenceMarker[] {
  if (candles.length < 8 || deltas.length < 8) return []

  const deltaMap = new Map(deltas.map((d) => [d.time, d.delta]))
  const slice = candles.slice(-lookback)
  const out: DivergenceMarker[] = []

  // Local swing highs / lows (pivot = 2)
  const swingHighs: number[] = []
  const swingLows: number[] = []

  for (let i = 2; i < slice.length - 2; i++) {
    const c = slice[i]
    const hi =
      c.high >= slice[i - 1].high &&
      c.high >= slice[i - 2].high &&
      c.high >= slice[i + 1].high &&
      c.high >= slice[i + 2].high
    const lo =
      c.low <= slice[i - 1].low &&
      c.low <= slice[i - 2].low &&
      c.low <= slice[i + 1].low &&
      c.low <= slice[i + 2].low
    if (hi) swingHighs.push(i)
    if (lo) swingLows.push(i)
  }

  // Bearish: last two swing highs – price HH, delta LH
  if (swingHighs.length >= 2) {
    const a = swingHighs[swingHighs.length - 2]
    const b = swingHighs[swingHighs.length - 1]
    const ca = slice[a]
    const cb = slice[b]
    const da = deltaMap.get(ca.time) ?? 0
    const db = deltaMap.get(cb.time) ?? 0
    if (cb.high > ca.high && db < da) {
      out.push({ time: cb.time, kind: 'bearish', price: cb.high })
    }
  }

  // Bullish: last two swing lows – price LL, delta HL
  if (swingLows.length >= 2) {
    const a = swingLows[swingLows.length - 2]
    const b = swingLows[swingLows.length - 1]
    const ca = slice[a]
    const cb = slice[b]
    const da = deltaMap.get(ca.time) ?? 0
    const db = deltaMap.get(cb.time) ?? 0
    if (cb.low < ca.low && db > da) {
      out.push({ time: cb.time, kind: 'bullish', price: cb.low })
    }
  }

  return out
}
