/** Additional professional indicators - real OHLCV only. */

import type { Candle } from '@/types'
import type { LinePoint, PriceSource } from './types'
import {
  sourceSeries,
  smaSeries,
  emaSeries,
  computeEma,
  computeAtr,
} from './compute'

function toPoints(candles: Candle[], series: (number | null)[]): LinePoint[] {
  const pts: LinePoint[] = []
  for (let i = 0; i < series.length; i++) {
    const v = series[i]
    if (v == null || !Number.isFinite(v)) continue
    pts.push({ time: candles[i].time, value: v })
  }
  return pts
}

export function computeVwma(
  candles: Candle[],
  period: number,
  source: PriceSource = 'close'
): LinePoint[] {
  const v = sourceSeries(candles, source)
  const out: (number | null)[] = new Array(v.length).fill(null)
  for (let i = period - 1; i < v.length; i++) {
    let pv = 0
    let vol = 0
    for (let j = i - period + 1; j <= i; j++) {
      pv += v[j] * candles[j].volume
      vol += candles[j].volume
    }
    out[i] = vol > 0 ? pv / vol : null
  }
  return toPoints(candles, out)
}

/** ALMA - offset in [0,1], sigma typically 6 */
export function computeAlma(
  candles: Candle[],
  period: number,
  offset: number,
  sigma: number,
  source: PriceSource = 'close'
): LinePoint[] {
  const v = sourceSeries(candles, source)
  const out: (number | null)[] = new Array(v.length).fill(null)
  if (period < 2) return []
  const m = offset * (period - 1)
  const s = period / sigma
  const weights: number[] = []
  let wSum = 0
  for (let i = 0; i < period; i++) {
    const w = Math.exp(-((i - m) * (i - m)) / (2 * s * s))
    weights.push(w)
    wSum += w
  }
  for (let i = period - 1; i < v.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) sum += v[i - period + 1 + j] * weights[j]
    out[i] = sum / wSum
  }
  return toPoints(candles, out)
}

export function computeEnvelope(
  candles: Candle[],
  period: number,
  pct: number,
  source: PriceSource = 'close'
): { mid: LinePoint[]; upper: LinePoint[]; lower: LinePoint[] } {
  const midArr = smaSeries(sourceSeries(candles, source), period)
  const mid: LinePoint[] = []
  const upper: LinePoint[] = []
  const lower: LinePoint[] = []
  const f = pct / 100
  for (let i = 0; i < candles.length; i++) {
    const m = midArr[i]
    if (m == null) continue
    mid.push({ time: candles[i].time, value: m })
    upper.push({ time: candles[i].time, value: m * (1 + f) })
    lower.push({ time: candles[i].time, value: m * (1 - f) })
  }
  return { mid, upper, lower }
}

export function computeStdDev(
  candles: Candle[],
  period: number,
  source: PriceSource = 'close'
): LinePoint[] {
  const c = sourceSeries(candles, source)
  const mid = smaSeries(c, period)
  const out: (number | null)[] = new Array(c.length).fill(null)
  for (let i = 0; i < c.length; i++) {
    if (mid[i] == null) continue
    let varSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = c[j] - (mid[i] as number)
      varSum += d * d
    }
    out[i] = Math.sqrt(varSum / period)
  }
  return toPoints(candles, out)
}

export function computeAo(candles: Candle[], fast: number, slow: number): LinePoint[] {
  const median = candles.map((c) => (c.high + c.low) / 2)
  const f = smaSeries(median, fast)
  const s = smaSeries(median, slow)
  const out: (number | null)[] = median.map((_, i) =>
    f[i] != null && s[i] != null ? (f[i] as number) - (s[i] as number) : null
  )
  return toPoints(candles, out)
}

export function computeTrix(
  candles: Candle[],
  period: number,
  source: PriceSource = 'close'
): LinePoint[] {
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
  const e2 = emaSeries(d1, period)
  const d2: number[] = []
  const i2: number[] = []
  for (let j = 0; j < e2.length; j++) {
    if (e2[j] != null) {
      d2.push(e2[j] as number)
      i2.push(i1[j])
    }
  }
  const e3 = emaSeries(d2, period)
  const full: (number | null)[] = new Array(v.length).fill(null)
  for (let k = 0; k < e3.length; k++) {
    if (e3[k] != null) full[i2[k]] = e3[k]
  }
  const out: (number | null)[] = new Array(v.length).fill(null)
  for (let i = 1; i < full.length; i++) {
    if (full[i] == null || full[i - 1] == null || (full[i - 1] as number) === 0) continue
    out[i] = (100 * ((full[i] as number) - (full[i - 1] as number))) / (full[i - 1] as number)
  }
  return toPoints(candles, out)
}

export function computePpo(
  candles: Candle[],
  fast: number,
  slow: number,
  signal: number,
  source: PriceSource = 'close'
): { ppo: LinePoint[]; signal: LinePoint[]; hist: LinePoint[] } {
  const c = sourceSeries(candles, source)
  const ef = emaSeries(c, fast)
  const es = emaSeries(c, slow)
  const ppoRaw: (number | null)[] = c.map((_, i) => {
    if (ef[i] == null || es[i] == null || (es[i] as number) === 0) return null
    return (100 * ((ef[i] as number) - (es[i] as number))) / (es[i] as number)
  })
  const dense: number[] = []
  const idx: number[] = []
  for (let i = 0; i < ppoRaw.length; i++) {
    if (ppoRaw[i] != null) {
      dense.push(ppoRaw[i] as number)
      idx.push(i)
    }
  }
  const sigD = emaSeries(dense, signal)
  const sigFull: (number | null)[] = new Array(c.length).fill(null)
  for (let j = 0; j < idx.length; j++) sigFull[idx[j]] = sigD[j]
  const hist: LinePoint[] = []
  for (let i = 0; i < c.length; i++) {
    if (ppoRaw[i] == null || sigFull[i] == null) continue
    hist.push({ time: candles[i].time, value: (ppoRaw[i] as number) - (sigFull[i] as number) })
  }
  return { ppo: toPoints(candles, ppoRaw), signal: toPoints(candles, sigFull), hist }
}

export function computeAroon(
  candles: Candle[],
  period: number
): { up: LinePoint[]; down: LinePoint[] } {
  const up: LinePoint[] = []
  const down: LinePoint[] = []
  for (let i = period; i < candles.length; i++) {
    let hi = -Infinity
    let lo = Infinity
    let hiBars = 0
    let loBars = 0
    for (let j = 0; j <= period; j++) {
      const c = candles[i - j]
      if (c.high >= hi) {
        hi = c.high
        hiBars = j
      }
      if (c.low <= lo) {
        lo = c.low
        loBars = j
      }
    }
    up.push({ time: candles[i].time, value: (100 * (period - hiBars)) / period })
    down.push({ time: candles[i].time, value: (100 * (period - loBars)) / period })
  }
  return { up, down }
}

export function computeDpo(
  candles: Candle[],
  period: number,
  source: PriceSource = 'close'
): LinePoint[] {
  const v = sourceSeries(candles, source)
  const sma = smaSeries(v, period)
  const shift = Math.floor(period / 2) + 1
  const out: (number | null)[] = new Array(v.length).fill(null)
  for (let i = 0; i < v.length; i++) {
    const j = i + shift
    if (j >= v.length || sma[j] == null) continue
    out[i] = v[i] - (sma[j] as number)
  }
  return toPoints(candles, out)
}

export function computeCmf(candles: Candle[], period: number): LinePoint[] {
  const out: (number | null)[] = new Array(candles.length).fill(null)
  const mfv = candles.map((c) => {
    const range = c.high - c.low
    if (range === 0) return 0
    return (((c.close - c.low) - (c.high - c.close)) / range) * c.volume
  })
  for (let i = period - 1; i < candles.length; i++) {
    let sumMfv = 0
    let sumVol = 0
    for (let j = i - period + 1; j <= i; j++) {
      sumMfv += mfv[j]
      sumVol += candles[j].volume
    }
    out[i] = sumVol === 0 ? 0 : sumMfv / sumVol
  }
  return toPoints(candles, out)
}

export function computeAdl(candles: Candle[]): LinePoint[] {
  const pts: LinePoint[] = []
  let adl = 0
  for (const c of candles) {
    const range = c.high - c.low
    const mfm = range === 0 ? 0 : ((c.close - c.low) - (c.high - c.close)) / range
    adl += mfm * c.volume
    pts.push({ time: c.time, value: adl })
  }
  return pts
}

export function computeForce(candles: Candle[], period: number): LinePoint[] {
  const raw: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = 1; i < candles.length; i++) {
    raw[i] = (candles[i].close - candles[i - 1].close) * candles[i].volume
  }
  const dense: number[] = []
  const idx: number[] = []
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] != null) {
      dense.push(raw[i] as number)
      idx.push(i)
    }
  }
  const ema = emaSeries(dense, period)
  const out: (number | null)[] = new Array(candles.length).fill(null)
  for (let j = 0; j < idx.length; j++) out[idx[j]] = ema[j]
  return toPoints(candles, out)
}

export function computeElderRay(
  candles: Candle[],
  period: number
): { bull: LinePoint[]; bear: LinePoint[] } {
  const ema = computeEma(candles, period, 'close')
  const emaMap = new Map(ema.map((p) => [p.time, p.value]))
  const bull: LinePoint[] = []
  const bear: LinePoint[] = []
  for (const c of candles) {
    const e = emaMap.get(c.time)
    if (e == null) continue
    bull.push({ time: c.time, value: c.high - e })
    bear.push({ time: c.time, value: c.low - e })
  }
  return { bull, bear }
}

export function computeUo(
  candles: Candle[],
  p1: number,
  p2: number,
  p3: number
): LinePoint[] {
  if (candles.length < 2) return []
  const bp: number[] = [0]
  const tr: number[] = [0]
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const prev = candles[i - 1]
    const trueLow = Math.min(c.low, prev.close)
    const trueHigh = Math.max(c.high, prev.close)
    bp.push(c.close - trueLow)
    tr.push(trueHigh - trueLow)
  }
  const avg = (arr: number[], period: number, i: number) => {
    let s = 0
    for (let j = i - period + 1; j <= i; j++) s += arr[j]
    return s
  }
  const out: (number | null)[] = new Array(candles.length).fill(null)
  const maxP = Math.max(p1, p2, p3)
  for (let i = maxP; i < candles.length; i++) {
    const a1 = avg(bp, p1, i) / (avg(tr, p1, i) || 1)
    const a2 = avg(bp, p2, i) / (avg(tr, p2, i) || 1)
    const a3 = avg(bp, p3, i) / (avg(tr, p3, i) || 1)
    out[i] = 100 * ((4 * a1 + 2 * a2 + a3) / 7)
  }
  return toPoints(candles, out)
}

export function computeCmo(
  candles: Candle[],
  period: number,
  source: PriceSource = 'close'
): LinePoint[] {
  const v = sourceSeries(candles, source)
  const out: (number | null)[] = new Array(v.length).fill(null)
  for (let i = period; i < v.length; i++) {
    let up = 0
    let down = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = v[j] - v[j - 1]
      if (d > 0) up += d
      else down -= d
    }
    const sum = up + down
    out[i] = sum === 0 ? 0 : (100 * (up - down)) / sum
  }
  return toPoints(candles, out)
}

export function computeRvi(
  candles: Candle[],
  period: number,
  signal: number
): { rvi: LinePoint[]; signal: LinePoint[] } {
  const num: number[] = []
  const den: number[] = []
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    num.push(c.close - c.open)
    den.push(c.high - c.low || 1e-12)
  }
  const rviRaw: (number | null)[] = new Array(candles.length).fill(null)
  for (let i = 3; i < candles.length; i++) {
    const n =
      (num[i] + 2 * num[i - 1] + 2 * num[i - 2] + num[i - 3]) / 6
    const d =
      (den[i] + 2 * den[i - 1] + 2 * den[i - 2] + den[i - 3]) / 6
    rviRaw[i] = d === 0 ? 0 : n / d
  }
  const dense: number[] = []
  const idx: number[] = []
  for (let i = 0; i < rviRaw.length; i++) {
    if (rviRaw[i] != null) {
      dense.push(rviRaw[i] as number)
      idx.push(i)
    }
  }
  const sm = smaSeries(dense, period)
  const rviFull: (number | null)[] = new Array(candles.length).fill(null)
  for (let j = 0; j < idx.length; j++) rviFull[idx[j]] = sm[j]
  const dense2: number[] = []
  const idx2: number[] = []
  for (let i = 0; i < rviFull.length; i++) {
    if (rviFull[i] != null) {
      dense2.push(rviFull[i] as number)
      idx2.push(i)
    }
  }
  const sig = smaSeries(dense2, signal)
  const sigFull: (number | null)[] = new Array(candles.length).fill(null)
  for (let j = 0; j < idx2.length; j++) sigFull[idx2[j]] = sig[j]
  return { rvi: toPoints(candles, rviFull), signal: toPoints(candles, sigFull) }
}

/** Classic floor pivots from prior bar. */
export function computePivots(candles: Candle[]): {
  p: LinePoint[]
  r1: LinePoint[]
  r2: LinePoint[]
  s1: LinePoint[]
  s2: LinePoint[]
} {
  const p: LinePoint[] = []
  const r1: LinePoint[] = []
  const r2: LinePoint[] = []
  const s1: LinePoint[] = []
  const s2: LinePoint[] = []
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]
    const pp = (prev.high + prev.low + prev.close) / 3
    const r1v = 2 * pp - prev.low
    const s1v = 2 * pp - prev.high
    const r2v = pp + (prev.high - prev.low)
    const s2v = pp - (prev.high - prev.low)
    const t = candles[i].time
    p.push({ time: t, value: pp })
    r1.push({ time: t, value: r1v })
    r2.push({ time: t, value: r2v })
    s1.push({ time: t, value: s1v })
    s2.push({ time: t, value: s2v })
  }
  return { p, r1, r2, s1, s2 }
}

export function lastValue(pts: LinePoint[]): number | null {
  if (pts.length === 0) return null
  const v = pts[pts.length - 1].value
  return Number.isFinite(v) ? v : null
}
