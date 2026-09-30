/**
 * Candle-scoped volume profile from Deep Print levels (real aggressor volume).
 * POC = max total volume level; VA expands from POC until vaPct of volume.
 */

import type { PrintLevel } from './types'

export interface CandleProfileBucket {
  price: number
  volume: number
  buyQty: number
  sellQty: number
  /** share of candle total volume 0..1 */
  share: number
  isPoc: boolean
  inVa: boolean
}

export interface CandleProfile {
  buckets: CandleProfileBucket[]
  poc: number
  vah: number
  val: number
  totalVolume: number
  vaPct: number
}

/** Build VP for the selected candle from print levels. */
export function buildCandleProfile(
  levels: PrintLevel[],
  vaPct: number = 70
): CandleProfile | null {
  if (!levels.length) return null
  const target = Math.min(95, Math.max(50, vaPct)) / 100

  const raw = levels.map((l) => ({
    price: l.price,
    volume: l.buyQty + l.sellQty,
    buyQty: l.buyQty,
    sellQty: l.sellQty,
  }))
  const totalVolume = raw.reduce((s, b) => s + b.volume, 0)
  if (totalVolume <= 0) return null

  let pocIdx = 0
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].volume > raw[pocIdx].volume) pocIdx = i
  }
  const poc = raw[pocIdx].price

  const byPrice = [...raw].sort((a, b) => a.price - b.price)
  const pocAt = byPrice.findIndex((b) => b.price === poc)
  const inVa = new Set<number>([poc])
  let acc = byPrice[pocAt]?.volume ?? 0
  let lo = pocAt
  let hi = pocAt
  while (acc / totalVolume < target && (lo > 0 || hi < byPrice.length - 1)) {
    const up = hi < byPrice.length - 1 ? byPrice[hi + 1].volume : -1
    const down = lo > 0 ? byPrice[lo - 1].volume : -1
    if (up >= down && up >= 0) {
      hi += 1
      acc += byPrice[hi].volume
      inVa.add(byPrice[hi].price)
    } else if (down >= 0) {
      lo -= 1
      acc += byPrice[lo].volume
      inVa.add(byPrice[lo].price)
    } else break
  }

  const vaPrices = [...inVa]
  const vah = Math.max(...vaPrices)
  const val = Math.min(...vaPrices)

  const buckets: CandleProfileBucket[] = levels.map((l) => {
    const volume = l.buyQty + l.sellQty
    return {
      price: l.price,
      volume,
      buyQty: l.buyQty,
      sellQty: l.sellQty,
      share: volume / totalVolume,
      isPoc: l.price === poc,
      inVa: inVa.has(l.price),
    }
  })

  return { buckets, poc, vah, val, totalVolume, vaPct: target * 100 }
}
