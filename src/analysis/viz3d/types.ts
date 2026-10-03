/** Professional 3D market visualization — types & presets. Real OHLCV / L2 only. */

export type Viz3DMode = 'volume_terrain' | 'candle_columns' | 'book_depth'

export interface Viz3DConfig {
  mode: Viz3DMode
  /** Camera yaw degrees */
  yaw: number
  /** Camera pitch degrees */
  pitch: number
  /** Zoom scale */
  zoom: number
  /** Auto-rotate scene */
  autoRotate: boolean
  autoRotateSpeed: number
  /** Show grid floor */
  showGrid: boolean
  /** Show axis labels */
  showLabels: boolean
  /** Max candles / snapshots in scene */
  maxBars: number
  /** Price bins for volume terrain */
  priceBins: number
  /** Opacity of fills 0–1 */
  opacity: number
  /** Color scheme */
  theme: 'desk' | 'neon' | 'mono'
  /** Follow primary chart visible time range */
  syncVisible: boolean
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
  opacity: 0.85,
  theme: 'desk',
  syncVisible: true,
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
  neon: {
    label: 'Neon',
    patch: { theme: 'neon', opacity: 0.9 },
  },
}

export interface TerrainCell {
  /** normalized 0..1 along time axis */
  tx: number
  /** normalized 0..1 along price axis */
  ty: number
  /** height 0..1 (volume intensity) */
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
  /** -1..1 side (bid negative, ask positive) */
  side: number
  /** normalized price rank */
  ty: number
  h: number
  price: number
  qty: number
  isBid: boolean
}

export interface Viz3DModel {
  mode: Viz3DMode
  terrain: TerrainCell[]
  candles: CandleColumn[]
  book: BookBar[]
  priceMin: number
  priceMax: number
  volMax: number
  ready: boolean
  barCount: number
  note: string
}
