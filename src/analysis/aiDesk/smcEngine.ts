/**
 * Smart Money Concepts + Volume Profile from real candles.
 * FVG, Order Blocks, BOS/CHoCH, fixed-range volume profile.
 */

import type { Candle } from '@/types'
import type { Drawing } from '@/drawings/types'
import { createDrawingId, defaultStyle } from '@/drawings/types'

export interface FvgZone {
  kind: 'bullish' | 'bearish'
  top: number
  bottom: number
  startTime: number
  endTime: number
  midIndex: number
  mitigated: boolean
}

export interface OrderBlock {
  kind: 'bullish' | 'bearish'
  top: number
  bottom: number
  time: number
  endTime: number
  index: number
}

export interface StructureBreak {
  kind: 'bos' | 'choch'
  direction: 'bullish' | 'bearish'
  price: number
  time: number
}

export interface VolumeProfile {
  bins: { price: number; volume: number }[]
  poc: number
  vah: number
  val: number
  totalVolume: number
  startTime: number
  endTime: number
}

export interface SmcReport {
  fvgs: FvgZone[]
  orderBlocks: OrderBlock[]
  breaks: StructureBreak[]
  volumeProfile: VolumeProfile | null
  summary: string[]
}

/** 3-candle Fair Value Gap */
export function detectFvgs(candles: Candle[], lookback = 120): FvgZone[] {
  const start = Math.max(1, candles.length - lookback)
  const out: FvgZone[] = []
  for (let i = start; i < candles.length - 1; i++) {
    const c0 = candles[i - 1]
    const c1 = candles[i]
    const c2 = candles[i + 1]
    // Bullish FVG: gap between c0.high and c2.low
    if (c2.low > c0.high) {
      out.push({
        kind: 'bullish',
        top: c2.low,
        bottom: c0.high,
        startTime: c0.time,
        endTime: c2.time,
        midIndex: i,
        mitigated: false,
      })
    }
    // Bearish FVG: gap between c0.low and c2.high
    if (c2.high < c0.low) {
      out.push({
        kind: 'bearish',
        top: c0.low,
        bottom: c2.high,
        startTime: c0.time,
        endTime: c2.time,
        midIndex: i,
        mitigated: false,
      })
    }
  }

  // Mitigation: later candle closes through zone
  for (const z of out) {
    for (let j = z.midIndex + 2; j < candles.length; j++) {
      const c = candles[j]
      if (z.kind === 'bullish' && c.low <= z.bottom) {
        z.mitigated = true
        z.endTime = c.time
        break
      }
      if (z.kind === 'bearish' && c.high >= z.top) {
        z.mitigated = true
        z.endTime = c.time
        break
      }
    }
    if (!z.mitigated) {
      z.endTime = candles[candles.length - 1].time
    }
  }

  // Keep recent unmitigated + last few mitigated
  const unmit = out.filter((z) => !z.mitigated).slice(-8)
  const mit = out.filter((z) => z.mitigated).slice(-4)
  return [...unmit, ...mit]
}

/**
 * Order block: last opposing candle before impulsive move.
 * Bullish OB: last down/bearish candle before strong up move.
 * Bearish OB: last up/bullish candle before strong down move.
 */
export function detectOrderBlocks(candles: Candle[], lookback = 100): OrderBlock[] {
  if (candles.length < 10) return []
  const start = Math.max(2, candles.length - lookback)
  const out: OrderBlock[] = []
  const last = candles[candles.length - 1]

  for (let i = start; i < candles.length - 3; i++) {
    const c = candles[i]
    const body = Math.abs(c.close - c.open)
    const range = c.high - c.low || 1e-12
    // Impulse after: next 2–3 bars move strongly away
    const next = candles.slice(i + 1, i + 4)
    if (next.length < 2) continue
    const moveUp = next[next.length - 1].close - c.high
    const moveDown = c.low - next[next.length - 1].close
    const avgRange =
      next.reduce((s, x) => s + (x.high - x.low), 0) / next.length || range

    // Bearish candle + strong up = bullish OB
    if (c.close < c.open && moveUp > avgRange * 1.2) {
      out.push({
        kind: 'bullish',
        top: c.high,
        bottom: c.low,
        time: c.time,
        endTime: last.time,
        index: i,
      })
    }
    // Bullish candle + strong down = bearish OB
    if (c.close > c.open && moveDown > avgRange * 1.2) {
      out.push({
        kind: 'bearish',
        top: c.high,
        bottom: c.low,
        time: c.time,
        endTime: last.time,
        index: i,
      })
    }
  }

  // Prefer recent, limit duplicates by price proximity
  const filtered: OrderBlock[] = []
  for (const ob of out.reverse()) {
    const near = filtered.some(
      (f) =>
        f.kind === ob.kind &&
        Math.abs((f.top + f.bottom) / 2 - (ob.top + ob.bottom) / 2) /
          ((ob.top + ob.bottom) / 2) <
          0.003
    )
    if (!near) filtered.push(ob)
    if (filtered.length >= 6) break
  }
  return filtered.reverse()
}

function swingHighsLows(candles: Candle[], left = 2, right = 2) {
  const highs: { i: number; price: number; time: number }[] = []
  const lows: { i: number; price: number; time: number }[] = []
  for (let i = left; i < candles.length - right; i++) {
    let isH = true
    let isL = true
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue
      if (candles[j].high >= candles[i].high) isH = false
      if (candles[j].low <= candles[i].low) isL = false
    }
    if (isH) highs.push({ i, price: candles[i].high, time: candles[i].time })
    if (isL) lows.push({ i, price: candles[i].low, time: candles[i].time })
  }
  return { highs, lows }
}

/** Simple BOS / CHoCH from swing structure */
export function detectStructureBreaks(candles: Candle[]): StructureBreak[] {
  const { highs, lows } = swingHighsLows(candles)
  const out: StructureBreak[] = []
  if (highs.length < 2 || lows.length < 2) return out

  // Track last broken levels
  let lastBias: 'bullish' | 'bearish' | null = null
  const n = Math.min(highs.length, lows.length)
  for (let k = 1; k < n; k++) {
    const h1 = highs[highs.length - n + k - 1]
    const h2 = highs[highs.length - n + k]
    const l1 = lows[lows.length - n + k - 1]
    const l2 = lows[lows.length - n + k]

    if (h2.price > h1.price && l2.price > l1.price) {
      const kind = lastBias === 'bearish' ? 'choch' : 'bos'
      out.push({
        kind,
        direction: 'bullish',
        price: h1.price,
        time: h2.time,
      })
      lastBias = 'bullish'
    } else if (h2.price < h1.price && l2.price < l1.price) {
      const kind = lastBias === 'bullish' ? 'choch' : 'bos'
      out.push({
        kind,
        direction: 'bearish',
        price: l1.price,
        time: l2.time,
      })
      lastBias = 'bearish'
    }
  }
  return out.slice(-6)
}

/** Fixed-range volume profile from candle volume distributed across HL range */
export function buildVolumeProfile(
  candles: Candle[],
  bins = 24,
  lookback = 80
): VolumeProfile | null {
  if (candles.length < 10) return null
  const slice = candles.slice(-lookback)
  const hi = Math.max(...slice.map((c) => c.high))
  const lo = Math.min(...slice.map((c) => c.low))
  if (hi <= lo) return null
  const step = (hi - lo) / bins
  const vol = new Array(bins).fill(0)

  for (const c of slice) {
    const mid = (c.high + c.low) / 2
    let idx = Math.floor((mid - lo) / step)
    if (idx < 0) idx = 0
    if (idx >= bins) idx = bins - 1
    // weight volume across bins touched by bar range
    const i0 = Math.max(0, Math.floor((c.low - lo) / step))
    const i1 = Math.min(bins - 1, Math.floor((c.high - lo) / step))
    const span = i1 - i0 + 1
    const vEach = c.volume / span
    for (let i = i0; i <= i1; i++) vol[i] += vEach
  }

  const totalVolume = vol.reduce((s, v) => s + v, 0)
  let pocIdx = 0
  for (let i = 1; i < bins; i++) if (vol[i] > vol[pocIdx]) pocIdx = i

  // Value area ~70% of volume around POC
  let vaVol = vol[pocIdx]
  let loI = pocIdx
  let hiI = pocIdx
  const target = totalVolume * 0.7
  while (vaVol < target && (loI > 0 || hiI < bins - 1)) {
    const expandLo = loI > 0 ? vol[loI - 1] : -1
    const expandHi = hiI < bins - 1 ? vol[hiI + 1] : -1
    if (expandHi >= expandLo && hiI < bins - 1) {
      hiI++
      vaVol += vol[hiI]
    } else if (loI > 0) {
      loI--
      vaVol += vol[loI]
    } else if (hiI < bins - 1) {
      hiI++
      vaVol += vol[hiI]
    } else break
  }

  const priceOf = (i: number) => lo + (i + 0.5) * step
  return {
    bins: vol.map((v, i) => ({ price: priceOf(i), volume: v })),
    poc: priceOf(pocIdx),
    vah: lo + (hiI + 1) * step,
    val: lo + loI * step,
    totalVolume,
    startTime: slice[0].time,
    endTime: slice[slice.length - 1].time,
  }
}

export function analyzeSmc(candles: Candle[]): SmcReport {
  const fvgs = detectFvgs(candles)
  const orderBlocks = detectOrderBlocks(candles)
  const breaks = detectStructureBreaks(candles)
  const volumeProfile = buildVolumeProfile(candles)
  const summary: string[] = []
  summary.push(
    `FVG: ${fvgs.filter((z) => !z.mitigated).length} open · ${fvgs.filter((z) => z.mitigated).length} mitigated`
  )
  summary.push(`Order blocks: ${orderBlocks.length}`)
  if (breaks.length) {
    const last = breaks[breaks.length - 1]
    summary.push(`Last structure: ${last.kind.toUpperCase()} ${last.direction} @ ${last.price.toFixed(4)}`)
  }
  if (volumeProfile) {
    summary.push(
      `VP POC ${volumeProfile.poc.toFixed(4)} · VAL ${volumeProfile.val.toFixed(4)} · VAH ${volumeProfile.vah.toFixed(4)}`
    )
  }
  return { fvgs, orderBlocks, breaks, volumeProfile, summary }
}

export interface SmcDrawOptions {
  fvg: boolean
  orderBlock: boolean
  bos: boolean
  volumeProfile: boolean
  onlyUnmitigatedFvg?: boolean
}

export const DEFAULT_SMC_OPTS: SmcDrawOptions = {
  fvg: true,
  orderBlock: true,
  bos: true,
  volumeProfile: true,
  onlyUnmitigatedFvg: true,
}

export function smcToDrawings(report: SmcReport, opts: SmcDrawOptions): Drawing[] {
  const now = Date.now()
  const drawings: Drawing[] = []

  if (opts.fvg) {
    const list = opts.onlyUnmitigatedFvg
      ? report.fvgs.filter((z) => !z.mitigated)
      : report.fvgs
    for (const z of list.slice(-6)) {
      const bull = z.kind === 'bullish'
      drawings.push({
        id: createDrawingId(),
        tool: 'rectangle',
        p1: { time: z.startTime, price: z.bottom },
        p2: { time: z.endTime, price: z.top },
        style: defaultStyle({
          color: bull ? '#0ecb81' : '#f6465d',
          lineWidth: 1,
          fillOpacity: z.mitigated ? 0.06 : 0.15,
          lineStyle: z.mitigated ? 'dotted' : 'solid',
        }),
        createdAt: now,
        updatedAt: now,
      })
      drawings.push({
        id: createDrawingId(),
        tool: 'text',
        point: { time: z.startTime, price: (z.top + z.bottom) / 2 },
        text: `FVG ${bull ? '▲' : '▼'}${z.mitigated ? ' mit' : ''}`,
        style: defaultStyle({
          color: bull ? '#0ecb81' : '#f6465d',
          fontSize: 10,
        }),
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  if (opts.orderBlock) {
    for (const ob of report.orderBlocks.slice(-5)) {
      const bull = ob.kind === 'bullish'
      drawings.push({
        id: createDrawingId(),
        tool: 'rectangle',
        p1: { time: ob.time, price: ob.bottom },
        p2: { time: ob.endTime, price: ob.top },
        style: defaultStyle({
          color: bull ? '#26a69a' : '#ef5350',
          lineWidth: 1.5,
          fillOpacity: 0.2,
          lineStyle: 'solid',
        }),
        createdAt: now,
        updatedAt: now,
      })
      drawings.push({
        id: createDrawingId(),
        tool: 'text',
        point: { time: ob.time, price: ob.top },
        text: bull ? 'OB▲' : 'OB▼',
        style: defaultStyle({
          color: bull ? '#26a69a' : '#ef5350',
          fontSize: 10,
        }),
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  if (opts.bos) {
    for (const b of report.breaks.slice(-4)) {
      drawings.push({
        id: createDrawingId(),
        tool: 'horizontal',
        price: b.price,
        style: defaultStyle({
          color: b.direction === 'bullish' ? '#5b8def' : '#e91e63',
          lineWidth: 1,
          lineStyle: b.kind === 'choch' ? 'dashed' : 'dotted',
        }),
        createdAt: now,
        updatedAt: now,
      })
      drawings.push({
        id: createDrawingId(),
        tool: 'text',
        point: { time: b.time, price: b.price },
        text: `${b.kind.toUpperCase()} ${b.direction === 'bullish' ? '▲' : '▼'}`,
        style: defaultStyle({
          color: b.direction === 'bullish' ? '#5b8def' : '#e91e63',
          fontSize: 10,
        }),
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  if (opts.volumeProfile && report.volumeProfile) {
    const vp = report.volumeProfile
    const levels: { price: number; label: string; color: string }[] = [
      { price: vp.poc, label: 'POC', color: '#f0b90b' },
      { price: vp.vah, label: 'VAH', color: '#f6465d' },
      { price: vp.val, label: 'VAL', color: '#0ecb81' },
    ]
    for (const lv of levels) {
      drawings.push({
        id: createDrawingId(),
        tool: 'horizontal',
        price: lv.price,
        style: defaultStyle({
          color: lv.color,
          lineWidth: lv.label === 'POC' ? 2 : 1,
          lineStyle: lv.label === 'POC' ? 'solid' : 'dashed',
        }),
        createdAt: now,
        updatedAt: now,
      })
      drawings.push({
        id: createDrawingId(),
        tool: 'text',
        point: { time: vp.endTime, price: lv.price },
        text: `${lv.label} ${lv.price.toFixed(2)}`,
        style: defaultStyle({ color: lv.color, fontSize: 10 }),
        createdAt: now,
        updatedAt: now,
      })
    }
    // Light histogram as small horizontal segments via rectangles at bin prices
    const maxV = Math.max(...vp.bins.map((b) => b.volume), 1)
    const t0 = vp.startTime
    const t1 = vp.endTime
    const span = Math.max(1, t1 - t0)
    for (const bin of vp.bins) {
      if (bin.volume < maxV * 0.15) continue
      const widthT = t0 + span * (0.08 + 0.35 * (bin.volume / maxV))
      const half = (vp.vah - vp.val) / (vp.bins.length * 2) || bin.price * 0.0002
      drawings.push({
        id: createDrawingId(),
        tool: 'rectangle',
        p1: { time: t0, price: bin.price - half },
        p2: { time: widthT, price: bin.price + half },
        style: defaultStyle({
          color: '#848e9c',
          lineWidth: 0.5,
          fillOpacity: 0.25,
          lineStyle: 'solid',
        }),
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  return drawings
}
