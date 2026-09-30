/**
 * Paper trading types – simulated account only.
 * Prices always come from real market data (never synthetic).
 */

export type PaperSide = 'long' | 'short'
export type PaperOrderType = 'market' | 'limit'
export type PaperOrderStatus = 'open' | 'filled' | 'cancelled'
export type PaperMarginMode = 'cross' | 'isolated'

export interface PaperPosition {
  id: string
  symbol: string
  side: PaperSide
  qty: number
  entryPrice: number
  leverage: number
  margin: number
  marginMode: PaperMarginMode
  openedAt: number
  markPrice: number
  takeProfit: number | null
  stopLoss: number | null
  trailingPct: number | null
  trailExtreme: number | null
}

export interface PaperOrder {
  id: string
  symbol: string
  side: PaperSide
  type: PaperOrderType
  price: number | null
  qty: number
  leverage: number
  marginMode: PaperMarginMode
  status: PaperOrderStatus
  createdAt: number
  filledAt?: number
  fillPrice?: number
  takeProfit: number | null
  stopLoss: number | null
  trailingPct?: number | null
  postOnly?: boolean
  reduceOnly?: boolean
  ocoGroupId?: string | null
}

export interface PaperFill {
  id: string
  orderId: string
  symbol: string
  side: PaperSide
  qty: number
  price: number
  leverage: number
  realizedPnl: number
  time: number
  action: 'open' | 'close' | 'tp' | 'sl' | 'trail' | 'liquidate' | 'funding'
  fee?: number
  isMaker?: boolean
}

export interface PaperAccount {
  balance: number
  initialBalance: number
  feesPaid?: number
  fundingPaid?: number
  takerBps?: number
  makerBps?: number
  fundingRate8h?: number
  lastFundingAt?: number
}

export interface PaperEquityPoint {
  t: number
  equity: number
  balance: number
  unrealized: number
  fees: number
  funding: number
}
