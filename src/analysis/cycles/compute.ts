/**
 * Cyclic analysis from real OHLCV only.
 * Dominant period via autocorrelation; bandpass cycle; phase; STC; weekday seasonality.
 * Never invents bars – empty input → empty model.
 */

import type { Candle } from '@/types'
import type { CycleConfig, CycleModel, CyclePoint } from './types'
import { DEFAULT_CYCLE_CONFIG } from './types'

function sma(arr: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(arr.length).fill(null)
  if (period < 1) return out
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i >= period) sum -= arr[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function ema(arr: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(arr.length).fill(null)
  if (period < 1 || arr.length === 0) return out
  const k = 2 / (period + 1)
  let prev: number | null = null
  for (let i = 0; i < arr.length; i++) {
    if (prev == null) {
      if (i >= period - 1) {
        let s = 0
        for (let j = i - period + 1; j <= i; j++) s += arr[j]
        prev = s / period
        out[i] = prev
      }
    } else {
      prev = arr[i] * k + prev * (1 - k)
      out[i] = prev
    }
  }
  return out
}

/** Detrend closes with SMA of half max period. */
function detrend(closes: number[], smooth: number): number[] {
  const trend = sma(closes, Math.max(2, smooth))
  return closes.map((c, i) => (trend[i] != null ? c - (trend[i] as number) : 0))
}

/**
 * Autocorrelation dominant period on detrended series.
 * Returns period in [minP, maxP] and normalized peak strength.
 */
export function dominantPeriod(
  closes: number[],
  minP: number,
  maxP: number
): { period: number; strength: number } {
  const n = closes.length
  const minPeriod = Math.max(3, Math.floor(minP))
  const maxPeriod = Math.min(Math.floor(maxP), Math.floor(n / 3))
  if (n < minPeriod * 3 || maxPeriod <= minPeriod) {
    return { period: minPeriod, strength: 0 }
  }
  const det = detrend(closes, Math.max(5, Math.floor(maxPeriod / 2)))
  // mean/var of det for normalization
  let mean = 0
  for (const v of det) mean += v
  mean /= n
  let varSum = 0
  for (const v of det) {
    const d = v - mean
    varSum += d * d
  }
  if (varSum < 1e-18) return { period: minPeriod, strength: 0 }

  let bestLag = minPeriod
  let bestCorr = -Infinity
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    let num = 0
    let c = 0
    for (let i = lag; i < n; i++) {
      num += (det[i] - mean) * (det[i - lag] - mean)
      c++
    }
    if (c < lag) continue
    const corr = num / varSum
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }
  const strength = Math.max(0, Math.min(1, bestCorr))
  return { period: bestLag, strength }
}

/**
 * Simple 2-pole bandpass (Ehlers-inspired public form) centered on period.
 * Output mean-reverting cycle component.
 */
export function bandpassCycle(closes: number[], period: number): number[] {
  const out = new Array(closes.length).fill(0)
  if (period < 2 || closes.length < 4) return out
  const bandwidth = 0.35
  const beta = Math.cos((2 * Math.PI) / period)
  const gamma = 1 / Math.cos((2 * Math.PI * bandwidth) / period)
  const alpha = gamma - Math.sqrt(gamma * gamma - 1)
  // HP then bandpass cascade (simplified)
  const hp: number[] = new Array(closes.length).fill(0)
  for (let i = 2; i < closes.length; i++) {
    hp[i] =
      0.5 * (1 + alpha) * (closes[i] - closes[i - 1]) +
      alpha * hp[i - 1]
  }
  for (let i = 2; i < closes.length; i++) {
    out[i] =
      0.5 * (1 - alpha) * (hp[i] - hp[i - 1]) +
      beta * (1 + alpha) * out[i - 1] -
      alpha * out[i - 2]
  }
  return out
}

/** Phase in degrees from cycle series using analytic signal (Hilbert-like diff). */
export function cyclePhase(cycle: number[]): number[] {
  const phase = new Array(cycle.length).fill(0)
  for (let i = 1; i < cycle.length; i++) {
    const re = cycle[i]
    const im = cycle[i] - cycle[i - 1]
    let deg = (Math.atan2(im, re) * 180) / Math.PI
    if (deg < 0) deg += 360
    phase[i] = deg
  }
  return phase
}

/**
 * Schaff Trend Cycle (STC) – public formula on MACD-like basis, scaled 0–100.
 */
export function schaffTrendCycle(
  closes: number[],
  fast = 23,
  slow = 50,
  cycleLen = 10
): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  const ef = ema(closes, fast)
  const es = ema(closes, slow)
  const macd: (number | null)[] = closes.map((_, i) =>
    ef[i] != null && es[i] != null ? (ef[i] as number) - (es[i] as number) : null
  )
  // First stochastic of MACD
  const st1: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = 0; i < closes.length; i++) {
    if (macd[i] == null) continue
    let hi = -Infinity
    let lo = Infinity
    let ok = true
    for (let j = Math.max(0, i - cycleLen + 1); j <= i; j++) {
      if (macd[j] == null) {
        ok = false
        break
      }
      hi = Math.max(hi, macd[j] as number)
      lo = Math.min(lo, macd[j] as number)
    }
    if (!ok || hi === lo) continue
    st1[i] = 100 * (((macd[i] as number) - lo) / (hi - lo))
  }
  // Smooth st1
  const pf: (number | null)[] = new Array(closes.length).fill(null)
  let prevPf: number | null = null
  for (let i = 0; i < closes.length; i++) {
    if (st1[i] == null) continue
    prevPf = prevPf == null ? (st1[i] as number) : prevPf + 0.5 * ((st1[i] as number) - prevPf)
    pf[i] = prevPf
  }
  // Second stochastic
  for (let i = 0; i < closes.length; i++) {
    if (pf[i] == null) continue
    let hi = -Infinity
    let lo = Infinity
    let ok = true
    for (let j = Math.max(0, i - cycleLen + 1); j <= i; j++) {
      if (pf[j] == null) {
        ok = false
        break
      }
      hi = Math.max(hi, pf[j] as number)
      lo = Math.min(lo, pf[j] as number)
    }
    if (!ok || hi === lo) continue
    const raw = 100 * (((pf[i] as number) - lo) / (hi - lo))
    out[i] = raw
  }
  // Final smooth
  let prev: number | null = null
  for (let i = 0; i < out.length; i++) {
    if (out[i] == null) continue
    prev = prev == null ? (out[i] as number) : prev + 0.5 * ((out[i] as number) - prev)
    out[i] = prev
  }
  return out
}

export function weekdaySeasonality(
  candles: Candle[]
): { dow: number; avgPct: number; samples: number }[] {
  const buckets: { sum: number; n: number }[] = Array.from({ length: 7 }, () => ({
    sum: 0,
    n: 0,
  }))
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close
    if (prev === 0) continue
    const ret = ((candles[i].close - prev) / prev) * 100
    const dow = new Date(candles[i].time * 1000).getUTCDay()
    buckets[dow].sum += ret
    buckets[dow].n += 1
  }
  return buckets.map((b, dow) => ({
    dow,
    avgPct: b.n > 0 ? b.sum / b.n : 0,
    samples: b.n,
  }))
}

function toPts(times: number[], values: (number | null)[] | number[]): CyclePoint[] {
  const pts: CyclePoint[] = []
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v == null || !Number.isFinite(v as number)) continue
    pts.push({ time: times[i], value: v as number })
  }
  return pts
}

/** Full cycle model from candles + config. */
export function computeCycleModel(
  candles: Candle[],
  config: CycleConfig = DEFAULT_CYCLE_CONFIG
): CycleModel {
  const empty: CycleModel = {
    period: config.minPeriod,
    periodSource: 'auto',
    strength: 0,
    phaseDeg: 0,
    phase: [],
    cycle: [],
    trend: [],
    wave: [],
    stc: [],
    cycleHighTimes: [],
    cycleLowTimes: [],
    weekdayReturns: [],
    barCount: candles.length,
    ready: false,
  }
  if (candles.length < Math.max(30, config.minPeriod * 3)) return empty

  const closes = candles.map((c) => c.close)
  const times = candles.map((c) => c.time)

  let period: number
  let strength: number
  let periodSource: 'auto' | 'fixed'
  if (config.fixedPeriod >= config.minPeriod) {
    period = Math.floor(config.fixedPeriod)
    strength = 1
    periodSource = 'fixed'
  } else {
    const d = dominantPeriod(closes, config.minPeriod, config.maxPeriod)
    period = d.period
    strength = d.strength
    periodSource = 'auto'
  }

  const cycleRaw = bandpassCycle(closes, period)
  const trendArr = sma(closes, period)
  const waveArr: (number | null)[] = closes.map((_, i) =>
    trendArr[i] != null ? (trendArr[i] as number) + cycleRaw[i] : null
  )
  const phaseArr = cyclePhase(cycleRaw)
  const stcArr = schaffTrendCycle(closes, 23, 50, Math.max(5, Math.floor(period / 2)))

  const cycleHighTimes: number[] = []
  const cycleLowTimes: number[] = []
  for (let i = 2; i < phaseArr.length; i++) {
    const p0 = phaseArr[i - 1]
    const p1 = phaseArr[i]
    // crossing near 0° (cycle high region for price often lagging)
    if (p0 > 300 && p1 < 60) cycleHighTimes.push(times[i])
    // crossing near 180°
    if (p0 < 180 && p1 >= 180 && p0 > 90) cycleLowTimes.push(times[i])
  }

  const lastPhase = phaseArr[phaseArr.length - 1] ?? 0

  return {
    period,
    periodSource,
    strength,
    phaseDeg: lastPhase,
    phase: toPts(times, phaseArr),
    cycle: toPts(times, cycleRaw),
    trend: toPts(times, trendArr),
    wave: toPts(times, waveArr),
    stc: toPts(times, stcArr),
    cycleHighTimes,
    cycleLowTimes,
    weekdayReturns: config.showSeasonality ? weekdaySeasonality(candles) : [],
    barCount: candles.length,
    ready: true,
  }
}
