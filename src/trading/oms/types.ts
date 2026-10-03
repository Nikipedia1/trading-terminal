/** Unified order lifecycle for paper + live (OMS-lite). */

export type OmsOrderStatus =
  | 'pending' // local intent before submit
  | 'submitted' // sent to venue
  | 'partial' // partial fill
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'unknown' // after reconnect, needs reconcile

export type OmsVenue = 'paper' | 'binance_spot' | 'binance_futures'

export interface OmsOrder {
  id: string
  clientOrderId: string
  exchangeOrderId?: string
  venue: OmsVenue
  symbol: string
  side: 'BUY' | 'SELL'
  type: 'MARKET' | 'LIMIT'
  qty: number
  filledQty: number
  price?: number
  avgFillPrice?: number
  status: OmsOrderStatus
  reduceOnly?: boolean
  createdAt: number
  updatedAt: number
  lastError?: string
  fee?: number
  feeAsset?: string
}

export interface OmsPositionSnapshot {
  venue: OmsVenue
  symbol: string
  side: 'long' | 'short' | 'flat'
  qty: number
  entryPrice: number
  unrealizedPnl?: number
  marginMode?: 'cross' | 'isolated'
  leverage?: number
  updatedAt: number
}

export interface OmsBalanceSnapshot {
  venue: OmsVenue
  asset: string
  free: number
  locked: number
  updatedAt: number
}
