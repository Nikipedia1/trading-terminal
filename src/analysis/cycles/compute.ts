/**
 * Cyclic analysis from real OHLCV only.
 * Dominant + secondary period (autocorrelation), bandpass, phase, amplitude,
 * STC, weekday seasonality, projected turning points, FLD, spectrum peaks.
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
    sum += arr[i]!
    if (i >= period) sum -= arr[i - period]!
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
        for (let j = i - period + 1; j <= i; j++) s += arr[j]!
        prev = s / period
        out[i] = prev
      }
    } else {
      prev = arr[i]! * k + prev * (1 - k)
      out[i] = prev
    }
  }
  return out
}

function detrend(closes: number[], smooth: number): number[] {
  const trend = sma(closes, Math.max(2, smooth))
  return closes.map((c, i) => (trend[i] != null ? c - (trend[i] as number) : 0))
}

/** Median price (hl2) shifted forward by half-period — Hurst FLD. */
export function computeFld(
  highs: number[],
  lows: number[],
  times: number[],
  period: number,
  barDurationSec: number
): { points: { time: number; value: number }[]; lastValue: number | null } {
  const n = highs.length
  if (n < 3 || period < 2) return { points: [], lastValue: null }
  const shift = Math.max(1, Math.floor(period / 2))
  const med = highs.map((h, i) => (h + lows[i]!) / 2)
  const points: { time: number; value: number }[] = []
  for (let i = 0; i < n; i++) {
    const ti = i + shift
    if (ti < n) points.push({ time: times[ti]!, value: med[i]! })
  }
  const lastT = times[n - 1]!
  for (let k = 0; k < shift; k++) {
    points.push({
      time: lastT + (k + 1) * barDurationSec,
      value: med[Math.max(0, n - shift + k)] ?? med[n - 1]!,
    })
  }
  const lastValue =
    points.length > 0
      ? points.reduce((a, p) => (p.time <= lastT ? p : a), points[0]!).value
      : null
  return { points, lastValue }
}

/** Autocorrelation strength curve → top peaks for spectrum view. */
export function spectrumPeaks(
  closes: number[],
  minP: number,
  maxP: number,
  topN = 8
): { period: number; strength: number }[] {
  const n = closes.length
  const minPeriod = Math.max(3, Math.floor(minP))
  const maxPeriod = Math.min(Math.floor(maxP), Math.floor(n / 3))
  if (n < minPeriod * 3 || maxPeriod <= minPeriod) return []

  const smooth = Math.max(5, Math.floor(maxPeriod / 2))
  const trend: number[] = new Array(n).fill(0)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += closes[i]!
    if (i >= smooth) sum -= closes[i - smooth]!
    trend[i] = i >= smooth - 1 ? sum / smooth : closes[i]!
  }
  const det = closes.map((c, i) => c - trend[i]!)
  let mean = 0
  for (const v of det) mean += v
  mean /= n
  let varSum = 0
  for (const v of det) {
    const d = v - mean
    varSum += d * d
  }
  if (varSum < 1e-12) return []

  const scores: { period: number; strength: number }[] = []
  for (let p = minPeriod; p <= maxPeriod; p++) {
    let num = 0
    let count = 0
    for (let i = 0; i + p < n; i++) {
      num += (det[i]! - mean) * (det[i + p]! - mean)
      count++
    }
    if (count < 3) continue
    const ac = num / (count * (varSum / n))
    scores.push({ period: p, strength: Math.max(0, Math.min(1, ac)) })
  }
  scores.sort((a, b) => b.strength - a.strength)
  const picked: { period: number; strength: number }[] = []
  for (const s of scores) {
    if (picked.some((q) => Math.abs(q.period - s.period) / s.period < 0.15)) continue
    picked.push(s)
    if (picked.length >= topN) break
  }
  return picked
}

export function dominantPeriod(
  closes: number[],
  minP: number,
  maxP: number,
  excludeAround?: number
): { period: number; strength: number } {
  const peaks = spectrumPeaks(closes, minP, maxP, 12)
  if (!peaks.length) return { period: Math.max(3, Math.floor(minP)), strength: 0 }
  if (excludeAround == null || excludeAround <= 0) return peaks[0]!
  for (const p of peaks) {
    if (Math.abs(p.period - excludeAround) / Math.max(1, excludeAround) > 0.2) return p
  }
  return peaks[0]!
}

export function bandpassCycle(closes: number[], period: number): number[] {
  const n = closes.length
  const out = new Array(n).fill(0)
  if (period < 2) return out
  const hp = Math.max(2, Math.floor(period / 2))
  const lp = Math.max(hp + 1, period)
  const fast = ema(closes, hp)
  const slow = ema(closes, lp)
  for (let i = 0; i < n; i++) {
    if (fast[i] != null && slow[i] != null) out[i] = (fast[i] as number) - (slow[i] as number)
  }
  return out
}

export function cyclePhase(cycle: number[]): number[] {
  const n = cycle.length
  const out = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    const y = cycle[i]!
    const x = cycle[i]! - cycle[i - 1]!
    let deg = (Math.atan2(y, x) * 180) / Math.PI
    if (deg < 0) deg += 360
    out[i] = deg
  }
  return out
}

export function cycleAmplitude(cycle: number[], period: number): number[] {
  const n = cycle.length
  const out = new Array(n).fill(0)
  const win = Math.max(3, Math.floor(period))
  for (let i = 0; i < n; i++) {
    let s = 0
    let c = 0
    for (let j = Math.max(0, i - win + 1); j <= i; j++) {
      s += cycle[j]! * cycle[j]!
      c++
    }
    out[i] = c > 0 ? Math.sqrt(s / c) : 0
  }
  return out
}

export function schaffTrendCycle(
  closes: number[],
  cycleLen = 23,
  ma1 = 50,
  ma2 = 10
): number[] {
  const n = closes.length
  const out = new Array(n).fill(50)
  if (n < cycleLen + ma1) return out
  const macd = bandpassCycle(closes, cycleLen)
  const stoch: number[] = new Array(n).fill(50)
  for (let i = 0; i < n; i++) {
    let lo = macd[i]!
    let hi = macd[i]!
    for (let j = Math.max(0, i - cycleLen + 1); j <= i; j++) {
      lo = Math.min(lo, macd[j]!)
      hi = Math.max(hi, macd[j]!)
    }
    stoch[i] = hi !== lo ? ((macd[i]! - lo) / (hi - lo)) * 100 : 50
  }
  const f1 = ema(stoch, ma1)
  const f2 = ema(
    f1.map((v) => v ?? 50),
    ma2
  )
  for (let i = 0; i < n; i++) out[i] = f2[i] ?? 50
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
    const a = candles[i - 1]!
    const b = candles[i]!
    if (!(a.close > 0)) continue
    const pct = ((b.close - a.close) / a.close) * 100
    const dow = new Date(b.time * 1000).getUTCDay()
    buckets[dow]!.sum += pct
    buckets[dow]!.n += 1
  }
  return buckets.map((b, dow) => ({
    dow,
    avgPct: b.n ? b.sum / b.n : 0,
    samples: b.n,
  }))
}

function inferBarDuration(times: number[]): number {
  if (times.length < 2) return 3600
  const gaps: number[] = []
  for (let i = 1; i < Math.min(times.length, 50); i++) {
    const d = times[i]! - times[i - 1]!
    if (d > 0) gaps.push(d)
  }
  if (!gaps.length) return 3600
  gaps.sort((a, b) => a - b)
  return gaps[Math.floor(gaps.length / 2)]!
}

function toPts(times: number[], values: (number | null)[] | number[]): CyclePoint[] {
  const out: CyclePoint[] = []
  for (let i = 0; i < times.length; i++) {
    const v = values[i]
    if (v == null || !Number.isFinite(v as number)) continue
    out.push({ time: times[i]!, value: v as number })
  }
  return out
}

function projectTurns(
  lastTime: number,
  lastPhase: number,
  period: number,
  barDurationSec: number
) {
  const phaseToHigh = (360 - (lastPhase % 360)) % 360
  const phaseToLow = (180 - (lastPhase % 360) + 360) % 360
  const barsHigh = (phaseToHigh / 360) * period
  const barsLow = (phaseToLow / 360) * period
  const nextHighTime = lastTime + barsHigh * barDurationSec
  const nextLowTime = lastTime + barsLow * barDurationSec
  const barsToNextTurn = Math.min(barsHigh, barsLow)
  const nextTurnKind: 'high' | 'low' = barsHigh <= barsLow ? 'high' : 'low'
  return {
    nextHighTime,
    nextLowTime,
    barsToNextTurn: Math.round(barsToNextTurn),
    nextTurnKind,
  }
}

export function computeCycleModel(
  candles: Candle[],
  config: CycleConfig = DEFAULT_CYCLE_CONFIG
): CycleModel {
  const empty: CycleModel = {
    period: 0,
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
    fld: [],
    fld2: [],
    fldBias: null,
    spectrum: [],
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
    trendArr[i] != null ? (trendArr[i] as number) + cycleRaw[i]! : null
  )
  const wave2Arr: (number | null)[] = closes.map((_, i) =>
    trendArr[i] != null ? (trendArr[i] as number) + cycle2Raw[i]! : null
  )
  const ampUpperArr: (number | null)[] = closes.map((_, i) =>
    trendArr[i] != null ? (trendArr[i] as number) + ampRaw[i]! : null
  )
  const ampLowerArr: (number | null)[] = closes.map((_, i) =>
    trendArr[i] != null ? (trendArr[i] as number) - ampRaw[i]! : null
  )
  const phaseArr = cyclePhase(cycleRaw)
  const stcArr = schaffTrendCycle(closes, 23, 50, Math.max(5, Math.floor(period / 2)))

  const cycleHighTimes: number[] = []
  const cycleLowTimes: number[] = []
  for (let i = 2; i < phaseArr.length; i++) {
    const p0 = phaseArr[i - 1]!
    const p1 = phaseArr[i]!
    if (p0 > 300 && p1 < 60) cycleHighTimes.push(times[i]!)
    if (p0 < 180 && p1 >= 180 && p0 > 90) cycleLowTimes.push(times[i]!)
  }

  const lastPhase = phaseArr[phaseArr.length - 1] ?? 0
  const lastAmp = ampRaw[ampRaw.length - 1] ?? 0
  const lastTime = times[times.length - 1]!
  const proj = projectTurns(lastTime, lastPhase, period, barDurationSec)

  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const fldPrimary = computeFld(highs, lows, times, period, barDurationSec)
  const fldSecondary =
    secondaryPeriod > 0
      ? computeFld(highs, lows, times, secondaryPeriod, barDurationSec)
      : { points: [] as { time: number; value: number }[], lastValue: null as number | null }

  let fldBias: 'bull' | 'bear' | 'flat' | null = null
  if (fldPrimary.lastValue != null) {
    const lastClose = closes[closes.length - 1]!
    const d = lastClose - fldPrimary.lastValue
    const thr = Math.abs(fldPrimary.lastValue) * 0.0005
    fldBias = d > thr ? 'bull' : d < -thr ? 'bear' : 'flat'
  }

  const spectrum = spectrumPeaks(closes, config.minPeriod, config.maxPeriod, 8)

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
    fld: fldPrimary.points,
    fld2: fldSecondary.points,
    fldBias,
    spectrum,
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
