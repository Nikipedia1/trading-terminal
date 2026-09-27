/** Filter + cluster aggressor trades by size threshold – real ticks only. */

import type { AggressorTrade } from '@/data/shared'
import type { DeepTradeBubble, DeepTradesConfig } from './types'
import { inferTickSize, roundToTick } from '@/analysis/deepPrint/interval'

function tradeSize(t: AggressorTrade, unit: 'base' | 'quote'): number {
  return unit === 'quote' ? t.qty * t.price : t.qty
}

function percentileThreshold(sizes: number[], p: number): number {
  if (sizes.length === 0) return Infinity
  const sorted = [...sizes].sort((a, b) => a - b)
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  )
  return sorted[idx]
}

export function resolveThreshold(
  recentSizes: number[],
  config: DeepTradesConfig
): number {
  if (config.mode === 'fixed') return Math.max(0, config.fixedMin)
  const p = Math.min(99, Math.max(1, config.percentile))
  return percentileThreshold(recentSizes, p)
}

interface ClusterAcc {
  id: string
  timeMs: number
  price: number
  baseQty: number
  quoteQty: number
  size: number
  aggressor: 'buy' | 'sell'
  count: number
}

/**
 * Merge consecutive trades within clusterMs at same rounded tick + side.
 * Anchor time = first fill (earliest) – real event time.
 */
function clusterTrades(
  trades: AggressorTrade[],
  clusterMs: number,
  unit: 'base' | 'quote'
): ClusterAcc[] {
  if (trades.length === 0) return []
  const mid = trades[Math.floor(trades.length / 2)]?.price ?? trades[0].price
  const tick = inferTickSize(mid)
  const sorted = [...trades].sort((a, b) => a.time - b.time)
  const out: ClusterAcc[] = []

  for (const t of sorted) {
    const px = roundToTick(t.price, tick)
    const size = tradeSize(t, unit)
    const quote = t.qty * t.price
    const last = out[out.length - 1]
    if (
      last &&
      last.aggressor === t.aggressor &&
      last.price === px &&
      t.time - last.timeMs <= clusterMs
    ) {
      last.baseQty += t.qty
      last.quoteQty += quote
      last.size += size
      last.count += 1
    } else {
      out.push({
        id: t.id,
        timeMs: t.time,
        price: px,
        baseQty: t.qty,
        quoteQty: quote,
        size,
        aggressor: t.aggressor,
        count: 1,
      })
    }
  }
  return out
}

export function filterDeepTrades(
  trades: AggressorTrade[],
  config: DeepTradesConfig
): { bubbles: DeepTradeBubble[]; threshold: number } {
  const lookback = Math.max(50, config.lookback)
  const unit = config.sizeUnit
  const clustered = clusterTrades(trades, Math.max(0, config.clusterMs), unit)

  const sample = clustered.slice(-lookback)
  const sizes = sample.map((c) => c.size)
  const threshold = resolveThreshold(sizes, config)

  const bubbles: DeepTradeBubble[] = []
  for (const c of clustered) {
    if (c.size < threshold) continue
    bubbles.push({
      id: c.id,
      timeSec: c.timeMs / 1000,
      price: c.price,
      qty: c.size,
      baseQty: c.baseQty,
      quoteQty: c.quoteQty,
      aggressor: c.aggressor,
      outcome: 'pending',
      clusterCount: c.count,
    })
  }
  return { bubbles, threshold }
}
