/**
 * Effective vs Trapped – multi-bar confirmation against real candle closes.
 *
 * After `confirmBars` closed candles following the trade bar:
 * - Buy effective  if subsequent high/close pushes above trade price
 * - Buy trapped    if price fails to hold above (close stays ≤ trade)
 * - Sell effective if subsequent low/close pushes below trade price
 * - Sell trapped   if price fails to hold below
 *
 * Pending if not enough closed bars yet.
 */

import type { Candle } from '@/types'
import type { DeepTradeBubble, TradeOutcome } from './types'

export function classifyBubbles(
  bubbles: DeepTradeBubble[],
  candles: Candle[],
  intervalSec: number,
  confirmBars = 2
): DeepTradeBubble[] {
  const bars = Math.max(1, Math.min(5, confirmBars))
  if (candles.length < bars + 1 || bubbles.length === 0) {
    return bubbles.map((b) => ({ ...b, outcome: 'pending' as TradeOutcome }))
  }

  const sorted = candles

  return bubbles.map((b) => {
    let idx = sorted.findIndex(
      (c) => b.timeSec >= c.time && b.timeSec < c.time + intervalSec
    )
    if (idx < 0) {
      const tradeBarOpen = Math.floor(b.timeSec / intervalSec) * intervalSec
      idx = sorted.findIndex((c) => c.time === tradeBarOpen)
    }
    if (idx < 0) {
      return { ...b, outcome: 'pending' as TradeOutcome }
    }

    // Need `bars` fully formed candles after the trade bar
    const lastNeeded = idx + bars
    if (lastNeeded >= sorted.length) {
      return { ...b, outcome: 'pending' as TradeOutcome }
    }

    // Don't use the absolute live last candle as sole confirmation if it's still open:
    // require at least one intermediate closed bar when possible.
    const window = sorted.slice(idx + 1, idx + 1 + bars)
    if (window.length < bars) {
      return { ...b, outcome: 'pending' as TradeOutcome }
    }

    const maxHigh = Math.max(...window.map((c) => c.high))
    const minLow = Math.min(...window.map((c) => c.low))
    const lastClose = window[window.length - 1].close

    let outcome: TradeOutcome
    if (b.aggressor === 'buy') {
      // Effective: buyers pushed price through and closed above print
      // Trapped: never sustained above – closed at or below print
      if (maxHigh > b.price && lastClose > b.price) {
        outcome = 'effective'
      } else if (lastClose <= b.price) {
        outcome = 'trapped'
      } else {
        // Mixed: touched above but closed weak → soft trapped
        outcome = maxHigh > b.price * 1.0002 ? 'effective' : 'trapped'
      }
    } else {
      if (minLow < b.price && lastClose < b.price) {
        outcome = 'effective'
      } else if (lastClose >= b.price) {
        outcome = 'trapped'
      } else {
        outcome = minLow < b.price * 0.9998 ? 'effective' : 'trapped'
      }
    }

    return { ...b, outcome }
  })
}
