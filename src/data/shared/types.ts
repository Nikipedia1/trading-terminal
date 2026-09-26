/**
 * Shared market microstructure types for analysis modules.
 * Real data only – never invent fills or book levels.
 */

import type { ConnectionStatus, ExchangeId, MarketError } from '@/types'

/** Aggressor = side that crossed the spread (took liquidity). */
export type AggressorSide = 'buy' | 'sell'

/**
 * Normalized tick from public trade stream.
 * Binance: isBuyerMaker true → aggressor is seller (hit the bid).
 */
export interface AggressorTrade {
  id: string
  exchange: ExchangeId
  symbol: string
  price: number
  qty: number
  /** Exchange event time (ms) */
  time: number
  /** true if buyer was maker → seller was aggressor */
  isBuyerMaker: boolean
  /** Derived: buy = market buy (lifted ask), sell = market sell (hit bid) */
  aggressor: AggressorSide
}

export interface BookLevel {
  price: number
  qty: number
}

/** Local L2 book maintained by applying snapshot + diffs */
export interface LocalOrderBook {
  exchange: ExchangeId
  symbol: string
  /** Last applied update id / sequence (exchange-specific) */
  lastUpdateId: number
  bids: Map<number, number> // price → qty
  asks: Map<number, number>
  /** Wall-clock of last successful apply */
  updatedAt: number
  /** True after snapshot synced and at least one valid diff applied (or snapshot only) */
  ready: boolean
}

/** Serializable snapshot for UI consumers */
export interface OrderBookSnapshot {
  exchange: ExchangeId
  symbol: string
  lastUpdateId: number
  bids: BookLevel[] // sorted desc by price
  asks: BookLevel[] // sorted asc by price
  updatedAt: number
  ready: boolean
}

export type FeedStatus = ConnectionStatus

export interface FeedStatusEvent {
  status: FeedStatus
  detail?: string
}

export interface FeedErrorEvent {
  error: MarketError
}

export function feedKey(exchange: ExchangeId, symbol: string): string {
  return `${exchange}:${symbol.toUpperCase()}`
}

export function aggressorFromBuyerMaker(isBuyerMaker: boolean): AggressorSide {
  // Binance / common convention: m=true → buyer is maker → seller aggressive
  return isBuyerMaker ? 'sell' : 'buy'
}
