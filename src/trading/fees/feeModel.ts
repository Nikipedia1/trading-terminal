/**
 * Fee / funding / margin helpers aligned with typical futures economics.
 * Paper uses configurable bps; live uses exchange-reported or defaults.
 */

export type MarginMode = 'cross' | 'isolated'

export interface FeeSchedule {
  takerBps: number
  makerBps: number
  /** Default 8h funding rate if venue does not provide one */
  fundingRate8h: number
}

/** Approximate Binance USDT-M retail defaults (not a promise of actual rates). */
export const BINANCE_FUTURES_DEFAULT_FEES: FeeSchedule = {
  takerBps: 4,
  makerBps: 2,
  fundingRate8h: 0.0001,
}

export const BINANCE_SPOT_DEFAULT_FEES: FeeSchedule = {
  takerBps: 10,
  makerBps: 10,
  fundingRate8h: 0,
}

export function estimateCommission(
  notional: number,
  isMaker: boolean,
  schedule: FeeSchedule
): number {
  const bps = isMaker ? schedule.makerBps : schedule.takerBps
  return Math.max(0, (Math.abs(notional) * bps) / 10_000)
}

/** Initial margin for isolated-style sizing. */
export function initialMargin(
  qty: number,
  price: number,
  leverage: number
): number {
  if (leverage < 1 || qty <= 0 || price <= 0) return 0
  return (qty * price) / leverage
}

/** Simplified isolated liquidation distance (no maintenance margin curve). */
export function approxLiqPrice(
  side: 'long' | 'short',
  entry: number,
  leverage: number,
  mode: MarginMode
): number | null {
  if (mode !== 'isolated' || leverage < 1 || entry <= 0) return null
  const delta = entry / leverage
  return side === 'long' ? Math.max(0, entry - delta) : entry + delta
}

export function fundingPayment(
  side: 'long' | 'short',
  qty: number,
  mark: number,
  rate: number
): number {
  const notional = qty * mark
  const pay = notional * rate
  return side === 'long' ? -pay : pay
}
