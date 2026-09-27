/**
 * Footprint cells + per-bar metrics from aggressor trades only.
 * See src/analysis/FORMULAS.md
 */

import type { AggressorTrade } from '@/data/shared'
import type { Interval } from '@/types'
import { intervalToSeconds, inferTickSize, roundToTick } from '@/analysis/deepPrint/interval'
import type { FootprintBar, FootprintCell } from './types'

export function buildFootprintCells(
  trades: AggressorTrade[],
  candleTimes: number[],
  interval: Interval,
  tickSize?: number
): FootprintCell[] {
  if (trades.length === 0 || candleTimes.length === 0) return []

  const sec = intervalToSeconds(interval)
  const mid = trades.reduce((s, t) => s + t.price, 0) / trades.length
  const tick = tickSize ?? inferTickSize(mid)
  const map = new Map<string, FootprintCell>()

  for (const t of trades) {
    const timeSec = Math.floor(t.time / 1000)
    let ct: number | null = null
    for (const open of candleTimes) {
      if (timeSec >= open && timeSec < open + sec) {
        ct = open
        break
      }
    }
    if (ct == null) continue

    const price = roundToTick(t.price, tick)
    const key = `${ct}|${price}`
    let cell = map.get(key)
    if (!cell) {
      cell = { timeSec: ct, price, buyQty: 0, sellQty: 0, delta: 0 }
      map.set(key, cell)
    }
    if (t.aggressor === 'buy') cell.buyQty += t.qty
    else cell.sellQty += t.qty
    cell.delta = cell.buyQty - cell.sellQty
  }

  return Array.from(map.values())
}

/** Aggregate cells into per-bar footprint metrics (POC, unfinished auction). */
export function buildFootprintBars(cells: FootprintCell[]): FootprintBar[] {
  const byTime = new Map<number, FootprintCell[]>()
  for (const c of cells) {
    let arr = byTime.get(c.timeSec)
    if (!arr) {
      arr = []
      byTime.set(c.timeSec, arr)
    }
    arr.push(c)
  }

  const bars: FootprintBar[] = []
  for (const [timeSec, list] of byTime) {
    let buy = 0
    let sell = 0
    let poc = list[0].price
    let pocVol = -1
    let hi = -Infinity
    let lo = Infinity
    let hiCell: FootprintCell | null = null
    let loCell: FootprintCell | null = null

    for (const c of list) {
      buy += c.buyQty
      sell += c.sellQty
      const v = c.buyQty + c.sellQty
      if (v > pocVol) {
        pocVol = v
        poc = c.price
      }
      if (c.price > hi) {
        hi = c.price
        hiCell = c
      }
      if (c.price < lo) {
        lo = c.price
        loCell = c
      }
    }

    bars.push({
      timeSec,
      delta: buy - sell,
      buyQty: buy,
      sellQty: sell,
      poc,
      unfinishedHigh: !!(hiCell && hiCell.sellQty === 0 && hiCell.buyQty > 0),
      unfinishedLow: !!(loCell && loCell.buyQty === 0 && loCell.sellQty > 0),
      cellCount: list.length,
    })
  }
  return bars.sort((a, b) => a.timeSec - b.timeSec)
}
