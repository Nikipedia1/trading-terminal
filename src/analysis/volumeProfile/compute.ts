/** Volume Profile – POC / VA / LVN / HVN from real trades. */

import type { AggressorTrade } from '@/data/shared'
import type { ProfileBucket, ProfileWindow, VolumeProfileModel } from './types'
import { inferTickSize, roundToTick } from '@/analysis/deepPrint/interval'

const LVN_FRAC = 0.22
const HVN_FRAC = 0.7

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
      return { fromSec: start, toSec: Math.min(start + 1800, toSec) }
    }
    case 'previous_day': {
      const d = new Date(nowSec * 1000)
      d.setUTCHours(0, 0, 0, 0)
      const end = Math.floor(d.getTime() / 1000)
      return { fromSec: end - 86400, toSec: end }
    }
    case 'weekly': {
      const d = new Date(nowSec * 1000)
      const day = d.getUTCDay() // 0 Sun
      const diffToMon = (day + 6) % 7
      d.setUTCHours(0, 0, 0, 0)
      d.setUTCDate(d.getUTCDate() - diffToMon)
      return { fromSec: Math.floor(d.getTime() / 1000), toSec }
    }
    case 'last_3d':
      return { fromSec: nowSec - 3 * 86400, toSec }
    default:
      return { fromSec: nowSec - 3600, toSec }
  }
}

function markNodes(
  buckets: ProfileBucket[],
  pocVolume: number
): { lvns: number[]; hvns: number[] } {
  const lvns: number[] = []
  const hvns: number[] = []
  if (buckets.length < 3 || pocVolume <= 0) return { lvns, hvns }
  const lvnThresh = pocVolume * LVN_FRAC
  const hvnThresh = pocVolume * HVN_FRAC
  for (let i = 1; i < buckets.length - 1; i++) {
    const v = buckets[i].volume
    const prev = buckets[i - 1].volume
    const next = buckets[i + 1].volume
    if (v <= lvnThresh && v <= prev && v <= next) {
      buckets[i].isLvn = true
      lvns.push(buckets[i].price)
    }
    if (v >= hvnThresh && v >= prev && v >= next && !buckets[i].isLvn) {
      buckets[i].isHvn = true
      hvns.push(buckets[i].price)
    }
  }
  return { lvns, hvns }
}

export function buildVolumeProfile(
  trades: AggressorTrade[],
  window: ProfileWindow,
  fromSec: number,
  toSec: number,
  vaTarget = 0.7,
  tickSize?: number
): VolumeProfileModel {
  const empty = (tick: number): VolumeProfileModel => ({
    buckets: [],
    totalVolume: 0,
    poc: 0,
    vah: 0,
    val: 0,
    vaShare: 0,
    vaTarget,
    tickSize: tick,
    window,
    fromSec,
    toSec,
    tradeCount: trades.length,
    lvns: [],
    hvns: [],
  })

  if (trades.length === 0) return empty(tickSize ?? 0.01)

  const mid = trades.reduce((s, t) => s + t.price, 0) / trades.length
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

  if (buckets.length === 0 || totalVolume <= 0) return empty(tick)

  let pocIdx = 0
  for (let i = 1; i < buckets.length; i++) {
    if (buckets[i].volume > buckets[pocIdx].volume) pocIdx = i
  }
  const poc = buckets[pocIdx].price
  const pocVol = buckets[pocIdx].volume

  const target = totalVolume * vaTarget
  let acc = pocVol
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
    } else break
  }

  const { lvns, hvns } = markNodes(buckets, pocVol)

  return {
    buckets,
    totalVolume,
    poc,
    vah: buckets[hi].price,
    val: buckets[lo].price,
    vaShare: totalVolume > 0 ? acc / totalVolume : 0,
    vaTarget,
    tickSize: tick,
    window,
    fromSec,
    toSec,
    tradeCount: trades.length,
    lvns,
    hvns,
  }
}
