/** Footprint – price × time cells of aggressor buy/sell volume */

export interface FootprintCell {
  /** candle open unix sec */
  timeSec: number
  price: number
  buyQty: number
  sellQty: number
}

export interface FootprintConfig {
  /** Max candles to paint (perf) */
  maxCandles: number
  /** Hide cells with total qty below this fraction of max cell in window */
  minCellPct: number
  /** Show only when enough trades per candle (density gate) */
  minTradesPerCandle: number
}

export const DEFAULT_FOOTPRINT_CONFIG: FootprintConfig = {
  maxCandles: 40,
  minCellPct: 2,
  minTradesPerCandle: 3,
}

export const FOOTPRINT_NOTE =
  'Footprint needs dense trades (e.g. BTCUSDT 1s–1m). Weak on illiquid alts – cells may be empty.'
