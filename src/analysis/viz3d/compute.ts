/** Build 3D models from real OHLCV candles + L2 book. Zero synthetic fills. */

import type { Candle, OrderBook } from '@/types'
import type {
  Viz3DConfig,
  Viz3DModel,
  TerrainCell,
  CandleColumn,
  BookBar,
} from './types'

function emptyModel(mode: Viz3DModel['mode'], note: string): Viz3DModel {
  return {
    mode,
    terrain: [],
    candles: [],
    book: [],
    priceMin: 0,
    priceMax: 1,
    volMax: 1,
    ready: false,
    barCount: 0,
    note,
  }
}

export function buildCandleColumns(
  candles: Candle[],
  maxBars: number
): { cols: CandleColumn[]; priceMin: number; priceMax: number; volMax: number } {
  const slice = candles.slice(-Math.max(8, maxBars))
  if (slice.length === 0) {
    return { cols: [], priceMin: 0, priceMax: 1, volMax: 1 }
  }
  let priceMin = Infinity
  let priceMax = -Infinity
  let volMax = 0
  for (const c of slice) {
    priceMin = Math.min(priceMin, c.low)
    priceMax = Math.max(priceMax, c.high)
    volMax = Math.max(volMax, c.volume)
  }
  if (!(priceMax > priceMin)) {
    priceMax = priceMin + 1
  }
  const n = slice.length
  const cols: CandleColumn[] = slice.map((c, i) => ({
    tx: n <= 1 ? 0 : (i / (n - 1)) * 2 - 1,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    time: c.time,
    bull: c.close >= c.open,
  }))
  return { cols, priceMin, priceMax, volMax: volMax || 1 }
}

export function buildVolumeTerrain(
  candles: Candle[],
  maxBars: number,
  priceBins: number
): {
  cells: TerrainCell[]
  priceMin: number
  priceMax: number
  volMax: number
} {
  const slice = candles.slice(-Math.max(8, maxBars))
  if (slice.length === 0) {
    return { cells: [], priceMin: 0, priceMax: 1, volMax: 1 }
  }
  let priceMin = Infinity
  let priceMax = -Infinity
  for (const c of slice) {
    priceMin = Math.min(priceMin, c.low)
    priceMax = Math.max(priceMax, c.high)
  }
  if (!(priceMax > priceMin)) priceMax = priceMin + 1
  const bins = Math.max(8, Math.min(64, priceBins))
  const span = priceMax - priceMin
  const n = slice.length
  const cells: TerrainCell[] = []
  let volMax = 0

  for (let i = 0; i < n; i++) {
    const c = slice[i]
    const tx = n <= 1 ? 0 : (i / (n - 1)) * 2 - 1
    // Distribute bar volume across price bins covered by the candle range
    const loBin = Math.max(0, Math.floor(((c.low - priceMin) / span) * bins))
    const hiBin = Math.min(bins - 1, Math.ceil(((c.high - priceMin) / span) * bins))
    const bodyLo = Math.min(c.open, c.close)
    const bodyHi = Math.max(c.open, c.close)
    const rangeBins = Math.max(1, hiBin - loBin + 1)
    const volPer = c.volume / rangeBins
    const bull = c.close >= c.open
    for (let b = loBin; b <= hiBin; b++) {
      const price = priceMin + ((b + 0.5) / bins) * span
      const inBody = price >= bodyLo && price <= bodyHi
      // Body gets more weight than wicks (classic VP approximation from OHLC)
      const weight = inBody ? 1.4 : 0.55
      const volume = volPer * weight
      volMax = Math.max(volMax, volume)
      const ty = bins <= 1 ? 0 : (b / (bins - 1)) * 2 - 1
      cells.push({
        tx,
        ty,
        h: volume,
        buyFrac: bull ? 0.65 : 0.35,
        price,
        time: c.time,
        volume,
      })
    }
  }
  // Normalize heights
  if (volMax > 0) {
    for (const cell of cells) cell.h = cell.volume / volMax
  }
  return { cells, priceMin, priceMax, volMax: volMax || 1 }
}

export function buildBookDepth(book: OrderBook | null, levels = 24): {
  bars: BookBar[]
  priceMin: number
  priceMax: number
  volMax: number
} {
  if (!book || (book.bids.length === 0 && book.asks.length === 0)) {
    return { bars: [], priceMin: 0, priceMax: 1, volMax: 1 }
  }
  const bids = book.bids.slice(0, levels)
  const asks = book.asks.slice(0, levels)
  let priceMin = Infinity
  let priceMax = -Infinity
  let volMax = 0
  for (const l of bids) {
    priceMin = Math.min(priceMin, l.price)
    priceMax = Math.max(priceMax, l.price)
    volMax = Math.max(volMax, l.qty)
  }
  for (const l of asks) {
    priceMin = Math.min(priceMin, l.price)
    priceMax = Math.max(priceMax, l.price)
    volMax = Math.max(volMax, l.qty)
  }
  if (!(priceMax > priceMin)) priceMax = priceMin + 1
  const bars: BookBar[] = []
  const mapSide = (arr: { price: number; qty: number }[], isBid: boolean) => {
    const m = arr.length
    arr.forEach((l, i) => {
      const ty = priceMax > priceMin ? ((l.price - priceMin) / (priceMax - priceMin)) * 2 - 1 : 0
      // Rank depth along X: near mid = center, deeper = outer
      const rank = m <= 1 ? 0 : i / (m - 1)
      const side = isBid ? -(0.15 + rank * 0.85) : 0.15 + rank * 0.85
      bars.push({
        side,
        ty,
        h: volMax > 0 ? l.qty / volMax : 0,
        price: l.price,
        qty: l.qty,
        isBid,
      })
    })
  }
  mapSide(bids, true)
  mapSide(asks, false)
  return { bars, priceMin, priceMax, volMax: volMax || 1 }
}

export function buildViz3DModel(
  candles: Candle[],
  book: OrderBook | null,
  cfg: Viz3DConfig
): Viz3DModel {
  if (cfg.mode === 'book_depth') {
    const { bars, priceMin, priceMax, volMax } = buildBookDepth(book, 28)
    if (bars.length === 0) {
      return emptyModel('book_depth', 'Waiting for L2 book…')
    }
    return {
      mode: 'book_depth',
      terrain: [],
      candles: [],
      book: bars,
      priceMin,
      priceMax,
      volMax,
      ready: true,
      barCount: bars.length,
      note: `Book depth · ${bars.length} levels · real L2`,
    }
  }

  if (candles.length < 4) {
    return emptyModel(cfg.mode, 'Need more candles (≥4)')
  }

  if (cfg.mode === 'candle_columns') {
    const { cols, priceMin, priceMax, volMax } = buildCandleColumns(
      candles,
      cfg.maxBars
    )
    return {
      mode: 'candle_columns',
      terrain: [],
      candles: cols,
      book: [],
      priceMin,
      priceMax,
      volMax,
      ready: cols.length > 0,
      barCount: cols.length,
      note: `Candles 3D · ${cols.length} bars · real OHLCV`,
    }
  }

  // volume_terrain
  const { cells, priceMin, priceMax, volMax } = buildVolumeTerrain(
    candles,
    cfg.maxBars,
    cfg.priceBins
  )
  return {
    mode: 'volume_terrain',
    terrain: cells,
    candles: [],
    book: [],
    priceMin,
    priceMax,
    volMax,
    ready: cells.length > 0,
    barCount: cells.length,
    note: `Volume terrain · ${cells.length} cells · OHLC-derived VP`,
  }
}
