/** Deep Trades – large aggressive prints on the chart (real aggTrade only) */

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
  /** Draw size label on medium/large bubbles */
  showLabels?: boolean
  /** Bars ahead used to confirm effective/trapped (1–5) */
  confirmBars?: number
  /**
   * Keep at most N largest bubbles per candle bar (0 = no per-candle cap).
   * Ensures coverage across the chart instead of only a few mega-prints.
   */
  maxPerCandle?: number
}

/**
 * Defaults: show prints across many candles (p70 USDT),
 * keep top 2 clusters per bar so history is populated.
 */
export const DEFAULT_DEEP_TRADES_CONFIG: DeepTradesConfig = {
  mode: 'percentile',
  fixedMin: 5_000,
  percentile: 70,
  lookback: 1500,
  sizeUnit: 'quote',
  clusterMs: 250,
  onlyEffective: false,
  showLabels: true,
  confirmBars: 1,
  maxPerCandle: 2,
}

export interface DeepTradeBubble {
  id: string
  /** unix seconds (may be fractional – chart time) */
  timeSec: number
  price: number
  /** Display size (summed if clustered) – in the unit used for threshold */
  qty: number
  /** Base asset qty (always) for radius fallback */
  baseQty: number
  /** Quote notional (price * base) */
  quoteQty: number
  aggressor: 'buy' | 'sell'
  outcome: TradeOutcome
  /** How many raw trades merged into this bubble */
  clusterCount: number
}
