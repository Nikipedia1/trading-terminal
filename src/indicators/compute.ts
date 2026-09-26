/**
 * Pure TA from real candles – never invent OHLC.
 * Returns sparse series (only defined points); callers map to chart times.
 */

import type { Candle } from '@/types'
import type { LinePoint } from './types'

function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close)
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

function toPoints(candles: Candle[], series: (number | null)[]): LinePoint[] {
  const pts: LinePoint[] = []
  for (let i = 0; i < series.length; i++) {
    const v = series[i]
    if (v == null || !Number.isFinite(v)) continue
    pts.push({ time: candles[i].time, value: v })
  }
  return pts
}

export function computeSma(candles: Candle[], period: number): LinePoint[] {
  return toPoints(candles, smaSeries(closes(candles), period))
}

export function computeEma(candles: Candle[], period: number): LinePoint[] {
  return toPoints(candles, emaSeries(closes(candles), period))
}

export function computeBollinger(
  candles: Candle[],
  period: number,
  mult: number
): { mid: LinePoint[]; upper: LinePoint[]; lower: LinePoint[] } {
  const c = closes(candles)
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

/** Cumulative VWAP over the loaded candle window (not exchange session clock). */
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

export function computeRsi(candles: Candle[], period: number): LinePoint[] {
  const c = closes(candles)
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
  signal: number
): { macd: LinePoint[]; signal: LinePoint[]; hist: LinePoint[] } {
  const c = closes(candles)
  const ef = emaSeries(c, fast)
  const es = emaSeries(c, slow)
  const macdRaw: (number | null)[] = c.map((_, i) => {
    if (ef[i] == null || es[i] == null) return null
    return (ef[i] as number) - (es[i] as number)
  })
  // EMA of MACD for signal – skip nulls by building dense then map back
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
  for (let j = 0; j < denseIdx.length; j++) {
    sigFull[denseIdx[j]] = sigDense[j]
  }
  const macd = toPoints(candles, macdRaw)
  const signalLine = toPoints(candles, sigFull)
  const hist: LinePoint[] = []
  for (let i = 0; i < c.length; i++) {
    if (macdRaw[i] == null || sigFull[i] == null) continue
    hist.push({
      time: candles[i].time,
      value: (macdRaw[i] as number) - (sigFull[i] as number),
    })
  }
  return { macd, signal: signalLine, hist }
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
  const kSm = smaSeries(
    rawK.map((v) => (v == null ? NaN : v)),
    kSmooth
  )
  // smaSeries with NaN is bad – rebuild from dense
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
  for (let j = 0; j < denseKIdx.length; j++) {
    kFull[denseKIdx[j]] = kSmoothArr[j]
  }
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
  for (let j = 0; j < denseDIdx.length; j++) {
    dFull[denseDIdx[j]] = dArr[j]
  }
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
