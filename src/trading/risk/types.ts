/** Risk limits for paper and live_armed modes. */

export interface RiskLimits {
  /** Max leverage allowed on new orders */
  maxLeverage: number
  /** Max notional per order (quote currency, e.g. USDT) */
  maxOrderNotional: number
  /** Max open positions count */
  maxOpenPositions: number
  /** Max absolute daily realized + unrealized loss before block (quote) */
  maxDailyLoss: number
  /** Circuit breaker: consecutive rejects before auto kill-switch */
  maxConsecutiveRejects: number
  /** When true, all new orders blocked */
  killSwitch: boolean
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxLeverage: 20,
  maxOrderNotional: 50_000,
  maxOpenPositions: 25,
  maxDailyLoss: 2_000,
  maxConsecutiveRejects: 5,
  killSwitch: false,
}

export interface RiskCheckInput {
  mode: 'paper' | 'live'
  symbol: string
  leverage: number
  qty: number
  price: number
  openPositionCount: number
  /** Realized PnL today (quote), negative = loss */
  dailyPnl: number
}

export type RiskCheckResult =
  | { ok: true }
  | { ok: false; code: string; message: string }
