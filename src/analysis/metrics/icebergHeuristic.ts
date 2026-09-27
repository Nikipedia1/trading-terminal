/**
 * Iceberg *heuristic* only — public L2 cannot prove hidden size.
 * score = tradeVol / max(bookMax, ε); suspect if score ≥ K.
 * See FORMULAS.md
 */

import type { AggressorTrade } from '@/data/shared'
import { roundToTick, inferTickSize } from '@/analysis/deepPrint/interval'

export interface IcebergSuspect {
  price: number
  tradeVol: number
  bookMax: number
  score: number
}

/**
 * @param bookMaxByPrice – optional max resting size seen at price (from DOM samples)
 */
export function icebergHeuristic(
  trades: AggressorTrade[],
  bookMaxByPrice: Map<number, number> | null,
  opts: { k?: number; minVol?: number; tickSize?: number } = {}
): IcebergSuspect[] {
  const k = opts.k ?? 3
  const minVol = opts.minVol ?? 0
  if (trades.length === 0) return []

  const mid = trades.reduce((s, t) => s + t.price, 0) / trades.length
  const tick = opts.tickSize ?? inferTickSize(mid)
  const vol = new Map<number, number>()

  for (const t of trades) {
    const p = roundToTick(t.price, tick)
    vol.set(p, (vol.get(p) ?? 0) + t.qty)
  }

  const out: IcebergSuspect[] = []
  for (const [price, tradeVol] of vol) {
    if (tradeVol < minVol) continue
    const bookMax = bookMaxByPrice?.get(price) ?? 0
    const score = tradeVol / Math.max(bookMax, 1e-12)
    // Without book samples, score is huge — only flag when bookMax known
    if (bookMax > 0 && score >= k) {
      out.push({ price, tradeVol, bookMax, score })
    }
  }
  return out.sort((a, b) => b.score - a.score)
}
