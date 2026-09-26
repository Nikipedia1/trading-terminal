/** Build a DomSnapshot from an OrderBookSnapshot within mid ± band, with delta + persistence. */

import type { OrderBookSnapshot } from '@/data/shared'
import type { DomLevel, DomSnapshot, DomSurprise } from './types'

/** Previous sample: price → { qty, persistence } for delta / magnet chain */
export type PrevLevelMap = Map<number, { qty: number; persistence: number }>

function surpriseOf(
  qty: number,
  prevQty: number,
  k: number
): DomSurprise | null {
  if (k <= 1 || prevQty <= 0) {
    // New level with meaningful size can still be a soft refill signal
    if (prevQty <= 0 && qty > 0) return null
    return null
  }
  const ratio = qty / prevQty
  if (ratio >= k) return 'refill'
  if (ratio <= 1 / k) return 'pull'
  return null
}

/**
 * Sample book inside mid ± bandPct.
 * @param prevMap optional previous levels for deltaQty + persistence
 * @param surpriseFactor K for REFILL/PULL detection
 */
export function sampleBookBand(
  book: OrderBookSnapshot,
  bandPct: number,
  prevMap: PrevLevelMap | null = null,
  surpriseFactor = 3,
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
  const k = Math.max(1.01, surpriseFactor)

  const pushSide = (price: number, qty: number, side: 1 | -1) => {
    if (price < lo || price > hi || qty <= 0) return
    const prev = prevMap?.get(price)
    const prevQty = prev?.qty ?? 0
    const persistence = prevQty > 0 ? (prev?.persistence ?? 0) + 1 : 1
    const deltaQty = qty - prevQty
    const surprise = surpriseOf(qty, prevQty, k)
    levels.push({ price, qty, side, deltaQty, persistence, surprise })
  }

  for (const l of book.bids) pushSide(l.price, l.qty, -1)
  for (const l of book.asks) pushSide(l.price, l.qty, 1)

  // Levels that vanished entirely (were in prev, now gone) → synthetic PULL at last known price
  // Only if still inside band of *current* mid (conservative; avoids ghost markers far away)
  if (prevMap) {
    for (const [price, prev] of prevMap) {
      if (prev.qty <= 0) continue
      if (price < lo || price > hi) continue
      if (levels.some((l) => l.price === price)) continue
      // Full pull: qty → 0
      const ratio = 0 / prev.qty
      if (ratio <= 1 / k || prev.qty > 0) {
        levels.push({
          price,
          qty: 0,
          side: price >= mid ? 1 : -1,
          deltaQty: -prev.qty,
          persistence: 0,
          surprise: 'pull',
        })
      }
    }
  }

  return { timeSec, mid, levels }
}

/** Build next prev map from a snapshot (only levels with qty > 0). */
export function toPrevMap(snap: DomSnapshot | null): PrevLevelMap {
  const m: PrevLevelMap = new Map()
  if (!snap) return m
  for (const l of snap.levels) {
    if (l.qty > 0) m.set(l.price, { qty: l.qty, persistence: l.persistence })
  }
  return m
}
