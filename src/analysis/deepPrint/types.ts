/** Deep Print + Delta – bid/ask, %, and integrated volume profile */

export interface PrintLevel {
  /** Rounded price level (tick) */
  price: number
  sellQty: number
  buyQty: number
  /** buyQty - sellQty at this level */
  delta: number
  /** buy + sell volume at level */
  totalVol: number
  /** buy share of level volume 0–100 */
  buyPct: number
  /** sell share of level volume 0–100 */
  sellPct: number
  /** level volume as % of candle total volume 0–100 */
  volPct: number
  /** true if this level is Point of Control */
  isPoc?: boolean
  /** true if inside Value Area */
  inValueArea?: boolean
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
  /** totalBuy + totalSell */
  totalVolume: number
  /** totalBuy - totalSell for the candle */
  totalDelta: number
  /** buy % of total volume */
  buyPct: number
  /** sell % of total volume */
  sellPct: number
  tradeCount: number
  tickSize: number
  /** Volume Profile: price with max volume */
  poc: number | null
  /** Value Area High */
  vah: number | null
  /** Value Area Low */
  val: number | null
  /** Fraction of volume inside VA (default target 0.7) */
  valueAreaPct: number
}

/** One histogram bar for candle-level delta */
export interface CandleDeltaBar {
  time: number
  delta: number
}
