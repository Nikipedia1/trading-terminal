/**
 * Absorption / Aggression tags on candles (annotation only).
 *
 * Uses candle delta (buy − sell aggressor volume) + close position in range:
 * - Aggression buy:  strong +delta, close in upper third
 * - Aggression sell: strong −delta, close in lower third
 * - Absorption buy:  strong +delta, close in lower half (sellers held)
 * - Absorption sell: strong −delta, close in upper half (buyers held)
 *
 * Real ticks only via CandleDeltaBar; no synthetic volume.
 */

import type { Candle } from '@/types'
import type { CandleDeltaBar } from '@/analysis/deepPrint/types'

export type AbsorptionKind =
  | 'aggression_buy'
  | 'aggression_sell'
  | 'absorption_buy'
  | 'absorption_sell'

export interface AbsorptionMarker {
  time: number
  kind: AbsorptionKind
  price: number
  delta: number
}

/**
 * @param minDeltaPct – only bars with |delta| >= this % of max |delta| in window
 */
export function detectAbsorptionAggression(
  candles: Candle[],
  deltas: CandleDeltaBar[],
  minDeltaPct = 35
): AbsorptionMarker[] {
  if (candles.length < 3 || deltas.length < 3) return []

  const deltaMap = new Map(deltas.map((d) => [d.time, d.delta]))
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d.delta)), 0.0001)
  const thresh = maxAbs * (minDeltaPct / 100)
  const out: AbsorptionMarker[] = []

  // Skip the live (last) candle for stable tags
  const slice = candles.slice(0, -1)
  for (const c of slice) {
    const d = deltaMap.get(c.time)
    if (d == null || Math.abs(d) < thresh) continue

    const range = c.high - c.low
    if (range <= 0) continue
    const closePos = (c.close - c.low) / range // 0 = low, 1 = high

    if (d > 0) {
      if (closePos >= 2 / 3) {
        out.push({
          time: c.time,
          kind: 'aggression_buy',
          price: c.high,
          delta: d,
        })
      } else if (closePos <= 0.5) {
        out.push({
          time: c.time,
          kind: 'absorption_buy',
          price: c.low,
          delta: d,
        })
      }
    } else {
      if (closePos <= 1 / 3) {
        out.push({
          time: c.time,
          kind: 'aggression_sell',
          price: c.low,
          delta: d,
        })
      } else if (closePos >= 0.5) {
        out.push({
          time: c.time,
          kind: 'absorption_sell',
          price: c.high,
          delta: d,
        })
      }
    }
  }

  return out
}
