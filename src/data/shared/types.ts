/** Shared microstructure types + feedKey */

export type AggressorSide = 'buy' | 'sell'

export interface AggressorTrade {
  id: string
  time: number
  price: number
  qty: number
  side: AggressorSide
  isBuyerMaker?: boolean
}

export interface BookLevel {
  price: number
  qty: number
}

export interface LocalOrderBook {
  bids: BookLevel[]
  asks: BookLevel[]
  ts: number
}

export interface OrderBookSnapshot {
  bids: BookLevel[]
  asks: BookLevel[]
  ready: boolean
  ts?: number
}

export type FeedStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'disconnected'

export interface FeedStatusEvent {
  key: string
  status: FeedStatus
  detail?: string
}

export interface FeedErrorEvent {
  key: string
  error: string
}

export function aggressorFromBuyerMaker(isBuyerMaker: boolean): AggressorSide {
  return isBuyerMaker ? 'sell' : 'buy'
}

export function feedKey(exchange: string, symbol: string): string {
  return `${exchange}:${(symbol ?? '').toUpperCase()}`
}
