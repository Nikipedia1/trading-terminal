/** Deep Trades – large aggressive prints on the chart */

export type ThresholdMode = 'fixed' | 'percentile'
export type SizeUnit = 'base' | 'quote'
export type TradeOutcome = 'pending' | 'effective' | 'trapped'

export interface DeepTradesConfig {
  mode: ThresholdMode
  /** Fixed minimum when mode=fixed (unit = sizeUnit) */
  fixedMin: number
  /** Percentile 0–100 of recent sizes when mode=percentile */
  percentile: number
  lookback: number
  /** Size measured in base asset qty or quote (price×qty ≈ USDT) */
  sizeUnit: SizeUnit
  /** Merge trades within this many ms at same tick → one bubble */
  clusterMs: number
  /** Show only Effective bubbles (hide trapped + pending) */
  onlyEffective: boolean
}

export const DEFAULT_DEEP_TRADES_CONFIG: DeepTradesConfig = {
  mode: 'percentile',
  fixedMin: 1,
  percentile: 90,
  lookback: 500,
  sizeUnit: 'base',
  clusterMs: 400,
  onlyEffective: false,
}

export interface DeepTradeBubble {
  id: string
  /** unix seconds (chart time) */
  timeSec: number
  price: number
  /** Display size (summed if clustered) – in the unit used for threshold */
  qty: number
  /** Base asset qty (always) for radius fallback */
  baseQty: number
  aggressor: 'buy' | 'sell'
  outcome: TradeOutcome
  /** How many raw trades merged into this bubble */
  clusterCount: number
}
