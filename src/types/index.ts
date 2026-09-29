/** Core market data types – normalized across exchanges */

export type Interval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M'

export type ExchangeId =
  | 'binance'
  | 'kucoin'
  | 'bybit'
  | 'okx'
  | 'binance_futures'

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
  price: number
  qty: number
  time: number
  isBuyerMaker: boolean
}

export interface BookLevel {
  price: number
  qty: number
}

export interface OrderBook {
  bids: BookLevel[]
  asks: BookLevel[]
  lastUpdateId?: number
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

export type FeedStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface ChartPanelConfig {
  id: string
  symbol: string
  interval: Interval
  exchange: ExchangeId
  syncGroup: string | null
}

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
