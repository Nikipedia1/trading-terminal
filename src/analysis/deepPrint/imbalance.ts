/** Imbalance detection for Deep Print levels. */

import type { PrintLevel } from './types'

/** Buy share of level volume; 0.5 if empty */
export function buyRatio(l: PrintLevel): number {
  const tot = l.buyQty + l.sellQty
  if (tot <= 0) return 0.5
  return l.buyQty / tot
}

export type ImbalanceSide = 'buy' | 'sell' | null

/** Strong imbalance: ≥70% one side */
export function levelImbalance(l: PrintLevel, threshold = 0.7): ImbalanceSide {
  const r = buyRatio(l)
  if (r >= threshold) return 'buy'
  if (r <= 1 - threshold) return 'sell'
  return null
}

/**
 * Mark consecutive stacked imbalances (same side).
 * Returns Set of prices that belong to a stack of length ≥ minStack.
 */
export function stackedImbalancePrices(
  levels: PrintLevel[],
  minStack = 3,
  threshold = 0.7
): Set<number> {
  const out = new Set<number>()
  if (levels.length < minStack) return out

  // levels are sorted high → low
  let runSide: ImbalanceSide = null
  let runStart = 0

  const flush = (endExclusive: number) => {
    if (runSide && endExclusive - runStart >= minStack) {
      for (let i = runStart; i < endExclusive; i++) out.add(levels[i].price)
    }
  }

  for (let i = 0; i < levels.length; i++) {
    const side = levelImbalance(levels[i], threshold)
    if (side && side === runSide) continue
    flush(i)
    runSide = side
    runStart = i
  }
  flush(levels.length)

  return out
}
