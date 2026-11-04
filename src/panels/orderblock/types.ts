/** Order Block desk — crypto market X-ray (OrderBlock-style) */

export type ObSide = 'bullish' | 'bearish'

export type CryptoSector =
  | 'L1'
  | 'L2'
  | 'DeFi'
  | 'Meme'
  | 'AI'
  | 'Infra'
  | 'Exchange'
  | 'Other'

export type PickRule =
  | 'PICK'
  | 'NOT_PICKED_SECTOR_CAP'
  | 'NOT_PICKED_OUTSIDE_TOP'
  | 'NOT_PICKED_CHOPPY'
  | 'NOT_PICKED_LOW_LIQ'

export type MitigationState = 'fresh' | 'tested' | 'mitigated' | 'broken'

export interface RankedAsset {
  symbol: string
  base: string
  sector: CryptoSector
  lastPrice: number
  changePct: number
  strength: number
  absStrength: number
  liquidityScore: number
  volumeQuote: number
  high: number
  low: number
  open: number
  side: ObSide
  rank: number
  percentile: number
  buildUp: 'long' | 'short' | 'neutral'
  clean: boolean
  pickRule: PickRule
  isPick: boolean
}

export interface SectorRow {
  sector: CryptoSector
  changePct: number
  bullish: number
  bearish: number
  count: number
}

export interface MarketBreadth {
  bullish: number
  bearish: number
  neutral: number
  avgChangePct: number
  leadingSector: SectorRow | null
  laggingSector: SectorRow | null
  sectors: SectorRow[]
  assets: RankedAsset[]
  bullBoard: RankedAsset[]
  bearBoard: RankedAsset[]
  picksBull: RankedAsset[]
  picksBear: RankedAsset[]
  updatedAt: number
}

export interface ObZoneView {
  kind: ObSide
  /** Full wick range */
  top: number
  bottom: number
  /** Institutional body zone (more precise) */
  bodyTop: number
  bodyBottom: number
  time: number
  endTime: number
  index: number
  /** Displacement quality 0..1 */
  quality: number
  mitigation: MitigationState
  /** Touches after formation */
  touches: number
}

export interface ZoneLevels {
  z: number
  s1: number
  r1: number
  r2: number
  obTop: number
  obBottom: number
  bodyTop: number
  bodyBottom: number
  quality: number
  mitigation: MitigationState
}

export interface AssetDetail {
  asset: RankedAsset
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[]
  orderBlocks: ObZoneView[]
  zone: ZoneLevels | null
  vwap: number | null
  rr: number | null
  interval: string
  /** Session stats for scale */
  atr: number | null
}

export type ObBoardTab = 'bullish' | 'bearish' | 'picks' | 'breadth'
