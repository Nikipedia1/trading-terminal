/**
 * Deepentropy-style TA extensions – real OHLCV only.
 * Fisher, Vortex, CHOP, Mass, Klinger, SMI, McGinley, LSMA, EOM, HistVol.
 */

import type { Candle } from '@/types'
import type { LinePoint, PriceSource } from './types'
import { sourceSeries, smaSeries, emaSeries } from './compute'

function toPoints(candles: Candle[], series: (number | null)[]): LinePoint[] {
  const pts: LinePoint[] = []
  for (let i = 0; i < series.length; i++) {
    const v = series[i]
    if (v == null || !Number.isFinite(v)) continue
    pts.push({ time: candles[i].time, value: v })
  }
  return pts
}

/** Fisher Transform of median price (Ehlers). */
export function computeFisher(candles: Candle[], period: number): LinePoint[] {
  const n = Math.max(2, period)
  const med = candles.map((c) => (c.high + c.low) / 2)
  const out: (number | null)[] = new Array(candles.length).fill(null)
  let prevFish = 0
  let prevVal = 0
  for (let i = n - 1; i < candles.length; i++) {
    let hi = -Infinity
    let lo = Infinity
    for (let j = i - n + 1; j <= i; j++) {
      if (med[j] > hi) hi = med[j]
      if (med[j] < lo) lo = med[j]
    }
    const range = hi - lo || 1e-12
    let val = 0.33 * 2 * ((med[i] - lo) / range - 0.5) + 0.67 * prevVal
    val = Math.max(-0.999, Math.min(0.999, val))
    const fish = 0.5 * Math.log((1 + val) / (1 - val)) + 0.5 * prevFish
    out[i] = fish
    prevVal = val
    prevFish = fish
  }
  return toPoints(candles, out)
}

/** Vortex Indicator VI+ / VI-. */
export function computeVortex(
  candles: Candle[],
  period: number
): { vip: LinePoint[]; vim: LinePoint[] } {
  const n = Math.max(2, period)
  const tr: number[] = []
  const vmPlus: number[] = []
  const vmMinus: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low)
      vmPlus.push(0)
      vmMinus.push(0)
      continue
    }
    const c = candles[i]
    const p = candles[i - 1]
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
    vmPlus.push(Math.abs(c.high - p.low))
    vmMinus.push(Math.abs(c.low - p.high))
  }
  const vipRaw: (number | null)[] = new Array(candles.length).fill(null)
  const vimRaw: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = n - 1; i < candles.length; i++) {
    let sumTr = 0
    let sumP = 0
    let sumM = 0
    for (let j = i - n + 1; j <= i; j++) {
      sumTr += tr[j]
      sumP += vmPlus[j]
      sumM += vmMinus[j]
    }
    if (sumTr > 0) {
      vipRaw[i] = sumP / sumTr
      vimRaw[i] = sumM / sumTr
    }
  }
  return { vip: toPoints(candles, vipRaw), vim: toPoints(candles, vimRaw) }
}

/** Choppiness Index (0-100). */
export function computeChop(candles: Candle[], period: number): LinePoint[] {
  const n = Math.max(2, period)
  const out: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = n - 1; i < candles.length; i++) {
    let sumTr = 0
    let hi = -Infinity
    let lo = Infinity
    for (let j = i - n + 1; j <= i; j++) {
      const c = candles[j]
      const prev = j > 0 ? candles[j - 1] : c
      const trv = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
      sumTr += trv
      if (c.high > hi) hi = c.high
      if (c.low < lo) lo = c.low
    }
    const range = hi - lo
    if (range > 0 && sumTr > 0) {
      out[i] = (100 * Math.log10(sumTr / range)) / Math.log10(n)
    }
  }
  return toPoints(candles, out)
}

/** Mass Index. */
export function computeMass(candles: Candle[], emaPeriod: number, sumPeriod: number): LinePoint[] {
  const ep = Math.max(2, emaPeriod)
  const sp = Math.max(2, sumPeriod)
  const range = candles.map((c) => c.high - c.low)
  const e1 = emaSeries(range, ep)
  const e1nums = e1.map((v) => (v == null ? 0 : v))
  const e2 = emaSeries(e1nums, ep)
  const ratio: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = 0; i < candles.length; i++) {
    if (e1[i] != null && e2[i] != null && (e2[i] as number) !== 0) {
      ratio[i] = (e1[i] as number) / (e2[i] as number)
    }
  }
  const out: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = sp - 1; i < candles.length; i++) {
    let s = 0
    let ok = true
    for (let j = i - sp + 1; j <= i; j++) {
      if (ratio[j] == null) {
        ok = false
        break
      }
      s += ratio[j] as number
    }
    if (ok) out[i] = s
  }
  return toPoints(candles, out)
}

/** Klinger Volume Oscillator + signal. */
export function computeKlinger(
  candles: Candle[],
  fast: number,
  slow: number,
  signal: number
): { ko: LinePoint[]; signal: LinePoint[] } {
  const vf: number[] = []
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const hlc = (c.high + c.low + c.close) / 3
    const prevHlc =
      i > 0
        ? (candles[i - 1].high + candles[i - 1].low + candles[i - 1].close) / 3
        : hlc
    const trend = hlc >= prevHlc ? 1 : -1
    const dm = c.high - c.low
    vf.push(trend * c.volume * dm)
  }
  const emaFast = emaSeries(vf, Math.max(2, fast))
  const emaSlow = emaSeries(vf, Math.max(2, slow))
  const koRaw: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = 0; i < candles.length; i++) {
    if (emaFast[i] != null && emaSlow[i] != null) {
      koRaw[i] = (emaFast[i] as number) - (emaSlow[i] as number)
    }
  }
  const dense: number[] = []
  const idx: number[] = []
  for (let i = 0; i < koRaw.length; i++) {
    if (koRaw[i] != null) {
      dense.push(koRaw[i] as number)
      idx.push(i)
    }
  }
  const sig = emaSeries(dense, Math.max(2, signal))
  const sigFull: (number | null)[] = new Array(candles.length).fill(null)
  for (let j = 0; j < idx.length; j++) {
    if (sig[j] != null) sigFull[idx[j]] = sig[j]
  }
  return { ko: toPoints(candles, koRaw), signal: toPoints(candles, sigFull) }
}

/** SMI Ergodic. */
export function computeSmi(
  candles: Candle[],
  period: number,
  smooth: number,
  signal: number
): { smi: LinePoint[]; signal: LinePoint[] } {
  const n = Math.max(2, period)
  const sm = Math.max(1, smooth)
  const sg = Math.max(1, signal)
  const raw: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = n - 1; i < candles.length; i++) {
    let hi = -Infinity
    let lo = Infinity
    for (let j = i - n + 1; j <= i; j++) {
      if (candles[j].high > hi) hi = candles[j].high
      if (candles[j].low < lo) lo = candles[j].low
    }
    const mid = (hi + lo) / 2
    const diff = candles[i].close - mid
    const range = hi - lo || 1e-12
    raw[i] = (100 * diff) / (range / 2)
  }
  const dense: number[] = []
  const idx: number[] = []
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] != null) {
      dense.push(raw[i] as number)
      idx.push(i)
    }
  }
  const s1 = emaSeries(dense, sm)
  const s1nums = s1.map((v) => (v == null ? 0 : v))
  const s2 = emaSeries(s1nums, sm)
  const smiFull: (number | null)[] = new Array(candles.length).fill(null)
  for (let j = 0; j < idx.length; j++) {
    if (s2[j] != null) smiFull[idx[j]] = s2[j]
  }
  const dense2: number[] = []
  const idx2: number[] = []
  for (let i = 0; i < smiFull.length; i++) {
    if (smiFull[i] != null) {
      dense2.push(smiFull[i] as number)
      idx2.push(i)
    }
  }
  const sig = emaSeries(dense2, sg)
  const sigFull: (number | null)[] = new Array(candles.length).fill(null)
  for (let j = 0; j < idx2.length; j++) {
    if (sig[j] != null) sigFull[idx2[j]] = sig[j]
  }
  return { smi: toPoints(candles, smiFull), signal: toPoints(candles, sigFull) }
}

/** McGinley Dynamic. */
export function computeMcGinley(
  candles: Candle[],
  period: number,
  factor = 0.6,
  source: PriceSource = 'close'
): LinePoint[] {
  const n = Math.max(2, period)
  const src = sourceSeries(candles, source)
  const out: (number | null)[] = new Array(candles.length).fill(null)
  let md: number | null = null
  for (let i = 0; i < candles.length; i++) {
    const price = src[i]
    if (!Number.isFinite(price)) continue
    if (md == null) {
      md = price
      out[i] = md
      continue
    }
    const denom = n * Math.pow(price / md, factor)
    if (denom === 0) {
      out[i] = md
      continue
    }
    md = md + (price - md) / denom
    out[i] = md
  }
  return toPoints(candles, out)
}

/** Least Squares Moving Average. */
export function computeLsma(
  candles: Candle[],
  period: number,
  source: PriceSource = 'close'
): LinePoint[] {
  const n = Math.max(2, period)
  const src = sourceSeries(candles, source)
  const out: (number | null)[] = new Array(candles.length).fill(null)
  const xSum = (n * (n - 1)) / 2
  const x2Sum = (n * (n - 1) * (2 * n - 1)) / 6
  for (let i = n - 1; i < candles.length; i++) {
    let ySum = 0
    let xySum = 0
    for (let k = 0; k < n; k++) {
      const y = src[i - n + 1 + k]
      ySum += y
      xySum += k * y
    }
    const denom = n * x2Sum - xSum * xSum
    if (denom === 0) continue
    const slope = (n * xySum - xSum * ySum) / denom
    const intercept = (ySum - slope * xSum) / n
    out[i] = intercept + slope * (n - 1)
  }
  return toPoints(candles, out)
}

/** Ease of Movement (Arms). */
export function computeEom(candles: Candle[], period: number): LinePoint[] {
  const n = Math.max(1, period)
  const raw: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const p = candles[i - 1]
    const distance = (c.high + c.low) / 2 - (p.high + p.low) / 2
    const box = c.volume === 0 ? 0 : (c.high - c.low) / c.volume
    raw[i] = box === 0 ? 0 : distance / box
  }
  const dense: number[] = []
  const idx: number[] = []
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] != null) {
      dense.push(raw[i] as number)
      idx.push(i)
    }
  }
  const sm = smaSeries(dense, n)
  const full: (number | null)[] = new Array(candles.length).fill(null)
  for (let j = 0; j < idx.length; j++) full[idx[j]] = sm[j]
  return toPoints(candles, full)
}

/** Annualized historical volatility (%). */
export function computeHistVol(candles: Candle[], period: number): LinePoint[] {
  const n = Math.max(2, period)
  const rets: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = 1; i < candles.length; i++) {
    const a = candles[i - 1].close
    const b = candles[i].close
    if (a > 0 && b > 0) rets[i] = Math.log(b / a)
  }
  const out: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = n; i < candles.length; i++) {
    let sum = 0
    let sum2 = 0
    let cnt = 0
    for (let j = i - n + 1; j <= i; j++) {
      const r = rets[j]
      if (r == null) continue
      sum += r
      sum2 += r * r
      cnt++
    }
    if (cnt < 2) continue
    const mean = sum / cnt
    const var_ = sum2 / cnt - mean * mean
    out[i] = Math.sqrt(Math.max(0, var_) * 365) * 100
  }
  return toPoints(candles, out)
}
