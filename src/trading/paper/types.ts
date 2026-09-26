/**
 * Paper trading types – simulated account only.
 * Prices always come from real market data (never synthetic).
 */

export type PaperSide = 'long' | 'short'
export type PaperOrderType = 'market' | 'limit'
export type PaperOrderStatus = 'open' | 'filled' | 'cancelled'
/** Cross = shared free balance; Isolated = margin locked per position, liquidates alone */
export type PaperMarginMode = 'cross' | 'isolated'

export interface PaperPosition {
  id: string
  symbol: string
  side: PaperSide
  /** Position size in base asset */
  qty: number
  /** Average entry price */
  entryPrice: number
  leverage: number
  /** Margin locked in USDT */
  margin: number
  marginMode: PaperMarginMode
  openedAt: number
  /** Last mark used for unrealized PnL */
  markPrice: number
  /** Optional take-profit price (absolute) */
  takeProfit: number | null
  /** Optional stop-loss price (absolute) */
  stopLoss: number | null
}

export interface PaperOrder {
  id: string
  symbol: string
  side: PaperSide
  type: PaperOrderType
  /** Limit price (ignored for market) */
  price: number | null
  /** Size in base asset */
  qty: number
  leverage: number
  marginMode: PaperMarginMode
  status: PaperOrderStatus
  createdAt: number
  filledAt?: number
  fillPrice?: number
  takeProfit: number | null
  stopLoss: number | null
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
  /** open | close | tp | sl | liquidate */
  action: 'open' | 'close' | 'tp' | 'sl' | 'liquidate'
}

export interface PaperAccount {
  /** Free USDT balance */
  balance: number
  /** Starting equity (for ROI display) */
  initialBalance: number
}
