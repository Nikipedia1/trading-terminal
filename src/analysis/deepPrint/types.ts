/** Deep Print + Delta – bid/ask and net delta by price level */

export interface PrintLevel {
  /** Rounded price level (tick) */
  price: number
  sellQty: number
  buyQty: number
  /** buyQty - sellQty at this level */
  delta: number
}

export interface DeepPrintModel {
  /** Candle open time (unix seconds) */
  candleTime: number
  /** End of interval (unix seconds, exclusive) */
  candleEnd: number
  /** Mid price for vertical anchor (typically candle mid) */
  anchorPrice: number
  levels: PrintLevel[]
  totalBuy: number
  totalSell: number
  /** totalBuy - totalSell for the candle */
  totalDelta: number
  tradeCount: number
  tickSize: number
}

/** One histogram bar for candle-level delta */
export interface CandleDeltaBar {
  time: number
  delta: number
}
