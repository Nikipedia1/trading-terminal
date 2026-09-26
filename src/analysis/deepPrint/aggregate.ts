/** Aggregate aggressor trades into bid/ask print levels. */

import type { AggressorTrade } from '@/data/shared'
import type { DeepPrintModel, PrintLevel } from './types'
import { inferTickSize, roundToTick } from './interval'

export function aggregatePrint(
  trades: AggressorTrade[],
  candleTime: number,
  candleEnd: number,
  anchorPrice: number,
  tickSize?: number
): DeepPrintModel {
  const tick = tickSize ?? inferTickSize(anchorPrice)
  const map = new Map<number, { sell: number; buy: number }>()

  let totalBuy = 0
  let totalSell = 0

  for (const t of trades) {
    const level = roundToTick(t.price, tick)
    let row = map.get(level)
    if (!row) {
      row = { sell: 0, buy: 0 }
      map.set(level, row)
    }
    if (t.aggressor === 'buy') {
      row.buy += t.qty
      totalBuy += t.qty
    } else {
      row.sell += t.qty
      totalSell += t.qty
    }
  }

  const levels: PrintLevel[] = Array.from(map.entries())
    .map(([price, v]) => ({
      price,
      sellQty: v.sell,
      buyQty: v.buy,
    }))
    .sort((a, b) => b.price - a.price)

  return {
    candleTime,
    candleEnd,
    anchorPrice,
    levels,
    totalBuy,
    totalSell,
    tradeCount: trades.length,
    tickSize: tick,
  }
}
