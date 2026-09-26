/**
 * Conservative book-surprise heuristics on public L2.
 *
 * NOT institutional spoofing detection: public crypto depth is noisy,
 * incomplete (KuCoin ≤100), and can lag. We only flag:
 *  - FLASH: large size appears then vanishes within flashSamples samples
 *  - REFILL / PULL: already handled per-sample in sample.ts (factor K)
 *
 * Labels are annotations only.
 */

import type { DomSnapshot, DomLevel } from './types'

export type FlashKind = 'flash_add' | 'flash_remove'

export interface FlashEvent {
  price: number
  side: 1 | -1
  kind: FlashKind
  /** max size seen in the short window */
  peakQty: number
  timeSec: number
}

/**
 * Scan recent snapshots for levels that peaked then disappeared quickly.
 * @param minPeakQty – ignore tiny levels (absolute base qty)
 * @param flashSamples – max samples from peak to vanish (default 2 ≈ 2s at 1s sample)
 */
export function detectFlashLevels(
  snaps: DomSnapshot[],
  minPeakQty: number,
  flashSamples = 2
): FlashEvent[] {
  if (snaps.length < 3 || minPeakQty <= 0) return []

  // price → list of {time, qty, side} chronologically in window tail
  const tail = snaps.slice(-Math.max(8, flashSamples + 3))
  const byPrice = new Map<number, { timeSec: number; qty: number; side: 1 | -1 }[]>()

  for (const s of tail) {
    for (const l of s.levels) {
      if (l.qty <= 0 && l.surprise !== 'pull') continue
      const arr = byPrice.get(l.price) ?? []
      arr.push({ timeSec: s.timeSec, qty: l.qty, side: l.side })
      byPrice.set(l.price, arr)
    }
  }

  const out: FlashEvent[] = []
  for (const [price, series] of byPrice) {
    if (series.length < 2) continue
    let peak = 0
    let peakIdx = -1
    let side: 1 | -1 = series[0].side
    for (let i = 0; i < series.length; i++) {
      if (series[i].qty > peak) {
        peak = series[i].qty
        peakIdx = i
        side = series[i].side
      }
    }
    if (peak < minPeakQty || peakIdx < 0) continue

    // After peak, within flashSamples, size drops to ~0
    const after = series.slice(peakIdx, peakIdx + flashSamples + 1)
    const vanished = after.some((r) => r.qty <= peak * 0.05)
    const wasNew =
      peakIdx === 0 || series[peakIdx - 1].qty <= peak * 0.15

    if (vanished && wasNew) {
      out.push({
        price,
        side,
        kind: 'flash_remove',
        peakQty: peak,
        timeSec: series[series.length - 1].timeSec,
      })
    }
  }

  // Dedupe by price keep largest peak
  const best = new Map<number, FlashEvent>()
  for (const e of out) {
    const prev = best.get(e.price)
    if (!prev || e.peakQty > prev.peakQty) best.set(e.price, e)
  }
  return Array.from(best.values())
}

/** Mark levels that are part of a flash on the latest snapshot (for paint). */
export function tagFlashOnLevels(
  levels: DomLevel[],
  flashes: FlashEvent[]
): DomLevel[] {
  if (flashes.length === 0) return levels
  const set = new Set(flashes.map((f) => f.price))
  return levels.map((l) =>
    set.has(l.price)
      ? {
          ...l,
          // reuse surprise channel for paint: treat flash as pull-ish
          surprise: l.surprise ?? 'pull',
        }
      : l
  )
}
