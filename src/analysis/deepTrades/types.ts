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
}

/** Defaults tuned for BTC-like pairs: notional (USDT) + top 5% prints */
export const DEFAULT_DEEP_TRADES_CONFIG: DeepTradesConfig = {
  mode: 'percentile',
  fixedMin: 50_000, // USDT notional if sizeUnit=quote
  percentile: 95,
  lookback: 800,
  sizeUnit: 'quote',
  clusterMs: 350,
  onlyEffective: false,
  showLabels: true,
  confirmBars: 2,
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
