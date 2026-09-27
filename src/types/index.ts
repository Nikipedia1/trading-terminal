/** Core market data types – normalized across exchanges */

export type Interval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M'

export type ExchangeId = 'binance' | 'binance_futures' | 'kucoin'

export interface Candle {
  time: number          // unix seconds (Lightweight Charts expects this)
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Trade {
  id: string
  time: number          // ms
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

/** Multi-panel layout */
export interface ChartPanelConfig {
  id: string
  symbol: string
  interval: Interval
  exchange: ExchangeId
  /** Optional sync group id – panels sharing the same group sync crosshair + time zoom */
  syncGroup: string | null
}

export interface GridLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

/** Binance USDT-M liquidation (forceOrder) – public stream */
export interface LiquidationEvent {
  exchange: ExchangeId
  symbol: string
  /** sell = long liquidated, buy = short liquidated */
  side: 'buy' | 'sell'
  price: number
  qty: number
  /** Average fill price if provided */
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
