/**
 * Pure TA from real candles – never invent OHLC.
 */

import type { Candle } from '@/types'
import type { LinePoint, PriceSource } from './types'

export function sourceSeries(candles: Candle[], source: PriceSource): number[] {
  return candles.map((c) => {
    switch (source) {
      case 'open':
        return c.open
      case 'high':
        return c.high
      case 'low':
        return c.low
      case 'hl2':
        return (c.high + c.low) / 2
      case 'hlc3':
        return (c.high + c.low + c.close) / 3
      case 'ohlc4':
        return (c.open + c.high + c.low + c.close) / 4
      default:
        return c.close
    }
  })
}

export function smaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (period < 1 || values.length < period) return out
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (period < 1 || values.length < period) return out
  const k = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  let prev = sum / period
  out[period - 1] = prev
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

export function wmaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (period < 1 || values.length < period) return out
  const denom = (period * (period + 1)) / 2
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) sum += values[i - period + 1 + j] * (j + 1)
    out[i] = sum / denom
  }
  return out
}

function toPoints(candles: Candle[], series: (number | null)[]): LinePoint[] {
  const pts: LinePoint[] = []
  for (let i = 0; i < series.length; i++) {
    const v = series[i]
    if (v == null || !Number.isFinite(v)) continue
    pts.push({ time: candles[i].time, value: v })
  }
  return pts
}

export function computeSma(candles: Candle[], period: number, source: PriceSource = 'close'): LinePoint[] {
  return toPoints(candles, smaSeries(sourceSeries(candles, source), period))
}

export function computeEma(candles: Candle[], period: number, source: PriceSource = 'close'): LinePoint[] {
  return toPoints(candles, emaSeries(sourceSeries(candles, source), period))
}

export function computeWma(candles: Candle[], period: number, source: PriceSource = 'close'): LinePoint[] {
  return toPoints(candles, wmaSeries(sourceSeries(candles, source), period))
}

export function computeHull(candles: Candle[], period: number, source: PriceSource = 'close'): LinePoint[] {
  const v = sourceSeries(candles, source)
  const half = Math.max(1, Math.floor(period / 2))
  const sqrtP = Math.max(1, Math.floor(Math.sqrt(period)))
  const wmaHalf = wmaSeries(v, half)
  const wmaFull = wmaSeries(v, period)
  const raw: (number | null)[] = v.map((_, i) => {
    if (wmaHalf[i] == null || wmaFull[i] == null) return null
    return 2 * (wmaHalf[i] as number) - (wmaFull[i] as number)
  })
  const dense: number[] = []
  const idx: number[] = []
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] != null) {
      dense.push(raw[i] as number)
      idx.push(i)
    }
  }
  const hullDense = wmaSeries(dense, sqrtP)
  const out: (number | null)[] = new Array(v.length).fill(null)
  for (let j = 0; j < idx.length; j++) out[idx[j]] = hullDense[j]
  return toPoints(candles, out)
}

export function computeDema(candles: Candle[], period: number, source: PriceSource = 'close'): LinePoint[] {
  const v = sourceSeries(candles, source)
  const e1 = emaSeries(v, period)
  const dense: number[] = []
  const idx: number[] = []
  for (let i = 0; i < e1.length; i++) {
    if (e1[i] != null) {
      dense.push(e1[i] as number)
      idx.push(i)
    }
  }
  const e2d = emaSeries(dense, period)
  const out: (number | null)[] = new Array(v.length).fill(null)
  for (let j = 0; j < idx.length; j++) {
    if (e2d[j] != null) out[idx[j]] = 2 * dense[j] - (e2d[j] as number)
  }
  return toPoints(candles, out)
}

export function computeTema(candles: Candle[], period: number, source: PriceSource = 'close'): LinePoint[] {
  const v = sourceSeries(candles, source)
  const e1 = emaSeries(v, period)
  const d1: number[] = []
  const i1: number[] = []
  for (let i = 0; i < e1.length; i++) {
    if (e1[i] != null) {
      d1.push(e1[i] as number)
      i1.push(i)
    }
  }
  const e2d = emaSeries(d1, period)
  const d2: number[] = []
  const i2: number[] = []
  for (let j = 0; j < e2d.length; j++) {
    if (e2d[j] != null) {
      d2.push(e2d[j] as number)
      i2.push(i1[j])
    }
  }
  const e3d = emaSeries(d2, period)
  const out: (number | null)[] = new Array(v.length).fill(null)
  for (let k = 0; k < e3d.length; k++) {
    if (e3d[k] == null) continue
    const e1v = d1[i1.indexOf(i2[k])]
    const e2v = d2[k]
    out[i2[k]] = 3 * e1v - 3 * e2v + (e3d[k] as number)
  }
  // simpler tema via nested
  const e2full: (number | null)[] = new Array(v.length).fill(null)
  for (let j = 0; j < i1.length; j++) if (e2d[j] != null) e2full[i1[j]] = e2d[j]
  const e3full: (number | null)[] = new Array(v.length).fill(null)
  for (let k = 0; k < i2.length; k++) if (e3d[k] != null) e3full[i2[k]] = e3d[k]
  for (let i = 0; i < v.length; i++) {
    if (e1[i] == null || e2full[i] == null || e3full[i] == null) continue
    out[i] = 3 * (e1[i] as number) - 3 * (e2full[i] as number) + (e3full[i] as number)
  }
  return toPoints(candles, out)
}

export function computeBollinger(
  candles: Candle[],
  period: number,
  mult: number,
  source: PriceSource = 'close'
): { mid: LinePoint[]; upper: LinePoint[]; lower: LinePoint[] } {
  const c = sourceSeries(candles, source)
  const midArr = smaSeries(c, period)
  const upper: LinePoint[] = []
  const lower: LinePoint[] = []
  const mid: LinePoint[] = []
  for (let i = 0; i < c.length; i++) {
    const m = midArr[i]
    if (m == null) continue
    let varSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = c[j] - m
      varSum += d * d
    }
    const sd = Math.sqrt(varSum / period)
    mid.push({ time: candles[i].time, value: m })
    upper.push({ time: candles[i].time, value: m + mult * sd })
    lower.push({ time: candles[i].time, value: m - mult * sd })
  }
  return { mid, upper, lower }
}

export function computeDonchian(
  candles: Candle[],
  period: number
): { mid: LinePoint[]; upper: LinePoint[]; lower: LinePoint[] } {
  const upper: LinePoint[] = []
  const lower: LinePoint[] = []
  const mid: LinePoint[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue
    let hi = -Infinity
    let lo = Infinity
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high)
      lo = Math.min(lo, candles[j].low)
    }
    upper.push({ time: candles[i].time, value: hi })
    lower.push({ time: candles[i].time, value: lo })
    mid.push({ time: candles[i].time, value: (hi + lo) / 2 })
  }
  return { mid, upper, lower }
}

export function computeKeltner(
  candles: Candle[],
  emaPeriod: number,
  atrPeriod: number,
  mult: number,
  source: PriceSource = 'close'
): { mid: LinePoint[]; upper: LinePoint[]; lower: LinePoint[] } {
  const mid = computeEma(candles, emaPeriod, source)
  const atr = computeAtr(candles, atrPeriod)
  const atrMap = new Map(atr.map((p) => [p.time, p.value]))
  const upper: LinePoint[] = []
  const lower: LinePoint[] = []
  for (const m of mid) {
    const a = atrMap.get(m.time)
    if (a == null) continue
    upper.push({ time: m.time, value: m.value + mult * a })
    lower.push({ time: m.time, value: m.value - mult * a })
  }
  return { mid, upper, lower }
}

export function computeSupertrend(
  candles: Candle[],
  period: number,
  mult: number
): { line: LinePoint[]; dir: LinePoint[] } {
  const atrPts = computeAtr(candles, period)
  const atrMap = new Map(atrPts.map((p) => [p.time, p.value]))
  const line: LinePoint[] = []
  const dir: LinePoint[] = []
  let prevUpper = 0
  let prevLower = 0
  let trend = 1
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const a = atrMap.get(c.time)
    if (a == null) continue
    const hl2 = (c.high + c.low) / 2
    let basicUpper = hl2 + mult * a
    let basicLower = hl2 - mult * a
    const finalUpper =
      basicUpper < prevUpper || candles[i - 1]?.close > prevUpper ? basicUpper : prevUpper
    const finalLower =
      basicLower > prevLower || candles[i - 1]?.close < prevLower ? basicLower : prevLower
    if (trend === 1) {
      if (c.close < finalLower) trend = -1
    } else {
      if (c.close > finalUpper) trend = 1
    }
    const st = trend === 1 ? finalLower : finalUpper
    line.push({ time: c.time, value: st })
    dir.push({ time: c.time, value: trend })
    prevUpper = finalUpper
    prevLower = finalLower
  }
  return { line, dir }
}

export function computeSar(
  candles: Candle[],
  step: number,
  maxStep: number
): LinePoint[] {
  if (candles.length < 2) return []
  const pts: LinePoint[] = []
  let bull = candles[1].close >= candles[0].close
  let af = step
  let ep = bull ? candles[0].high : candles[0].low
  let sar = bull ? candles[0].low : candles[0].high
  pts.push({ time: candles[0].time, value: sar })
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    sar = sar + af * (ep - sar)
    if (bull) {
      sar = Math.min(sar, candles[i - 1].low, i >= 2 ? candles[i - 2].low : candles[i - 1].low)
      if (c.low < sar) {
        bull = false
        sar = ep
        ep = c.low
        af = step
      } else if (c.high > ep) {
        ep = c.high
        af = Math.min(maxStep, af + step)
      }
    } else {
      sar = Math.max(sar, candles[i - 1].high, i >= 2 ? candles[i - 2].high : candles[i - 1].high)
      if (c.high > sar) {
        bull = true
        sar = ep
        ep = c.high
        af = step
      } else if (c.low < ep) {
        ep = c.low
        af = Math.min(maxStep, af + step)
      }
    }
    pts.push({ time: c.time, value: sar })
  }
  return pts
}

export function computeIchimoku(
  candles: Candle[],
  tenkan: number,
  kijun: number,
  senkouB: number
): {
  conversion: LinePoint[]
  base: LinePoint[]
  spanA: LinePoint[]
  spanB: LinePoint[]
} {
  const mid = (len: number, i: number) => {
    if (i < len - 1) return null
    let hi = -Infinity
    let lo = Infinity
    for (let j = i - len + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high)
      lo = Math.min(lo, candles[j].low)
    }
    return (hi + lo) / 2
  }
  const conversion: LinePoint[] = []
  const base: LinePoint[] = []
  const spanA: LinePoint[] = []
  const spanB: LinePoint[] = []
  for (let i = 0; i < candles.length; i++) {
    const t = mid(tenkan, i)
    const k = mid(kijun, i)
    if (t != null) conversion.push({ time: candles[i].time, value: t })
    if (k != null) base.push({ time: candles[i].time, value: k })
    if (t != null && k != null) {
      // plot span at current time (no forward shift – keeps LWC times valid)
      spanA.push({ time: candles[i].time, value: (t + k) / 2 })
    }
    const b = mid(senkouB, i)
    if (b != null) spanB.push({ time: candles[i].time, value: b })
  }
  return { conversion, base, spanA, spanB }
}

export function computeVwap(candles: Candle[]): LinePoint[] {
  const pts: LinePoint[] = []
  let cumPv = 0
  let cumV = 0
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3
    const v = c.volume
    if (!Number.isFinite(v) || v < 0) continue
    cumPv += typical * v
    cumV += v
    if (cumV > 0) pts.push({ time: c.time, value: cumPv / cumV })
  }
  return pts
}

export function computeVolSma(
  candles: Candle[],
  period: number
): { volume: LinePoint[]; sma: LinePoint[] } {
  const volume = candles.map((c) => ({ time: c.time, value: c.volume }))
  const vols = candles.map((c) => c.volume)
  return { volume, sma: toPoints(candles, smaSeries(vols, period)) }
}

export function computeRsi(
  candles: Candle[],
  period: number,
  source: PriceSource = 'close'
): LinePoint[] {
  const c = sourceSeries(candles, source)
  const out: (number | null)[] = new Array(c.length).fill(null)
  if (period < 1 || c.length < period + 1) return []
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = c[i] - c[i - 1]
    if (d >= 0) gain += d
    else loss -= d
  }
  let avgGain = gain / period
  let avgLoss = loss / period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1]
    const g = d > 0 ? d : 0
    const l = d < 0 ? -d : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return toPoints(candles, out)
}

export function computeMacd(
  candles: Candle[],
  fast: number,
  slow: number,
  signal: number,
  source: PriceSource = 'close'
): { macd: LinePoint[]; signal: LinePoint[]; hist: LinePoint[] } {
  const c = sourceSeries(candles, source)
  const ef = emaSeries(c, fast)
  const es = emaSeries(c, slow)
  const macdRaw: (number | null)[] = c.map((_, i) => {
    if (ef[i] == null || es[i] == null) return null
    return (ef[i] as number) - (es[i] as number)
  })
  const denseIdx: number[] = []
  const denseVal: number[] = []
  for (let i = 0; i < macdRaw.length; i++) {
    if (macdRaw[i] != null) {
      denseIdx.push(i)
      denseVal.push(macdRaw[i] as number)
    }
  }
  const sigDense = emaSeries(denseVal, signal)
  const sigFull: (number | null)[] = new Array(c.length).fill(null)
  for (let j = 0; j < denseIdx.length; j++) sigFull[denseIdx[j]] = sigDense[j]
  const hist: LinePoint[] = []
  for (let i = 0; i < c.length; i++) {
    if (macdRaw[i] == null || sigFull[i] == null) continue
    hist.push({
      time: candles[i].time,
      value: (macdRaw[i] as number) - (sigFull[i] as number),
    })
  }
  return {
    macd: toPoints(candles, macdRaw),
    signal: toPoints(candles, sigFull),
    hist,
  }
}

export function computeStoch(
  candles: Candle[],
  kPeriod: number,
  kSmooth: number,
  dPeriod: number
): { k: LinePoint[]; d: LinePoint[] } {
  const rawK: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) continue
    let hi = -Infinity
    let lo = Infinity
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high)
      lo = Math.min(lo, candles[j].low)
    }
    const range = hi - lo
    rawK[i] = range === 0 ? 50 : ((candles[i].close - lo) / range) * 100
  }
  const denseK: number[] = []
  const denseKIdx: number[] = []
  for (let i = 0; i < rawK.length; i++) {
    if (rawK[i] != null) {
      denseK.push(rawK[i] as number)
      denseKIdx.push(i)
    }
  }
  const kSmoothArr = smaSeries(denseK, Math.max(1, kSmooth))
  const kFull: (number | null)[] = new Array(candles.length).fill(null)
  for (let j = 0; j < denseKIdx.length; j++) kFull[denseKIdx[j]] = kSmoothArr[j]
  const denseD: number[] = []
  const denseDIdx: number[] = []
  for (let i = 0; i < kFull.length; i++) {
    if (kFull[i] != null) {
      denseD.push(kFull[i] as number)
      denseDIdx.push(i)
    }
  }
  const dArr = smaSeries(denseD, Math.max(1, dPeriod))
  const dFull: (number | null)[] = new Array(candles.length).fill(null)
  for (let j = 0; j < denseDIdx.length; j++) dFull[denseDIdx[j]] = dArr[j]
  return { k: toPoints(candles, kFull), d: toPoints(candles, dFull) }
}

export function computeAtr(candles: Candle[], period: number): LinePoint[] {
  if (candles.length < 2 || period < 1) return []
  const tr: number[] = [0]
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high
    const l = candles[i].low
    const pc = candles[i - 1].close
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  const out: (number | null)[] = new Array(candles.length).fill(null)
  if (tr.length < period + 1) return []
  let sum = 0
  for (let i = 1; i <= period; i++) sum += tr[i]
  let atr = sum / period
  out[period] = atr
  for (let i = period + 1; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period
    out[i] = atr
  }
  return toPoints(candles, out)
}

export function computeCci(candles: Candle[], period: number): LinePoint[] {
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3)
  const sma = smaSeries(tp, period)
  const out: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = 0; i < candles.length; i++) {
    if (sma[i] == null) continue
    let mad = 0
    for (let j = i - period + 1; j <= i; j++) mad += Math.abs(tp[j] - (sma[i] as number))
    mad /= period
    out[i] = mad === 0 ? 0 : (tp[i] - (sma[i] as number)) / (0.015 * mad)
  }
  return toPoints(candles, out)
}

export function computeWillR(candles: Candle[], period: number): LinePoint[] {
  const out: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue
    let hi = -Infinity
    let lo = Infinity
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high)
      lo = Math.min(lo, candles[j].low)
    }
    const range = hi - lo
    out[i] = range === 0 ? -50 : ((hi - candles[i].close) / range) * -100
  }
  return toPoints(candles, out)
}

export function computeMomentum(
  candles: Candle[],
  period: number,
  source: PriceSource = 'close'
): LinePoint[] {
  const v = sourceSeries(candles, source)
  const out: (number | null)[] = new Array(v.length).fill(null)
  for (let i = period; i < v.length; i++) out[i] = v[i] - v[i - period]
  return toPoints(candles, out)
}

export function computeRoc(
  candles: Candle[],
  period: number,
  source: PriceSource = 'close'
): LinePoint[] {
  const v = sourceSeries(candles, source)
  const out: (number | null)[] = new Array(v.length).fill(null)
  for (let i = period; i < v.length; i++) {
    if (v[i - period] === 0) continue
    out[i] = ((v[i] - v[i - period]) / v[i - period]) * 100
  }
  return toPoints(candles, out)
}

export function computeObv(candles: Candle[]): LinePoint[] {
  const pts: LinePoint[] = []
  let obv = 0
  for (let i = 0; i < candles.length; i++) {
    if (i > 0) {
      if (candles[i].close > candles[i - 1].close) obv += candles[i].volume
      else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume
    }
    pts.push({ time: candles[i].time, value: obv })
  }
  return pts
}

export function computeMfi(candles: Candle[], period: number): LinePoint[] {
  const out: (number | null)[] = new Array(candles.length).fill(null)
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3)
  const rawMF = candles.map((c, i) => tp[i] * c.volume)
  for (let i = period; i < candles.length; i++) {
    let pos = 0
    let neg = 0
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) pos += rawMF[j]
      else if (tp[j] < tp[j - 1]) neg += rawMF[j]
    }
    out[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg)
  }
  return toPoints(candles, out)
}

export function computeAdx(
  candles: Candle[],
  period: number
): { adx: LinePoint[]; plusDI: LinePoint[]; minusDI: LinePoint[] } {
  if (candles.length < period + 2) return { adx: [], plusDI: [], minusDI: [] }
  const plusDM: number[] = [0]
  const minusDM: number[] = [0]
  const tr: number[] = [0]
  for (let i = 1; i < candles.length; i++) {
    const up = candles[i].high - candles[i - 1].high
    const down = candles[i - 1].low - candles[i].low
    plusDM.push(up > down && up > 0 ? up : 0)
    minusDM.push(down > up && down > 0 ? down : 0)
    const h = candles[i].high
    const l = candles[i].low
    const pc = candles[i - 1].close
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  const smooth = (arr: number[]) => {
    const out: (number | null)[] = new Array(arr.length).fill(null)
    let sum = 0
    for (let i = 1; i <= period; i++) sum += arr[i]
    out[period] = sum
    for (let i = period + 1; i < arr.length; i++) {
      out[i] = (out[i - 1] as number) - (out[i - 1] as number) / period + arr[i]
    }
    return out
  }
  const str = smooth(tr)
  const sPlus = smooth(plusDM)
  const sMinus = smooth(minusDM)
  const plusDI: (number | null)[] = new Array(candles.length).fill(null)
  const minusDI: (number | null)[] = new Array(candles.length).fill(null)
  const dx: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = 0; i < candles.length; i++) {
    if (str[i] == null || (str[i] as number) === 0) continue
    const pdi = (100 * (sPlus[i] as number)) / (str[i] as number)
    const mdi = (100 * (sMinus[i] as number)) / (str[i] as number)
    plusDI[i] = pdi
    minusDI[i] = mdi
    const sum = pdi + mdi
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum
  }
  const adxArr: (number | null)[] = new Array(candles.length).fill(null)
  let seed = 0
  let count = 0
  const start = period * 2
  for (let i = period; i < start && i < dx.length; i++) {
    if (dx[i] != null) {
      seed += dx[i] as number
      count++
    }
  }
  if (count > 0 && start < candles.length) {
    adxArr[start - 1] = seed / count
    for (let i = start; i < candles.length; i++) {
      if (dx[i] == null || adxArr[i - 1] == null) continue
      adxArr[i] = ((adxArr[i - 1] as number) * (period - 1) + (dx[i] as number)) / period
    }
  }
  return {
    adx: toPoints(candles, adxArr),
    plusDI: toPoints(candles, plusDI),
    minusDI: toPoints(candles, minusDI),
  }
}

export function levelLine(candles: Candle[], level: number): LinePoint[] {
  if (candles.length === 0) return []
  return [
    { time: candles[0].time, value: level },
    { time: candles[candles.length - 1].time, value: level },
  ]
}
