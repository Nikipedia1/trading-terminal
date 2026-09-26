/** Build a DomSnapshot from an OrderBookSnapshot within mid ± band. */

import type { OrderBookSnapshot } from '@/data/shared'
import type { DomLevel, DomSnapshot } from './types'

export function sampleBookBand(
  book: OrderBookSnapshot,
  bandPct: number,
  timeSec = Math.floor(Date.now() / 1000)
): DomSnapshot | null {
  if (!book.ready || (book.bids.length === 0 && book.asks.length === 0)) return null

  const bestBid = book.bids[0]?.price
  const bestAsk = book.asks[0]?.price
  if (bestBid == null && bestAsk == null) return null

  const mid =
    bestBid != null && bestAsk != null
      ? (bestBid + bestAsk) / 2
      : (bestBid ?? bestAsk)!

  const lo = mid * (1 - bandPct)
  const hi = mid * (1 + bandPct)
  const levels: DomLevel[] = []

  for (const l of book.bids) {
    if (l.price < lo || l.price > hi) continue
    if (l.qty > 0) levels.push({ price: l.price, qty: l.qty, side: -1 })
  }
  for (const l of book.asks) {
    if (l.price < lo || l.price > hi) continue
    if (l.qty > 0) levels.push({ price: l.price, qty: l.qty, side: 1 })
  }

  return { timeSec, mid, levels }
}
