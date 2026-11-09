/** Gamma / GEX – public Deribit options positioning (Classic-style views). */

export interface GammaLevel {
  price: number
  /** net gex proxy or signed OI weight */
  value: number
  kind: 'call_wall' | 'put_wall' | 'flip' | 'max_pain' | 'hvl' | 'dominant_pos' | 'dominant_neg'
  label: string
}

/** Per-strike OI + GEX proxy for profile / heatmap bars */
export interface GammaStrikeRow {
  strike: number
  callOi: number
  putOi: number
  /** callOi - putOi (simple net) */
  net: number
  /** dealer-style proxy: +call above spot, -put below */
  gex: number
}

export interface GammaModel {
  currency: 'BTC' | 'ETH'
  spot: number
  asOf: number
  levels: GammaLevel[]
  /** Full strike profile for left/right bars (sorted by strike asc) */
  profile: GammaStrikeRow[]
  /** Aggregate net GEX proxy */
  netGex: number
  callWall: number | null
  putWall: number | null
  flip: number | null
  maxPain: number | null
  note: string
  source: 'deribit'
}

export interface GammaConfig {
  walls: boolean
  flip: boolean
  maxPain: boolean
  /** Draw OI/GEX profile bars on chart sides */
  profile: boolean
  /** Thick zone lines at walls */
  zones: boolean
  pollSec: number
}

export const DEFAULT_GAMMA_CONFIG: GammaConfig = {
  walls: true,
  flip: true,
  maxPain: true,
  profile: true,
  zones: true,
  pollSec: 30,
}

/** Map chart symbol → Deribit currency (spot/futures names). */
export function symbolToDeribitCurrency(symbol: string): 'BTC' | 'ETH' | null {
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, '')
  if (s.startsWith('BTC')) return 'BTC'
  if (s.startsWith('ETH')) return 'ETH'
  return null
}
