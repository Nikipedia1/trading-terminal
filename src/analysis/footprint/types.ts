/** Footprint – price × time cells + bar metrics from raw aggressor ticks */

export interface FootprintCell {
  timeSec: number
  price: number
  buyQty: number
  sellQty: number
  delta: number
}

/** Per-candle footprint summary (FORMULAS.md) */
export interface FootprintBar {
  timeSec: number
  delta: number
  buyQty: number
  sellQty: number
  /** Price tick with max volume in bar */
  poc: number
  /** Highest tick only has buys (no sell) */
  unfinishedHigh: boolean
  /** Lowest tick only has sells (no buy) */
  unfinishedLow: boolean
  cellCount: number
}

export interface FootprintConfig {
  maxCandles: number
  minCellPct: number
  minTradesPerCandle: number
  /** Draw bar delta / POC markers */
  showBarMetrics: boolean
}

export const DEFAULT_FOOTPRINT_CONFIG: FootprintConfig = {
  maxCandles: 40,
  minCellPct: 2,
  minTradesPerCandle: 3,
  showBarMetrics: true,
}

export const FOOTPRINT_NOTE =
  'Footprint from aggressor ticks only. Needs dense stream (e.g. BTC 1m). See FORMULAS.md.'
