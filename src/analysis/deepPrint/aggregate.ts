/** Aggregate aggressor trades into bid/ask print + volume profile. */

import type { AggressorTrade } from '@/data/shared'
import type { DeepPrintModel, PrintLevel, CandleDeltaBar } from './types'
import { inferTickSize, roundToTick, intervalToSeconds } from './interval'
import type { Interval, ExchangeId } from '@/types'
import { queryTradesInRange } from './tradeBuffer'

const VA_TARGET = 0.7

function buildValueArea(
  levels: Array<{ price: number; totalVol: number }>
): { poc: number | null; vah: number | null; val: number | null; valueAreaPct: number } {
  if (levels.length === 0) {
    return { poc: null, vah: null, val: null, valueAreaPct: VA_TARGET }
  }
  let pocIdx = 0
  let maxVol = -1
  let total = 0
  for (let i = 0; i < levels.length; i++) {
    total += levels[i].totalVol
    if (levels[i].totalVol > maxVol) {
      maxVol = levels[i].totalVol
      pocIdx = i
    }
  }
  if (total <= 0) {
    return {
      poc: levels[pocIdx].price,
      vah: levels[0].price,
      val: levels[levels.length - 1].price,
      valueAreaPct: VA_TARGET,
    }
  }
  // levels sorted high → low; expand from POC until ~70% volume
  let acc = levels[pocIdx].totalVol
  let lo = pocIdx
  let hi = pocIdx
  while (acc / total < VA_TARGET && (lo > 0 || hi < levels.length - 1)) {
    const nextLo = lo > 0 ? levels[lo - 1].totalVol : -1
    const nextHi = hi < levels.length - 1 ? levels[hi + 1].totalVol : -1
    if (nextLo >= nextHi && lo > 0) {
      lo -= 1
      acc += levels[lo].totalVol
    } else if (hi < levels.length - 1) {
      hi += 1
      acc += levels[hi].totalVol
    } else if (lo > 0) {
      lo -= 1
      acc += levels[lo].totalVol
    } else {
      break
    }
  }
  return {
    poc: levels[pocIdx].price,
    vah: levels[lo].price,
    val: levels[hi].price,
    valueAreaPct: VA_TARGET,
  }
}

export function aggregatePrint(
  trades: AggressorTrade[],
  candleTime: number,
  candleEnd: number,
  anchorPrice: number,
  tickSize?: number
): DeepPrintModel {
  const tick = tickSize ?? inferTickSize(anchorPrice || trades[0]?.price || 1)
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

  const totalVolume = totalBuy + totalSell
  const buyPct = totalVolume > 0 ? (totalBuy / totalVolume) * 100 : 50
  const sellPct = totalVolume > 0 ? (totalSell / totalVolume) * 100 : 50

  const raw = Array.from(map.entries())
    .map(([price, v]) => ({
      price,
      buy: v.buy,
      sell: v.sell,
      totalVol: v.buy + v.sell,
    }))
    .sort((a, b) => b.price - a.price)

  const va = buildValueArea(raw)

  const levels: PrintLevel[] = raw.map((r) => {
    const tot = r.totalVol
    const levelBuyPct = tot > 0 ? (r.buy / tot) * 100 : 50
    const levelSellPct = tot > 0 ? (r.sell / tot) * 100 : 50
    const volPct = totalVolume > 0 ? (tot / totalVolume) * 100 : 0
    const inVA =
      va.vah != null &&
      va.val != null &&
      r.price <= Math.max(va.vah, va.val) &&
      r.price >= Math.min(va.vah, va.val)
    return {
      price: r.price,
      sellQty: r.sell,
      buyQty: r.buy,
      delta: r.buy - r.sell,
      totalVol: tot,
      buyPct: levelBuyPct,
      sellPct: levelSellPct,
      volPct,
      isPoc: va.poc != null && r.price === va.poc,
      inValueArea: inVA,
    }
  })

  return {
    candleTime,
    candleEnd,
    anchorPrice,
    levels,
    totalBuy,
    totalSell,
    totalVolume,
    totalDelta: totalBuy - totalSell,
    buyPct,
    sellPct,
    tradeCount: trades.length,
    tickSize: tick,
    poc: va.poc,
    vah: va.vah,
    val: va.val,
    valueAreaPct: va.valueAreaPct,
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
