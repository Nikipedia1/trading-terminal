/** Professional 3D market visualization — types & presets. Real OHLCV / L2 only. */

export type Viz3DMode =
  | 'volume_terrain'
  | 'candle_columns'
  | 'book_depth'
  | 'dom_ladder'

export interface Viz3DConfig {
  mode: Viz3DMode
  yaw: number
  pitch: number
  zoom: number
  autoRotate: boolean
  autoRotateSpeed: number
  showGrid: boolean
  showLabels: boolean
  maxBars: number
  priceBins: number
  domLevels: number
  opacity: number
  theme: 'desk' | 'neon' | 'mono' | 'aurora' | 'magma' | 'ocean' | 'matrix' | 'gold' | 'ice' | 'cyber'
  syncVisible: boolean
  /** Deep DOM (Deep Chart-style) options */
  dom: Dom3DOptions
}

/** Full customization for Deep DOM 3D — bubbles + walls + filters */
export interface Dom3DOptions {
  /** Draw resting L2 liquidity walls */
  showWalls: boolean
  /** Draw aggressor trade bubbles */
  showBubbles: boolean
  /** Size labels on medium/large bubbles */
  showBubbleLabels: boolean
  /** Show mid line + spread */
  showMid: boolean
  /** Show pull/refill flash tint on walls */
  showFlash: boolean
  /** Levels per side */
  levels: number
  /** Tick aggregation multiplier (1 = raw) */
  tickAgg: 1 | 5 | 10
  /** Hide levels below this base qty */
  minLevelSize: number
  /** Min quote notional (USDT) for a bubble */
  minBubbleQuote: number
  /** Bubble radius scale */
  bubbleScale: number
  /** Max bubbles kept in scene */
  maxBubbles: number
  /** Cluster trades within ms at same price */
  clusterMs: number
  /** Wall bar opacity 0–1 */
  wallOpacity: number
  /** Bubble opacity 0–1 */
  bubbleOpacity: number
}

export const DEFAULT_DOM3D_OPTIONS: Dom3DOptions = {
  showWalls: true,
  showBubbles: true,
  showBubbleLabels: true,
  showMid: true,
  showFlash: true,
  levels: 28,
  tickAgg: 1,
  minLevelSize: 0,
  minBubbleQuote: 2_000,
  bubbleScale: 1,
  maxBubbles: 80,
  clusterMs: 200,
  wallOpacity: 0.75,
  bubbleOpacity: 0.9,
}

export const DEFAULT_VIZ3D_CONFIG: Viz3DConfig = {
  mode: 'volume_terrain',
  yaw: 42,
  pitch: 28,
  zoom: 1,
  autoRotate: false,
  autoRotateSpeed: 0.15,
  showGrid: true,
  showLabels: true,
  maxBars: 80,
  priceBins: 32,
  domLevels: 24,
  opacity: 0.85,
  theme: 'desk',
  syncVisible: true,
  dom: { ...DEFAULT_DOM3D_OPTIONS },
}

export const VIZ3D_PRESETS: Record<
  string,
  { label: string; patch: Partial<Viz3DConfig> }
> = {
  terrain: {
    label: 'Terrain',
    patch: { mode: 'volume_terrain', pitch: 32, yaw: 40, zoom: 1 },
  },
  candles: {
    label: 'Candles 3D',
    patch: { mode: 'candle_columns', pitch: 22, yaw: 35, zoom: 1.05 },
  },
  book: {
    label: 'Book 3D',
    patch: { mode: 'book_depth', pitch: 35, yaw: 50, zoom: 1.1 },
  },
  deepDom: {
    label: 'Deep DOM',
    patch: {
      mode: 'dom_ladder',
      pitch: 16,
      yaw: 28,
      zoom: 1.2,
      dom: { ...DEFAULT_DOM3D_OPTIONS },
    },
  },
  neon: {
    label: 'Neon',
    patch: { theme: 'neon', opacity: 0.9 },
  },
}

export interface TerrainCell {
  tx: number
  ty: number
  h: number
  buyFrac: number
  price: number
  time: number
  volume: number
}

export interface CandleColumn {
  tx: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  time: number
  bull: boolean
}

export interface BookBar {
  side: number
  ty: number
  h: number
  price: number
  qty: number
  isBid: boolean
}

export interface DomRow {
  ty: number
  price: number
  bidQty: number
  askQty: number
  bidH: number
  askH: number
  cumBid: number
  cumAsk: number
  imbalance: number
  /** pull | refill flash hint */
  flash: 'pull' | 'refill' | null
}

/** Aggressor trade bubble — Deep Chart style */
export interface DomBubble {
  id: string
  /** normalized X along recent time (-1..1) */
  tx: number
  /** normalized price Y */
  ty: number
  price: number
  time: number
  /** 0..1 radius factor */
  r: number
  quoteQty: number
  baseQty: number
  aggressor: 'buy' | 'sell'
  clusterCount: number
}

export interface Viz3DModel {
  mode: Viz3DMode
  terrain: TerrainCell[]
  candles: CandleColumn[]
  book: BookBar[]
  dom: DomRow[]
  bubbles: DomBubble[]
  priceMin: number
  priceMax: number
  volMax: number
  mid: number
  spread: number
  totalBid: number
  totalAsk: number
  ready: boolean
  barCount: number
  note: string
}
