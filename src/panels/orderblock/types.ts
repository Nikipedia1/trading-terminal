/** Order Block desk — crypto market X-ray types */

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

export interface RankedAsset {
  symbol: string
  base: string
  sector: CryptoSector
  lastPrice: number
  changePct: number
  /** Strength: directional move vs typical range (session proxy) */
  strength: number
  volumeQuote: number
  high: number
  low: number
  open: number
  side: ObSide
  rank: number
  percentile: number
  /** LONG/SHORT BUILD-UP style label from price+volume */
  buildUp: 'long' | 'short' | 'neutral'
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
  updatedAt: number
}

export interface ObZoneView {
  kind: ObSide
  top: number
  bottom: number
  time: number
  endTime: number
}

export interface AssetDetail {
  asset: RankedAsset
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[]
  orderBlocks: ObZoneView[]
  /** Zone / invalidation / targets (OrderBlock-style levels) */
  zone: { z: number; s1: number; r1: number; r2: number } | null
  vwap: number | null
  rr: number | null
}

export type ObBoardTab = 'bullish' | 'bearish' | 'breadth'
