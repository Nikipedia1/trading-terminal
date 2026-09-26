/**
 * Global orderflow palette – one convention everywhere
 * (Print, Delta, Trades, Dom, Footprint).
 *
 * BUY / bid / aggressive buy  → #0ecb81 (green)
 * SELL / ask / aggressive sell → #a855f7 (purple)
 */

export const BUY = '#0ecb81'
export const SELL = '#a855f7'

export const BUY_RGB = '14, 203, 129'
export const SELL_RGB = '168, 85, 247'

export function buyRgba(a: number): string {
  return `rgba(${BUY_RGB}, ${a})`
}

export function sellRgba(a: number): string {
  return `rgba(${SELL_RGB}, ${a})`
}
