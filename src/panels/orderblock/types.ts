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

export interface RankedAsset {
  symbol: string
  base: string
  sector: CryptoSector
  lastPrice: number
  changePct: number
  /** Directional strength: session move / day range, signed */
  strength: number
  /** Absolute strength 0..1 for ranking */
  absStrength: number
  /** Liquidity score 0..100 (volume + directional purity) */
  liquidityScore: number
  volumeQuote: number
  high: number
  low: number
  open: number
  side: ObSide
  rank: number
  percentile: number
  buildUp: 'long' | 'short' | 'neutral'
  /** True if move is clean one-direction (not choppy) */
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
  /** Top ranked boards after filters */
  bullBoard: RankedAsset[]
  bearBoard: RankedAsset[]
  picksBull: RankedAsset[]
  picksBear: RankedAsset[]
  updatedAt: number
}

export interface ObZoneView {
  kind: ObSide
  top: number
  bottom: number
  time: number
  endTime: number
}

export interface ZoneLevels {
  /** Zone center / primary level */
  z: number
  /** Invalidation (stop side) */
  s1: number
  /** First target */
  r1: number
  /** Second target */
  r2: number
  obTop: number
  obBottom: number
}

export interface AssetDetail {
  asset: RankedAsset
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[]
  orderBlocks: ObZoneView[]
  zone: ZoneLevels | null
  vwap: number | null
  rr: number | null
  interval: string
}

export type ObBoardTab = 'bullish' | 'bearish' | 'picks' | 'breadth'
