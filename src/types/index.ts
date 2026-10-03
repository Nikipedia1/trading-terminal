/** Core market data types – normalized across exchanges */

export type Interval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M'

/** Free public venues only (no paid data). */
export type ExchangeId =
  | 'binance'
  | 'binance_futures'
  | 'kucoin'
  | 'bybit'
  | 'okx'

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Trade {
  id: string
  time: number
  price: number
  qty: number
  isBuyerMaker: boolean
  symbol: string
}

export interface OrderBookLevel {
  price: number
  qty: number
}

export interface OrderBook {
  symbol: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  lastUpdateId: number
}

export interface Ticker {
  symbol: string
  lastPrice: number
  priceChange: number
  priceChangePercent: number
  highPrice: number
  lowPrice: number
  volume: number
  quoteVolume: number
}

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export interface MarketError {
  code: string
  message: string
  exchange: string
  timestamp: number
}

export interface ChartPanelConfig {
  id: string
  symbol: string
  interval: Interval
  exchange: ExchangeId
  syncGroup: string | null
}

/** Side widgets that live on the same magnetic grid as charts. */
export type WidgetKind =
  | 'paper'
  | 'book'
  | 'tape'
  | 'large'
  | 'futures'
  | 'alerts'
  | 'journal'
  | 'terminal'
  | 'watchlist'
  | 'ai'
  | 'wallet'
  | 'bots'
  | 'admin'
  | 'liquidity'
  | 'backtest'
  | 'livekeys'
  | 'plugins'
  | 'micro'
  | 'viz3d'
  | 'news'
  | 'calendar'
  | 'livetv'
  | 'learn'
  | 'ops'

export interface WidgetPanelConfig {
  id: string
  kind: WidgetKind
  title: string
}

export type DeskPanel =
  | ({ type: 'chart' } & ChartPanelConfig)
  | ({ type: 'widget' } & WidgetPanelConfig)

export interface GridLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export interface LiquidationEvent {
  exchange: ExchangeId
  symbol: string
  side: 'buy' | 'sell'
  price: number
  qty: number
  averagePrice: number
  time: number
  orderStatus?: string
}

export interface MarkPriceTick {
  exchange: ExchangeId
  symbol: string
  markPrice: number
  indexPrice: number
  fundingRate: number
  nextFundingTime: number
  time: number
}

export interface OpenInterestSnapshot {
  exchange: ExchangeId
  symbol: string
  openInterest: number
  time: number
}

export interface FundingRateRow {
  symbol: string
  fundingRate: number
  fundingTime: number
  markPrice?: number
}
