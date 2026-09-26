/** Aggregate aggressor trades into bid/ask print levels + delta. */

import type { AggressorTrade } from '@/data/shared'
import type { DeepPrintModel, PrintLevel, CandleDeltaBar } from './types'
import { inferTickSize, roundToTick, intervalToSeconds } from './interval'
import type { Interval } from '@/types'
import { queryTradesInRange } from './tradeBuffer'
import type { ExchangeId } from '@/types'

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
      delta: v.buy - v.sell,
    }))
    .sort((a, b) => b.price - a.price)

  return {
    candleTime,
    candleEnd,
    anchorPrice,
    levels,
    totalBuy,
    totalSell,
    totalDelta: totalBuy - totalSell,
    tradeCount: trades.length,
    tickSize: tick,
  }
}

/** Candle-level delta for each bar time (from shared trade buffer). */
export function computeCandleDeltas(
  exchange: ExchangeId,
  symbol: string,
  candleTimes: number[],
  interval: Interval
): CandleDeltaBar[] {
  const sec = intervalToSeconds(interval)
  const out: CandleDeltaBar[] = []
  for (const t of candleTimes) {
    const trades = queryTradesInRange(exchange, symbol, t, t + sec)
    let buy = 0
    let sell = 0
    for (const tr of trades) {
      if (tr.aggressor === 'buy') buy += tr.qty
      else sell += tr.qty
    }
    out.push({ time: t, delta: buy - sell })
  }
  return out
}
