/**
 * Build TPO / Market Profile from candles.
 * Each period (e.g. 30m) gets a letter; every price tick touched in that period prints the letter.
 */
import type { Candle } from '@/types'
import { inferTickSize, roundToTick } from '@/analysis/deepPrint/interval'
import type { TpoConfig, TpoLevel, TpoModel } from './types'
import { DEFAULT_TPO_CONFIG } from './types'

const LETTERS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function periodLetter(i: number): string {
  return LETTERS[i % LETTERS.length]!
}

export function buildTpoFromCandles(
  candles: Candle[],
  cfg: Partial<TpoConfig> = {}
): TpoModel {
  const c: TpoConfig = { ...DEFAULT_TPO_CONFIG, ...cfg }
  if (!candles.length) {
    return {
      levels: [],
      periods: [],
      poc: null,
      vah: null,
      val: null,
      ibHigh: null,
      ibLow: null,
      totalTpo: 0,
      tickSize: 0.01,
      periodMinutes: c.periodMinutes,
    }
  }

  const mid = candles.reduce((s, b) => s + b.close, 0) / candles.length
  const tick = inferTickSize(mid)
  const periodSec = Math.max(60, c.periodMinutes * 60)

  type Per = { timeSec: number; high: number; low: number; letter: string }
  const periodMap = new Map<number, { high: number; low: number }>()
  for (const bar of candles) {
    const key = Math.floor(bar.time / periodSec) * periodSec
    const prev = periodMap.get(key)
    if (!prev) {
      periodMap.set(key, { high: bar.high, low: bar.low })
    } else {
      prev.high = Math.max(prev.high, bar.high)
      prev.low = Math.min(prev.low, bar.low)
    }
  }

  const sortedKeys = [...periodMap.keys()].sort((a, b) => a - b)
  const limited = sortedKeys.slice(-c.maxPeriods)
  const periods: Per[] = limited.map((k, i) => {
    const p = periodMap.get(k)!
    return {
      timeSec: k,
      high: p.high,
      low: p.low,
      letter: periodLetter(i),
    }
  })

  const levelMap = new Map<number, string[]>()
  for (const p of periods) {
    const lo = roundToTick(p.low, tick)
    const hi = roundToTick(p.high, tick)
    for (let px = lo; px <= hi + tick * 0.1; px = roundToTick(px + tick, tick)) {
      let arr = levelMap.get(px)
      if (!arr) {
        arr = []
        levelMap.set(px, arr)
      }
      if (arr[arr.length - 1] !== p.letter) arr.push(p.letter)
    }
  }

  const prices = [...levelMap.keys()].sort((a, b) => b - a)
  let totalTpo = 0
  let poc: number | null = null
  let pocCount = -1
  for (const px of prices) {
    const n = levelMap.get(px)!.length
    totalTpo += n
    if (n > pocCount) {
      pocCount = n
      poc = px
    }
  }

  const inVa = new Set<number>()
  let vah: number | null = poc
  let val: number | null = poc
  if (poc != null && totalTpo > 0) {
    const byPriceAsc = [...prices].sort((a, b) => a - b)
    const pocAt = byPriceAsc.indexOf(poc)
    inVa.add(poc)
    let acc = levelMap.get(poc)!.length
    let lo = pocAt
    let hi = pocAt
    const target = totalTpo * c.valueAreaPct
    while (acc < target && (lo > 0 || hi < byPriceAsc.length - 1)) {
      const up =
        hi < byPriceAsc.length - 1 ? levelMap.get(byPriceAsc[hi + 1]!)!.length : -1
      const down = lo > 0 ? levelMap.get(byPriceAsc[lo - 1]!)!.length : -1
      if (up >= down && up >= 0) {
        hi += 1
        const px = byPriceAsc[hi]!
        acc += levelMap.get(px)!.length
        inVa.add(px)
      } else if (down >= 0) {
        lo -= 1
        const px = byPriceAsc[lo]!
        acc += levelMap.get(px)!.length
        inVa.add(px)
      } else break
    }
    const vaList = [...inVa]
    vah = Math.max(...vaList)
    val = Math.min(...vaList)
  }

  let ibHigh: number | null = null
  let ibLow: number | null = null
  const ibSlice = periods.slice(0, c.ibPeriods)
  if (ibSlice.length) {
    ibHigh = Math.max(...ibSlice.map((p) => p.high))
    ibLow = Math.min(...ibSlice.map((p) => p.low))
  }

  const levels: TpoLevel[] = prices.map((price) => {
    const letters = levelMap.get(price)!
    return {
      price,
      letters,
      count: letters.length,
      inValueArea: inVa.has(price),
      isPoc: price === poc,
      isSinglePrint: letters.length === 1,
    }
  })

  return {
    levels,
    periods,
    poc,
    vah,
    val,
    ibHigh,
    ibLow,
    totalTpo,
    tickSize: tick,
    periodMinutes: c.periodMinutes,
  }
}
