/** Filter aggressor trades by size threshold (fixed or percentile). */

import type { AggressorTrade } from '@/data/shared'
import type { DeepTradeBubble, DeepTradesConfig } from './types'

function percentileThreshold(sizes: number[], p: number): number {
  if (sizes.length === 0) return Infinity
  const sorted = [...sizes].sort((a, b) => a - b)
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  )
  return sorted[idx]
}

/**
 * Compute threshold from config + recent sample of trade sizes.
 * Never invents trades – only filters real ones.
 */
export function resolveThreshold(
  recentSizes: number[],
  config: DeepTradesConfig
): number {
  if (config.mode === 'fixed') {
    return Math.max(0, config.fixedMin)
  }
  const p = Math.min(99, Math.max(1, config.percentile))
  return percentileThreshold(recentSizes, p)
}

export function filterDeepTrades(
  trades: AggressorTrade[],
  config: DeepTradesConfig
): { bubbles: DeepTradeBubble[]; threshold: number } {
  const lookback = Math.max(50, config.lookback)
  const sample = trades.slice(-lookback)
  const sizes = sample.map((t) => t.qty)
  const threshold = resolveThreshold(sizes, config)

  const bubbles: DeepTradeBubble[] = []
  for (const t of trades) {
    if (t.qty < threshold) continue
    bubbles.push({
      id: t.id,
      timeSec: t.time / 1000,
      price: t.price,
      qty: t.qty,
      aggressor: t.aggressor,
    })
  }
  return { bubbles, threshold }
}
