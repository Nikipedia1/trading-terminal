/**
 * Local technical analysis – real candle data only.
 * Produces levels + suggested drawings for the chart.
 */

import type { Candle } from '@/types'
import type { Drawing, LogicalPoint } from '@/drawings/types'
import { createDrawingId, defaultStyle } from '@/drawings/types'

export interface SwingPoint {
  time: number
  price: number
  kind: 'high' | 'low'
  index: number
}

export interface TaReport {
  symbol: string
  interval: string
  bias: 'bullish' | 'bearish' | 'neutral'
  summary: string[]
  supports: number[]
  resistances: number[]
  swings: SwingPoint[]
  trend: { slope: number; from: LogicalPoint; to: LogicalPoint } | null
  fib: { high: number; low: number; levels: { ratio: number; price: number }[] } | null
  last: { open: number; high: number; low: number; close: number; time: number } | null
  rangePos: number // 0–100 position in recent range
}

function pivotHigh(c: Candle[], i: number, left: number, right: number): boolean {
  const p = c[i].high
  for (let j = i - left; j <= i + right; j++) {
    if (j === i || j < 0 || j >= c.length) continue
    if (c[j].high >= p) return false
  }
  return true
}

function pivotLow(c: Candle[], i: number, left: number, right: number): boolean {
  const p = c[i].low
  for (let j = i - left; j <= i + right; j++) {
    if (j === i || j < 0 || j >= c.length) continue
    if (c[j].low <= p) return false
  }
  return true
}

export function findSwings(candles: Candle[], left = 3, right = 3): SwingPoint[] {
  const out: SwingPoint[] = []
  for (let i = left; i < candles.length - right; i++) {
    if (pivotHigh(candles, i, left, right)) {
      out.push({ time: candles[i].time, price: candles[i].high, kind: 'high', index: i })
    }
    if (pivotLow(candles, i, left, right)) {
      out.push({ time: candles[i].time, price: candles[i].low, kind: 'low', index: i })
    }
  }
  return out
}

/** Cluster nearby prices into S/R zones */
function clusterLevels(prices: number[], tolerancePct: number): number[] {
  if (!prices.length) return []
  const sorted = [...prices].sort((a, b) => a - b)
  const clusters: number[][] = []
  for (const p of sorted) {
    const last = clusters[clusters.length - 1]
    if (!last) {
      clusters.push([p])
      continue
    }
    const mid = last.reduce((s, x) => s + x, 0) / last.length
    if (Math.abs(p - mid) / mid <= tolerancePct) last.push(p)
    else clusters.push([p])
  }
  return clusters
    .map((c) => c.reduce((s, x) => s + x, 0) / c.length)
    .sort((a, b) => a - b)
}

export function analyzeCandles(
  candles: Candle[],
  symbol: string,
  interval: string
): TaReport {
  if (candles.length < 20) {
    return {
      symbol,
      interval,
      bias: 'neutral',
      summary: ['Not enough candles for analysis (need ≥20).'],
      supports: [],
      resistances: [],
      swings: [],
      trend: null,
      fib: null,
      last: null,
      rangePos: 50,
    }
  }

  const swings = findSwings(candles)
  const last = candles[candles.length - 1]
  const recent = candles.slice(-80)
  const hi = Math.max(...recent.map((c) => c.high))
  const lo = Math.min(...recent.map((c) => c.low))
  const rangePos = hi > lo ? ((last.close - lo) / (hi - lo)) * 100 : 50

  const highs = swings.filter((s) => s.kind === 'high').map((s) => s.price)
  const lows = swings.filter((s) => s.kind === 'low').map((s) => s.price)
  const tol = 0.004 // 0.4%
  const resLevels = clusterLevels(
    highs.filter((p) => p > last.close),
    tol
  ).slice(-4)
  const supLevels = clusterLevels(
    lows.filter((p) => p < last.close),
    tol
  )
    .slice(0, 4)
    .reverse()

  // Simple trend: last two swing lows or highs
  const swingLows = swings.filter((s) => s.kind === 'low')
  const swingHighs = swings.filter((s) => s.kind === 'high')
  let trend: TaReport['trend'] = null
  let bias: TaReport['bias'] = 'neutral'

  if (swingLows.length >= 2) {
    const a = swingLows[swingLows.length - 2]
    const b = swingLows[swingLows.length - 1]
    const slope = (b.price - a.price) / Math.max(1, b.time - a.time)
    trend = {
      slope,
      from: { time: a.time, price: a.price },
      to: { time: b.time, price: b.price },
    }
    if (b.price > a.price && last.close > b.price) bias = 'bullish'
    else if (b.price < a.price && last.close < b.price) bias = 'bearish'
  }

  // HH/HL vs LH/LL
  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const h1 = swingHighs[swingHighs.length - 2].price
    const h2 = swingHighs[swingHighs.length - 1].price
    const l1 = swingLows[swingLows.length - 2].price
    const l2 = swingLows[swingLows.length - 1].price
    if (h2 > h1 && l2 > l1) bias = 'bullish'
    else if (h2 < h1 && l2 < l1) bias = 'bearish'
  }

  // Fib from recent swing high/low
  let fib: TaReport['fib'] = null
  if (swingHighs.length && swingLows.length) {
    const sh = swingHighs[swingHighs.length - 1]
    const sl = swingLows[swingLows.length - 1]
    const high = Math.max(sh.price, sl.price)
    const low = Math.min(sh.price, sl.price)
    const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
    fib = {
      high,
      low,
      levels: ratios.map((r) => ({
        ratio: r,
        price: high - (high - low) * r,
      })),
    }
  }

  const summary: string[] = []
  summary.push(
    `Price ${last.close.toFixed(4)} · range pos ${rangePos.toFixed(0)}% of last ~80 bars`
  )
  summary.push(`Structure bias: ${bias.toUpperCase()}`)
  if (supLevels.length) {
    summary.push(`Supports: ${supLevels.map((p) => p.toFixed(4)).join(' · ')}`)
  }
  if (resLevels.length) {
    summary.push(`Resistances: ${resLevels.map((p) => p.toFixed(4)).join(' · ')}`)
  }
  if (trend) {
    summary.push(
      `Trendline swing lows: ${trend.from.price.toFixed(4)} → ${trend.to.price.toFixed(4)} (${trend.slope > 0 ? 'rising' : 'falling'})`
    )
  }
  if (fib) {
    const near = fib.levels.reduce((best, l) =>
      Math.abs(l.price - last.close) < Math.abs(best.price - last.close) ? l : best
    )
    summary.push(
      `Fib nearest ${(near.ratio * 100).toFixed(1)}% @ ${near.price.toFixed(4)}`
    )
  }
  summary.push(`Swings detected: ${swings.length} (L=${3}/R=${3} pivots)`)

  return {
    symbol,
    interval,
    bias,
    summary,
    supports: supLevels,
    resistances: resLevels,
    swings,
    trend,
    fib,
    last: {
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      time: last.time,
    },
    rangePos,
  }
}

/** Build Drawing objects from TA report for primary chart */
export function reportToDrawings(report: TaReport, tag = 'AI'): Drawing[] {
  const now = Date.now()
  const drawings: Drawing[] = []
  const green = defaultStyle({ color: '#0ecb81', lineWidth: 1, lineStyle: 'dashed' })
  const red = defaultStyle({ color: '#f6465d', lineWidth: 1, lineStyle: 'dashed' })
  const blue = defaultStyle({ color: '#5b8def', lineWidth: 1.5, lineStyle: 'solid' })
  const gold = defaultStyle({ color: '#f0b90b', lineWidth: 1, lineStyle: 'dotted' })

  for (const p of report.supports) {
    drawings.push({
      id: createDrawingId(),
      tool: 'horizontal',
      price: p,
      style: green,
      createdAt: now,
      updatedAt: now,
    })
  }
  for (const p of report.resistances) {
    drawings.push({
      id: createDrawingId(),
      tool: 'horizontal',
      price: p,
      style: red,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (report.trend) {
    drawings.push({
      id: createDrawingId(),
      tool: 'trendline',
      p1: report.trend.from,
      p2: report.trend.to,
      style: { ...blue, extendRight: true },
      createdAt: now,
      updatedAt: now,
    })
  }

  if (report.fib && report.swings.length >= 2) {
    const highs = report.swings.filter((s) => s.kind === 'high')
    const lows = report.swings.filter((s) => s.kind === 'low')
    const sh = highs[highs.length - 1]
    const sl = lows[lows.length - 1]
    if (sh && sl) {
      // p1 = start of move, p2 = end (standard fib)
      const up = sh.index > sl.index
      const p1 = up
        ? { time: sl.time, price: sl.price }
        : { time: sh.time, price: sh.price }
      const p2 = up
        ? { time: sh.time, price: sh.price }
        : { time: sl.time, price: sl.price }
      drawings.push({
        id: createDrawingId(),
        tool: 'fib_retracement',
        p1,
        p2,
        style: gold,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // Label bias as text near last price
  if (report.last) {
    drawings.push({
      id: createDrawingId(),
      tool: 'text',
      point: { time: report.last.time, price: report.last.close },
      text: `${tag} ${report.bias.toUpperCase()}`,
      style: defaultStyle({
        color: report.bias === 'bullish' ? '#0ecb81' : report.bias === 'bearish' ? '#f6465d' : '#f0b90b',
        fontSize: 11,
      }),
      createdAt: now,
      updatedAt: now,
    })
  }

  return drawings
}
