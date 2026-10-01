/**
 * Liquidity context for AI desk: High/Low, imbalance, balance, long/short bias.
 * Used in Analyze text and Auto-draw (horizontal levels + labels).
 */

import type { Candle, OrderBook, Trade } from '@/types'
import type { Drawing } from '@/drawings/types'
import { createDrawingId, defaultStyle } from '@/drawings/types'

export type LiqBias = 'long' | 'short' | 'neutral'

export interface LiquidityReport {
  last: number | null
  high24: number | null
  low24: number | null
  highBars: number | null
  lowBars: number | null
  bestBid: number | null
  bestAsk: number | null
  imb5: number
  imb20: number
  balance5: number
  balance20: number
  deltaImb: number
  score: number
  bias: LiqBias
  summary: string[]
}

function levelQty(l: { price: number; qty?: number; size?: number }): number {
  return l.qty ?? l.size ?? 0
}

function sumSide(
  levels: { price: number; qty?: number; size?: number }[] | undefined,
  n: number
): number {
  if (!levels?.length) return 0
  return levels.slice(0, n).reduce((s, x) => s + levelQty(x), 0)
}

export function analyzeLiquidity(
  candles: Candle[],
  book: OrderBook | null,
  trades: Trade[],
  tickerHigh?: number | null,
  tickerLow?: number | null,
  tickerLast?: number | null
): LiquidityReport {
  const bids = book?.bids ?? []
  const asks = book?.asks ?? []
  const bid5 = sumSide(bids, 5)
  const ask5 = sumSide(asks, 5)
  const bid20 = sumSide(bids, 20)
  const ask20 = sumSide(asks, 20)
  const imb5 = bid5 + ask5 > 0 ? (bid5 - ask5) / (bid5 + ask5) : 0
  const imb20 = bid20 + ask20 > 0 ? (bid20 - ask20) / (bid20 + ask20) : 0
  const balance5 = 1 - Math.abs(imb5)
  const balance20 = 1 - Math.abs(imb20)

  let buyVol = 0
  let sellVol = 0
  for (const t of trades.slice(0, 80)) {
    if (t.isBuyerMaker) sellVol += t.qty
    else buyVol += t.qty
  }
  const tot = buyVol + sellVol
  const deltaImb = tot > 0 ? (buyVol - sellVol) / tot : 0
  const score = imb20 * 0.55 + deltaImb * 0.45
  let bias: LiqBias = 'neutral'
  if (score >= 0.12) bias = 'long'
  else if (score <= -0.12) bias = 'short'

  const bestBid = bids[0]?.price ?? null
  const bestAsk = asks[0]?.price ?? null
  const mid =
    bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null

  let highBars: number | null = null
  let lowBars: number | null = null
  if (candles.length) {
    const w = candles.slice(-48)
    highBars = Math.max(...w.map((c) => c.high))
    lowBars = Math.min(...w.map((c) => c.low))
  }

  const last =
    tickerLast ??
    (candles.length ? candles[candles.length - 1]!.close : null) ??
    mid

  const high24 = tickerHigh ?? highBars
  const low24 = tickerLow ?? lowBars

  const summary: string[] = [
    `Liquidity bias **${bias.toUpperCase()}** · score ${(score * 100).toFixed(1)}%`,
    `Imbalance top5 ${(imb5 * 100).toFixed(1)}% · top20 ${(imb20 * 100).toFixed(1)}%`,
    `Balance top5 ${(balance5 * 100).toFixed(0)}% · top20 ${(balance20 * 100).toFixed(0)}%`,
  ]
  if (high24 != null && low24 != null) {
    summary.push(`High ${high24.toFixed(4)} · Low ${low24.toFixed(4)}`)
  }
  if (highBars != null && lowBars != null) {
    summary.push(`Bars High ${highBars.toFixed(4)} · Low ${lowBars.toFixed(4)}`)
  }
  if (last != null) summary.push(`Last ${last.toFixed(4)}`)

  return {
    last,
    high24: high24 ?? null,
    low24: low24 ?? null,
    highBars,
    lowBars,
    bestBid,
    bestAsk,
    imb5,
    imb20,
    balance5,
    balance20,
    deltaImb,
    score,
    bias,
    summary,
  }
}

export interface LiquidityDrawOpts {
  highLow: boolean
  imbalance: boolean
  balance: boolean
  positionBias: boolean
}

export const DEFAULT_LIQ_DRAW: LiquidityDrawOpts = {
  highLow: true,
  imbalance: true,
  balance: false,
  positionBias: true,
}

export function liquidityToDrawings(
  report: LiquidityReport,
  opts: LiquidityDrawOpts,
  anchorTime: number
): Drawing[] {
  const now = Date.now()
  const drawings: Drawing[] = []
  const t = anchorTime

  if (opts.highLow) {
    if (report.highBars != null) {
      drawings.push({
        id: createDrawingId(),
        tool: 'horizontal',
        price: report.highBars,
        style: defaultStyle({ color: '#0ecb81', lineWidth: 1, lineStyle: 'dashed' }),
        createdAt: now,
        updatedAt: now,
      })
      drawings.push({
        id: createDrawingId(),
        tool: 'text',
        point: { time: t, price: report.highBars },
        text: 'AI High',
        style: defaultStyle({ color: '#0ecb81', fontSize: 10 }),
        createdAt: now,
        updatedAt: now,
      })
    }
    if (report.lowBars != null) {
      drawings.push({
        id: createDrawingId(),
        tool: 'horizontal',
        price: report.lowBars,
        style: defaultStyle({ color: '#f6465d', lineWidth: 1, lineStyle: 'dashed' }),
        createdAt: now,
        updatedAt: now,
      })
      drawings.push({
        id: createDrawingId(),
        tool: 'text',
        point: { time: t, price: report.lowBars },
        text: 'AI Low',
        style: defaultStyle({ color: '#f6465d', fontSize: 10 }),
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  if (opts.imbalance && report.bestBid != null && report.bestAsk != null) {
    const mid = (report.bestBid + report.bestAsk) / 2
    drawings.push({
      id: createDrawingId(),
      tool: 'text',
      point: { time: t, price: mid },
      text: `Imb ${(report.imb20 * 100).toFixed(0)}%`,
      style: defaultStyle({
        color: report.imb20 >= 0 ? '#0ecb81' : '#f6465d',
        fontSize: 10,
      }),
      createdAt: now,
      updatedAt: now,
    })
  }

  if (opts.balance && report.last != null) {
    drawings.push({
      id: createDrawingId(),
      tool: 'text',
      point: { time: t, price: report.last },
      text: `Bal ${(report.balance20 * 100).toFixed(0)}%`,
      style: defaultStyle({ color: '#f0b90b', fontSize: 10 }),
      createdAt: now,
      updatedAt: now,
    })
  }

  if (opts.positionBias && report.last != null) {
    const col =
      report.bias === 'long'
        ? '#0ecb81'
        : report.bias === 'short'
          ? '#f6465d'
          : '#848e9c'
    drawings.push({
      id: createDrawingId(),
      tool: 'text',
      point: { time: t, price: report.last * (report.bias === 'short' ? 0.998 : 1.002) },
      text: `AI ${report.bias.toUpperCase()}`,
      style: defaultStyle({ color: col, fontSize: 11 }),
      createdAt: now,
      updatedAt: now,
    })
  }

  return drawings
}
