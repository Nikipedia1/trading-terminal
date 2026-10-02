/**
 * Cyclic analysis from real OHLCV only.
 * Dominant + secondary period (autocorrelation), bandpass, phase, amplitude,
 * STC, weekday seasonality, projected turning points.
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

function detrend(closes: number[], smooth: number): number[] {
  const trend = sma(closes, Math.max(2, smooth))
  return closes.map((c, i) => (trend[i] != null ? c - (trend[i] as number) : 0))
}

export function dominantPeriod(
  closes: number[],
  minP: number,
  maxP: number,
  excludeAround?: number
): { period: number; strength: number } {
  const n = closes.length
  const minPeriod = Math.max(3, Math.floor(minP))
  const maxPeriod = Math.min(Math.floor(maxP), Math.floor(n / 3))
  if (n < minPeriod * 3 || maxPeriod <= minPeriod) {
    return { period: minPeriod, strength: 0 }
  }
  const det = detrend(closes, Math.max(5, Math.floor(maxPeriod / 2)))
  let mean = 0
  for (const v of det) mean += v
  mean /= n
  let varSum = 0
  for (const v of det) {
    const d = v - mean
    varSum += d * d
  }
  if (varSum < 1e-18) return { period: minPeriod, strength: 0 }

  const excludeHalf = excludeAround != null ? Math.max(2, Math.floor(excludeAround * 0.25)) : 0

  let bestLag = minPeriod
  let bestCorr = -Infinity
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    if (excludeAround != null && Math.abs(lag - excludeAround) <= excludeHalf) continue
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

export function bandpassCycle(closes: number[], period: number): number[] {
  const out = new Array(closes.length).fill(0)
  if (period < 2 || closes.length < 4) return out
  const bandwidth = 0.35
  const beta = Math.cos((2 * Math.PI) / period)
  const gamma = 1 / Math.cos((2 * Math.PI * bandwidth) / period)
  const alpha = gamma - Math.sqrt(gamma * gamma - 1)
  const hp: number[] = new Array(closes.length).fill(0)
  for (let i = 2; i < closes.length; i++) {
    hp[i] =
      0.5 * (1 + alpha) * (closes[i] - closes[i - 1]) + alpha * hp[i - 1]
  }
  for (let i = 2; i < closes.length; i++) {
    out[i] =
      0.5 * (1 - alpha) * (hp[i] - hp[i - 1]) +
      beta * (1 + alpha) * out[i - 1] -
      alpha * out[i - 2]
  }
  return out
}

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

export function cycleAmplitude(cycle: number[], period: number): number[] {
  const out = new Array(cycle.length).fill(0)
  const win = Math.max(3, Math.floor(period / 2))
  for (let i = 0; i < cycle.length; i++) {
    let sumSq = 0
    let c = 0
    const from = Math.max(0, i - win + 1)
    for (let j = from; j <= i; j++) {
      sumSq += cycle[j] * cycle[j]
      c++
    }
    out[i] = c > 0 ? Math.sqrt(sumSq / c) : 0
  }
  return out
}

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
  const pf: (number | null)[] = new Array(closes.length).fill(null)
  let prevPf: number | null = null
  for (let i = 0; i < closes.length; i++) {
    if (st1[i] == null) continue
    prevPf = prevPf == null ? (st1[i] as number) : prevPf + 0.5 * ((st1[i] as number) - prevPf)
    pf[i] = prevPf
  }
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
    out[i] = 100 * (((pf[i] as number) - lo) / (hi - lo))
  }
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

function inferBarDuration(times: number[]): number {
  if (times.length < 2) return 3600
  const n = times.length
  return Math.max(1, times[n - 1] - times[n - 2])
}

function projectTurns(
  lastTime: number,
  phaseDeg: number,
  period: number,
  barDur: number
): {
  nextHighTime: number | null
  nextLowTime: number | null
  barsToNextTurn: number | null
  nextTurnKind: 'high' | 'low' | null
} {
  if (period < 2 || barDur <= 0) {
    return { nextHighTime: null, nextLowTime: null, barsToNextTurn: null, nextTurnKind: null }
  }
  const toHigh = phaseDeg <= 0 ? 0 : (360 - phaseDeg) / 360
  const toLow = phaseDeg <= 180 ? (180 - phaseDeg) / 360 : (540 - phaseDeg) / 360
  const barsHigh = toHigh * period
  const barsLow = toLow * period
  const nextHighTime = lastTime + barsHigh * barDur
  const nextLowTime = lastTime + barsLow * barDur
  if (barsHigh <= barsLow) {
    return {
      nextHighTime,
      nextLowTime,
      barsToNextTurn: Math.max(0, barsHigh),
      nextTurnKind: 'high',
    }
  }
  return {
    nextHighTime,
    nextLowTime,
    barsToNextTurn: Math.max(0, barsLow),
    nextTurnKind: 'low',
  }
}

export function computeCycleModel(
  candles: Candle[],
  config: CycleConfig = DEFAULT_CYCLE_CONFIG
): CycleModel {
  const empty: CycleModel = {
    period: config.minPeriod,
    periodSource: 'auto',
    strength: 0,
    secondaryPeriod: 0,
    secondaryStrength: 0,
    phaseDeg: 0,
    amplitude: 0,
    phase: [],
    cycle: [],
    cycle2: [],
    trend: [],
    wave: [],
    wave2: [],
    ampUpper: [],
    ampLower: [],
    stc: [],
    cycleHighTimes: [],
    cycleLowTimes: [],
    nextHighTime: null,
    nextLowTime: null,
    barsToNextTurn: null,
    nextTurnKind: null,
    weekdayReturns: [],
    barCount: candles.length,
    barDurationSec: 3600,
    ready: false,
  }
  if (candles.length < Math.max(30, config.minPeriod * 3)) return empty

  const closes = candles.map((c) => c.close)
  const times = candles.map((c) => c.time)
  const barDurationSec = inferBarDuration(times)

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

  const sec = dominantPeriod(closes, config.minPeriod, config.maxPeriod, period)
  const secondaryPeriod = sec.strength > 0.08 && sec.period !== period ? sec.period : 0
  const secondaryStrength = secondaryPeriod > 0 ? sec.strength : 0

  const cycleRaw = bandpassCycle(closes, period)
  const cycle2Raw =
    secondaryPeriod > 0 ? bandpassCycle(closes, secondaryPeriod) : new Array(closes.length).fill(0)
  const ampRaw = cycleAmplitude(cycleRaw, period)
  const trendArr = sma(closes, period)
  const waveArr: (number | null)[] = closes.map((_, i) =>
    trendArr[i] != null ? (trendArr[i] as number) + cycleRaw[i] : null
  )
  const wave2Arr: (number | null)[] = closes.map((_, i) =>
    trendArr[i] != null ? (trendArr[i] as number) + cycle2Raw[i] : null
  )
  const ampUpperArr: (number | null)[] = closes.map((_, i) =>
    trendArr[i] != null ? (trendArr[i] as number) + ampRaw[i] : null
  )
  const ampLowerArr: (number | null)[] = closes.map((_, i) =>
    trendArr[i] != null ? (trendArr[i] as number) - ampRaw[i] : null
  )
  const phaseArr = cyclePhase(cycleRaw)
  const stcArr = schaffTrendCycle(closes, 23, 50, Math.max(5, Math.floor(period / 2)))

  const cycleHighTimes: number[] = []
  const cycleLowTimes: number[] = []
  for (let i = 2; i < phaseArr.length; i++) {
    const p0 = phaseArr[i - 1]
    const p1 = phaseArr[i]
    if (p0 > 300 && p1 < 60) cycleHighTimes.push(times[i])
    if (p0 < 180 && p1 >= 180 && p0 > 90) cycleLowTimes.push(times[i])
  }

  const lastPhase = phaseArr[phaseArr.length - 1] ?? 0
  const lastAmp = ampRaw[ampRaw.length - 1] ?? 0
  const lastTime = times[times.length - 1]
  const proj = projectTurns(lastTime, lastPhase, period, barDurationSec)

  return {
    period,
    periodSource,
    strength,
    secondaryPeriod,
    secondaryStrength,
    phaseDeg: lastPhase,
    amplitude: lastAmp,
    phase: toPts(times, phaseArr),
    cycle: toPts(times, cycleRaw),
    cycle2: secondaryPeriod > 0 ? toPts(times, cycle2Raw) : [],
    trend: toPts(times, trendArr),
    wave: toPts(times, waveArr),
    wave2: secondaryPeriod > 0 ? toPts(times, wave2Arr) : [],
    ampUpper: toPts(times, ampUpperArr),
    ampLower: toPts(times, ampLowerArr),
    stc: toPts(times, stcArr),
    cycleHighTimes,
    cycleLowTimes,
    nextHighTime: proj.nextHighTime,
    nextLowTime: proj.nextLowTime,
    barsToNextTurn: proj.barsToNextTurn,
    nextTurnKind: proj.nextTurnKind,
    weekdayReturns: config.showSeasonality ? weekdaySeasonality(candles) : [],
    barCount: candles.length,
    barDurationSec,
    ready: true,
  }
}
