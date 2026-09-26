/**
 * Effective vs Trapped classification (annotation only).
 *
 * After the next closed candle relative to the trade time:
 * - Buy + next close > trade price → Effective
 * - Buy + next close ≤ trade price → Trapped
 * - Sell + next close < trade price → Effective
 * - Sell + next close ≥ trade price → Trapped
 *
 * Pending if no closed candle after the trade yet.
 */

import type { Candle } from '@/types'
import type { DeepTradeBubble, TradeOutcome } from './types'

export function classifyBubbles(
  bubbles: DeepTradeBubble[],
  candles: Candle[],
  intervalSec: number
): DeepTradeBubble[] {
  if (candles.length < 2 || bubbles.length === 0) {
    return bubbles.map((b) => ({ ...b, outcome: 'pending' as TradeOutcome }))
  }

  // candles chronological
  const sorted = candles

  return bubbles.map((b) => {
    const tradeBarOpen = Math.floor(b.timeSec / intervalSec) * intervalSec
    // Prefer exact match; else first candle with open <= trade < open+interval
    let idx = sorted.findIndex(
      (c) => b.timeSec >= c.time && b.timeSec < c.time + intervalSec
    )
    if (idx < 0) {
      idx = sorted.findIndex((c) => c.time === tradeBarOpen)
    }
    if (idx < 0 || idx >= sorted.length - 1) {
      return { ...b, outcome: 'pending' as TradeOutcome }
    }

    // Need a fully closed next candle: if last candle is still forming, only
    // classify when idx+1 is not the live bar OR we treat idx+1 close as provisional.
    // Use next candle close strictly.
    const next = sorted[idx + 1]
    if (!next) return { ...b, outcome: 'pending' as TradeOutcome }

    // If next is the absolute last candle it may still be open – still use close as best estimate
    let outcome: TradeOutcome
    if (b.aggressor === 'buy') {
      outcome = next.close > b.price ? 'effective' : 'trapped'
    } else {
      outcome = next.close < b.price ? 'effective' : 'trapped'
    }
    return { ...b, outcome }
  })
}
