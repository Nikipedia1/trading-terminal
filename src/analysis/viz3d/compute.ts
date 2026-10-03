/** Build 3D models from real OHLCV candles + L2 book. Zero synthetic fills. */

import type { Candle, OrderBook } from '@/types'
import type {
  Viz3DConfig,
  Viz3DModel,
  TerrainCell,
  CandleColumn,
  BookBar,
  DomRow,
} from './types'

function emptyModel(mode: Viz3DModel['mode'], note: string): Viz3DModel {
  return {
    mode,
    terrain: [],
    candles: [],
    book: [],
    dom: [],
    priceMin: 0,
    priceMax: 1,
    volMax: 1,
    mid: 0,
    totalBid: 0,
    totalAsk: 0,
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
      const ty =
        priceMax > priceMin
          ? ((l.price - priceMin) / (priceMax - priceMin)) * 2 - 1
          : 0
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

/** Classic DOM ladder from real L2 — aligned price rows, cum + imbalance. */
export function buildDomLadder(
  book: OrderBook | null,
  levels = 24
): {
  rows: DomRow[]
  priceMin: number
  priceMax: number
  volMax: number
  mid: number
  totalBid: number
  totalAsk: number
} {
  if (!book || (book.bids.length === 0 && book.asks.length === 0)) {
    return {
      rows: [],
      priceMin: 0,
      priceMax: 1,
      volMax: 1,
      mid: 0,
      totalBid: 0,
      totalAsk: 0,
    }
  }
  const n = Math.max(8, Math.min(60, levels))
  const bids = book.bids.slice(0, n)
  const asks = book.asks.slice(0, n)
  const bestBid = bids[0]?.price ?? 0
  const bestAsk = asks[0]?.price ?? 0
  const mid =
    bestBid > 0 && bestAsk > 0
      ? (bestBid + bestAsk) / 2
      : bestBid || bestAsk || 0

  // Union of prices (sorted low → high)
  const priceSet = new Map<number, { bid: number; ask: number }>()
  for (const l of bids) {
    const row = priceSet.get(l.price) ?? { bid: 0, ask: 0 }
    row.bid += l.qty
    priceSet.set(l.price, row)
  }
  for (const l of asks) {
    const row = priceSet.get(l.price) ?? { bid: 0, ask: 0 }
    row.ask += l.qty
    priceSet.set(l.price, row)
  }
  const prices = Array.from(priceSet.keys()).sort((a, b) => a - b)
  if (prices.length === 0) {
    return {
      rows: [],
      priceMin: 0,
      priceMax: 1,
      volMax: 1,
      mid,
      totalBid: 0,
      totalAsk: 0,
    }
  }
  const priceMin = prices[0]
  const priceMax = prices[prices.length - 1]
  let volMax = 0
  let totalBid = 0
  let totalAsk = 0
  for (const p of prices) {
    const r = priceSet.get(p)!
    volMax = Math.max(volMax, r.bid, r.ask)
    totalBid += r.bid
    totalAsk += r.ask
  }
  volMax = volMax || 1

  // Cumulative from mid outward (classic DOM)
  let cumBid = 0
  let cumAsk = 0
  const bidPrices = prices.filter((p) => p <= mid).reverse()
  const askPrices = prices.filter((p) => p >= mid)
  const cumBidMap = new Map<number, number>()
  const cumAskMap = new Map<number, number>()
  for (const p of bidPrices) {
    cumBid += priceSet.get(p)!.bid
    cumBidMap.set(p, cumBid)
  }
  for (const p of askPrices) {
    cumAsk += priceSet.get(p)!.ask
    cumAskMap.set(p, cumAsk)
  }

  const span = priceMax > priceMin ? priceMax - priceMin : 1
  const rows: DomRow[] = prices.map((price) => {
    const r = priceSet.get(price)!
    const sum = r.bid + r.ask
    return {
      ty: ((price - priceMin) / span) * 2 - 1,
      price,
      bidQty: r.bid,
      askQty: r.ask,
      bidH: r.bid / volMax,
      askH: r.ask / volMax,
      cumBid: cumBidMap.get(price) ?? 0,
      cumAsk: cumAskMap.get(price) ?? 0,
      imbalance: sum > 0 ? r.bid / sum : 0.5,
    }
  })

  return {
    rows,
    priceMin,
    priceMax,
    volMax,
    mid,
    totalBid,
    totalAsk,
  }
}

export function buildViz3DModel(
  candles: Candle[],
  book: OrderBook | null,
  cfg: Viz3DConfig
): Viz3DModel {
  if (cfg.mode === 'dom_ladder') {
    const { rows, priceMin, priceMax, volMax, mid, totalBid, totalAsk } =
      buildDomLadder(book, cfg.domLevels)
    if (rows.length === 0) {
      return emptyModel('dom_ladder', 'Waiting for L2 DOM…')
    }
    const imb =
      totalBid + totalAsk > 0
        ? ((totalBid - totalAsk) / (totalBid + totalAsk)) * 100
        : 0
    return {
      mode: 'dom_ladder',
      terrain: [],
      candles: [],
      book: [],
      dom: rows,
      priceMin,
      priceMax,
      volMax,
      mid,
      totalBid,
      totalAsk,
      ready: true,
      barCount: rows.length,
      note: `DOM 3D · ${rows.length} lv · bid ${totalBid.toFixed(2)} / ask ${totalAsk.toFixed(2)} · imb ${imb >= 0 ? '+' : ''}${imb.toFixed(1)}%`,
    }
  }

  if (cfg.mode === 'book_depth') {
    const { bars, priceMin, priceMax, volMax } = buildBookDepth(
      book,
      cfg.domLevels || 28
    )
    if (bars.length === 0) {
      return emptyModel('book_depth', 'Waiting for L2 book…')
    }
    return {
      mode: 'book_depth',
      terrain: [],
      candles: [],
      book: bars,
      dom: [],
      priceMin,
      priceMax,
      volMax,
      mid: (priceMin + priceMax) / 2,
      totalBid: 0,
      totalAsk: 0,
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
      dom: [],
      priceMin,
      priceMax,
      volMax,
      mid: (priceMin + priceMax) / 2,
      totalBid: 0,
      totalAsk: 0,
      ready: cols.length > 0,
      barCount: cols.length,
      note: `Candles 3D · ${cols.length} bars · real OHLCV`,
    }
  }

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
    dom: [],
    priceMin,
    priceMax,
    volMax,
    mid: (priceMin + priceMax) / 2,
    totalBid: 0,
    totalAsk: 0,
    ready: cells.length > 0,
    barCount: cells.length,
    note: `Volume terrain · ${cells.length} cells · OHLC-derived VP`,
  }
}
