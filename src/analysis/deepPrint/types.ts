/** Deep Print – bid/ask volume by price level for one candle */

export interface PrintLevel {
  /** Rounded price level (tick) */
  price: number
  sellQty: number
  buyQty: number
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
  tradeCount: number
  tickSize: number
}
