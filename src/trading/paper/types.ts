/**
 * Paper trading types – simulated account only.
 * Prices always come from real market data (never synthetic).
 */

export type PaperSide = 'long' | 'short'
export type PaperOrderType = 'market' | 'limit'
export type PaperOrderStatus = 'open' | 'filled' | 'cancelled'

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
  openedAt: number
  /** Last mark used for unrealized PnL */
  markPrice: number
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
  status: PaperOrderStatus
  createdAt: number
  filledAt?: number
  fillPrice?: number
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
  /** open | close */
  action: 'open' | 'close'
}

export interface PaperAccount {
  /** Free USDT balance */
  balance: number
  /** Starting equity (for ROI display) */
  initialBalance: number
}
