/**
 * Stacked imbalance run length along adjacent price ticks.
 * FORMULAS.md: ratio ≥ 0.7 buy / ≤ 0.3 sell; consecutive ticks.
 */

import type { PrintLevel } from '@/analysis/deepPrint/types'

export interface StackedRun {
  side: 'buy' | 'sell'
  startPrice: number
  endPrice: number
  length: number
}

export function stackedImbalanceRuns(
  levels: PrintLevel[],
  buyThresh = 0.7,
  sellThresh = 0.3,
  minLen = 3
): StackedRun[] {
  if (levels.length === 0) return []
  const sorted = [...levels].sort((a, b) => a.price - b.price)
  const flags: (0 | 1 | -1)[] = sorted.map((l) => {
    const tot = l.buyQty + l.sellQty
    if (tot <= 0) return 0
    const r = l.buyQty / tot
    if (r >= buyThresh) return 1
    if (r <= sellThresh) return -1
    return 0
  })

  const runs: StackedRun[] = []
  let i = 0
  while (i < flags.length) {
    const f = flags[i]
    if (f === 0) {
      i += 1
      continue
    }
    let j = i + 1
    while (j < flags.length && flags[j] === f) j += 1
    const len = j - i
    if (len >= minLen) {
      runs.push({
        side: f === 1 ? 'buy' : 'sell',
        startPrice: sorted[i].price,
        endPrice: sorted[j - 1].price,
        length: len,
      })
    }
    i = j
  }
  return runs
}
