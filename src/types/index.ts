/** Core market data types – normalized across exchanges */

export type Interval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M'

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

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface MarketError {
  code: string
  message: string
  exchange: string
  timestamp: number
}
