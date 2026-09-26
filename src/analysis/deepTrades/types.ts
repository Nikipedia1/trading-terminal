/** Deep Trades – large aggressive prints on the chart */

export type ThresholdMode = 'fixed' | 'percentile'

export interface DeepTradesConfig {
  mode: ThresholdMode
  /** Fixed minimum qty (base asset) when mode=fixed */
  fixedMin: number
  /** Percentile 0–100 of recent trade sizes when mode=percentile */
  percentile: number
  /** How many recent trades to use for percentile stats */
  lookback: number
}

export const DEFAULT_DEEP_TRADES_CONFIG: DeepTradesConfig = {
  mode: 'percentile',
  fixedMin: 1,
  percentile: 90,
  lookback: 500,
}

export interface DeepTradeBubble {
  id: string
  /** unix seconds (chart time) */
  timeSec: number
  price: number
  qty: number
  aggressor: 'buy' | 'sell'
}
