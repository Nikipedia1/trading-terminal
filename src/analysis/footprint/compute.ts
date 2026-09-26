/** Build footprint cells from aggressor trades for a set of candle times. */

import type { AggressorTrade } from '@/data/shared'
import type { Interval } from '@/types'
import { intervalToSeconds, inferTickSize, roundToTick } from '@/analysis/deepPrint/interval'
import type { FootprintCell } from './types'

export function buildFootprintCells(
  trades: AggressorTrade[],
  candleTimes: number[],
  interval: Interval,
  tickSize?: number
): FootprintCell[] {
  if (trades.length === 0 || candleTimes.length === 0) return []

  const sec = intervalToSeconds(interval)
  const mid =
    trades.reduce((s, t) => s + t.price, 0) / trades.length || candleTimes.length
  const tick = tickSize ?? inferTickSize(mid)

  // key: `${timeSec}|${price}`
  const map = new Map<string, FootprintCell>()

  for (const t of trades) {
    const timeSec = Math.floor(t.time / 1000)
    // find covering candle
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
      cell = { timeSec: ct, price, buyQty: 0, sellQty: 0 }
      map.set(key, cell)
    }
    if (t.aggressor === 'buy') cell.buyQty += t.qty
    else cell.sellQty += t.qty
  }

  return Array.from(map.values())
}
