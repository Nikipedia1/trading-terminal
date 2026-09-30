/** Gamma / options positioning levels (public Deribit data). */

export interface GammaLevel {
  price: number
  /** net gex proxy or signed OI weight */
  value: number
  kind: 'call_wall' | 'put_wall' | 'flip' | 'max_pain' | 'hvl'
  label: string
}

export interface GammaModel {
  currency: 'BTC' | 'ETH'
  spot: number
  asOf: number
  levels: GammaLevel[]
  /** human note (limits of public feed) */
  note: string
  source: 'deribit'
}

export interface GammaConfig {
  walls: boolean
  flip: boolean
  maxPain: boolean
  pollSec: number
}

export const DEFAULT_GAMMA_CONFIG: GammaConfig = {
  walls: true,
  flip: true,
  maxPain: true,
  pollSec: 45,
}

/** Map chart symbol → Deribit currency (spot/futures names). */
export function symbolToDeribitCurrency(symbol: string): 'BTC' | 'ETH' | null {
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, '')
  if (s.startsWith('BTC')) return 'BTC'
  if (s.startsWith('ETH')) return 'ETH'
  return null
}
