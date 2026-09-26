/**
 * Volume Profile aggregation + POC / Value Area.
 * Real trades only – never invent volume.
 */

import type { AggressorTrade } from '@/data/shared'
import type { ProfileBucket, ProfileWindow, VolumeProfileModel } from './types'
import { inferTickSize, roundToTick } from '@/analysis/deepPrint/interval'

const VA_TARGET = 0.7

export function resolveWindowRange(
  window: ProfileWindow,
  visibleFrom: number | null,
  visibleTo: number | null,
  nowSec: number = Math.floor(Date.now() / 1000)
): { fromSec: number; toSec: number } {
  const toSec = nowSec + 1
  switch (window) {
    case 'visible': {
      if (visibleFrom != null && visibleTo != null && visibleTo > visibleFrom) {
        return { fromSec: visibleFrom, toSec: visibleTo }
      }
      return { fromSec: nowSec - 3600, toSec }
    }
    case 'session': {
      const d = new Date(nowSec * 1000)
      d.setUTCHours(0, 0, 0, 0)
      return { fromSec: Math.floor(d.getTime() / 1000), toSec }
    }
    case 'last_30m':
      return { fromSec: nowSec - 1800, toSec }
    case 'session_open_30m': {
      const d = new Date(nowSec * 1000)
      d.setUTCHours(0, 0, 0, 0)
      const start = Math.floor(d.getTime() / 1000)
      return { fromSec: start, toSec: start + 1800 }
    }
    default:
      return { fromSec: nowSec - 3600, toSec }
  }
}

export function buildVolumeProfile(
  trades: AggressorTrade[],
  window: ProfileWindow,
  fromSec: number,
  toSec: number,
  tickSize?: number
): VolumeProfileModel | null {
  if (trades.length === 0) {
    return {
      buckets: [],
      totalVolume: 0,
      poc: 0,
      vah: 0,
      val: 0,
      vaShare: 0,
      tickSize: tickSize ?? 0.01,
      window,
      fromSec,
      toSec,
      tradeCount: 0,
    }
  }

  const mid =
    trades.reduce((s, t) => s + t.price, 0) / trades.length
  const tick = tickSize ?? inferTickSize(mid)
  const map = new Map<number, { vol: number; buy: number; sell: number }>()

  let totalVolume = 0
  for (const t of trades) {
    const p = roundToTick(t.price, tick)
    let row = map.get(p)
    if (!row) {
      row = { vol: 0, buy: 0, sell: 0 }
      map.set(p, row)
    }
    row.vol += t.qty
    if (t.aggressor === 'buy') row.buy += t.qty
    else row.sell += t.qty
    totalVolume += t.qty
  }

  const buckets: ProfileBucket[] = Array.from(map.entries())
    .map(([price, v]) => ({
      price,
      volume: v.vol,
      buyVolume: v.buy,
      sellVolume: v.sell,
    }))
    .sort((a, b) => a.price - b.price)

  if (buckets.length === 0 || totalVolume <= 0) {
    return {
      buckets: [],
      totalVolume: 0,
      poc: 0,
      vah: 0,
      val: 0,
      vaShare: 0,
      tickSize: tick,
      window,
      fromSec,
      toSec,
      tradeCount: trades.length,
    }
  }

  // POC = max volume bucket
  let pocIdx = 0
  for (let i = 1; i < buckets.length; i++) {
    if (buckets[i].volume > buckets[pocIdx].volume) pocIdx = i
  }
  const poc = buckets[pocIdx].price

  // Value Area: accumulate from POC expanding up/down until ~70%
  const target = totalVolume * VA_TARGET
  let acc = buckets[pocIdx].volume
  let lo = pocIdx
  let hi = pocIdx

  while (acc < target && (lo > 0 || hi < buckets.length - 1)) {
    const nextLo = lo > 0 ? buckets[lo - 1].volume : -1
    const nextHi = hi < buckets.length - 1 ? buckets[hi + 1].volume : -1
    if (nextHi >= nextLo && nextHi >= 0) {
      hi += 1
      acc += buckets[hi].volume
    } else if (nextLo >= 0) {
      lo -= 1
      acc += buckets[lo].volume
    } else {
      break
    }
  }

  const val = buckets[lo].price
  const vah = buckets[hi].price

  return {
    buckets,
    totalVolume,
    poc,
    vah,
    val,
    vaShare: totalVolume > 0 ? acc / totalVolume : 0,
    tickSize: tick,
    window,
    fromSec,
    toSec,
    tradeCount: trades.length,
  }
}
