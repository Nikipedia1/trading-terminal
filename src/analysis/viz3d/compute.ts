/** Build 3D models from real OHLCV + L2 + aggressor trades. Zero synthetic. */

import type { Candle, OrderBook, Trade } from '@/types'
import type {
  Viz3DConfig,
  Viz3DModel,
  TerrainCell,
  CandleColumn,
  BookBar,
  DomRow,
  DomBubble,
  Dom3DOptions,
} from './types'
import { DEFAULT_DOM3D_OPTIONS } from './types'

function emptyModel(mode: Viz3DModel['mode'], note: string): Viz3DModel {
  return {
    mode,
    terrain: [],
    candles: [],
    book: [],
    dom: [],
    bubbles: [],
    priceMin: 0,
    priceMax: 1,
    volMax: 1,
    mid: 0,
    spread: 0,
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
  if (slice.length === 0) return { cols: [], priceMin: 0, priceMax: 1, volMax: 1 }
  let priceMin = Infinity
  let priceMax = -Infinity
  let volMax = 0
  for (const c of slice) {
    priceMin = Math.min(priceMin, c.low)
    priceMax = Math.max(priceMax, c.high)
    volMax = Math.max(volMax, c.volume)
  }
  if (!(priceMax > priceMin)) priceMax = priceMin + 1
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
  if (slice.length === 0) return { cells: [], priceMin: 0, priceMax: 1, volMax: 1 }
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
      const volume = volPer * (inBody ? 1.4 : 0.55)
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
  if (volMax > 0) for (const cell of cells) cell.h = cell.volume / volMax
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
  for (const l of [...bids, ...asks]) {
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

function inferTick(book: OrderBook): number {
  if (book.bids.length < 2) return 0.01
  const diffs: number[] = []
  for (let i = 0; i < Math.min(8, book.bids.length - 1); i++) {
    diffs.push(Math.abs(book.bids[i].price - book.bids[i + 1].price))
  }
  diffs.sort((a, b) => a - b)
  return diffs[0] || 0.01
}

function aggregateLevels(
  levels: { price: number; qty: number }[],
  tickMult: number,
  baseTick: number
): { price: number; qty: number }[] {
  if (tickMult <= 1) return levels
  const step = baseTick * tickMult
  const map = new Map<number, number>()
  for (const l of levels) {
    const p = Math.round(l.price / step) * step
    map.set(p, (map.get(p) ?? 0) + l.qty)
  }
  return Array.from(map.entries())
    .map(([price, qty]) => ({ price, qty }))
    .sort((a, b) => b.price - a.price)
}

/** Deep DOM walls + bubbles from real L2 + trades */
export function buildDeepDom(
  book: OrderBook | null,
  trades: Trade[],
  opts: Dom3DOptions
): {
  rows: DomRow[]
  bubbles: DomBubble[]
  priceMin: number
  priceMax: number
  volMax: number
  mid: number
  spread: number
  totalBid: number
  totalAsk: number
} {
  const empty = {
    rows: [] as DomRow[],
    bubbles: [] as DomBubble[],
    priceMin: 0,
    priceMax: 1,
    volMax: 1,
    mid: 0,
    spread: 0,
    totalBid: 0,
    totalAsk: 0,
  }
  if (!book || (book.bids.length === 0 && book.asks.length === 0)) return empty

  const tick = inferTick(book)
  const n = Math.max(8, Math.min(60, opts.levels))
  let bids = book.bids.slice(0, n * 2)
  let asks = book.asks.slice(0, n * 2)
  if (opts.tickAgg > 1) {
    bids = aggregateLevels(bids, opts.tickAgg, tick)
    asks = aggregateLevels(asks, opts.tickAgg, tick).sort((a, b) => a.price - b.price)
  }
  bids = bids.filter((l) => l.qty >= opts.minLevelSize).slice(0, n)
  asks = asks.filter((l) => l.qty >= opts.minLevelSize).slice(0, n)

  const bestBid = bids[0]?.price ?? 0
  const bestAsk = asks[0]?.price ?? 0
  const mid =
    bestBid > 0 && bestAsk > 0
      ? (bestBid + bestAsk) / 2
      : bestBid || bestAsk || 0
  const spread = bestBid > 0 && bestAsk > 0 ? bestAsk - bestBid : 0

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
  if (prices.length === 0) return empty
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
  const span = priceMax > priceMin ? priceMax - priceMin : 1

  let cumBid = 0
  let cumAsk = 0
  const cumBidMap = new Map<number, number>()
  const cumAskMap = new Map<number, number>()
  for (const p of prices.filter((x) => x <= mid).reverse()) {
    cumBid += priceSet.get(p)!.bid
    cumBidMap.set(p, cumBid)
  }
  for (const p of prices.filter((x) => x >= mid)) {
    cumAsk += priceSet.get(p)!.ask
    cumAskMap.set(p, cumAsk)
  }

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
      flash: null,
    }
  })

  // Cluster aggressor trades into bubbles
  const bubbles: DomBubble[] = []
  if (opts.showBubbles && trades.length > 0) {
    type Acc = {
      id: string
      time: number
      price: number
      base: number
      quote: number
      buy: number
      sell: number
      count: number
    }
    const clusters: Acc[] = []
    // trades are newest-first in marketStore
    const ordered = [...trades].reverse()
    for (const t of ordered) {
      const quote = t.price * t.qty
      if (quote < opts.minBubbleQuote) continue
      const isBuy = !t.isBuyerMaker
      const last = clusters[clusters.length - 1]
      const samePrice =
        last && Math.abs(last.price - t.price) / Math.max(t.price, 1e-9) < 1e-6
      const sameTime =
        last && Math.abs(last.time - t.time) * 1000 <= opts.clusterMs
      if (last && samePrice && sameTime) {
        last.base += t.qty
        last.quote += quote
        last.count += 1
        if (isBuy) last.buy += t.qty
        else last.sell += t.qty
        last.time = t.time
      } else {
        clusters.push({
          id: t.id || `${t.time}-${t.price}`,
          time: t.time,
          price: t.price,
          base: t.qty,
          quote,
          buy: isBuy ? t.qty : 0,
          sell: isBuy ? 0 : t.qty,
          count: 1,
        })
      }
    }
    // Keep largest by quote
    clusters.sort((a, b) => b.quote - a.quote)
    const kept = clusters.slice(0, opts.maxBubbles)
    const maxQ = Math.max(...kept.map((c) => c.quote), 1)
    const tMin = Math.min(...kept.map((c) => c.time), 0)
    const tMax = Math.max(...kept.map((c) => c.time), 1)
    const tSpan = Math.max(1, tMax - tMin)
    for (const c of kept) {
      const ty =
        priceMax > priceMin
          ? ((c.price - priceMin) / (priceMax - priceMin)) * 2 - 1
          : 0
      bubbles.push({
        id: c.id,
        tx: ((c.time - tMin) / tSpan) * 2 - 1,
        ty,
        price: c.price,
        time: c.time,
        r: Math.sqrt(c.quote / maxQ) * opts.bubbleScale,
        quoteQty: c.quote,
        baseQty: c.base,
        aggressor: c.buy >= c.sell ? 'buy' : 'sell',
        clusterCount: c.count,
      })
    }
  }

  return {
    rows,
    bubbles,
    priceMin,
    priceMax,
    volMax,
    mid,
    spread,
    totalBid,
    totalAsk,
  }
}

export function buildViz3DModel(
  candles: Candle[],
  book: OrderBook | null,
  cfg: Viz3DConfig,
  trades: Trade[] = []
): Viz3DModel {
  const domOpts = cfg.dom ?? DEFAULT_DOM3D_OPTIONS

  if (cfg.mode === 'dom_ladder') {
    const {
      rows,
      bubbles,
      priceMin,
      priceMax,
      volMax,
      mid,
      spread,
      totalBid,
      totalAsk,
    } = buildDeepDom(book, trades, {
      ...domOpts,
      levels: cfg.domLevels || domOpts.levels,
    })
    if (rows.length === 0 && bubbles.length === 0) {
      return emptyModel('dom_ladder', 'Waiting for L2 / trades…')
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
      bubbles,
      priceMin,
      priceMax,
      volMax,
      mid,
      spread,
      totalBid,
      totalAsk,
      ready: true,
      barCount: rows.length + bubbles.length,
      note: `Deep DOM · ${rows.length} lv · ${bubbles.length} bubbles · imb ${imb >= 0 ? '+' : ''}${imb.toFixed(1)}%`,
    }
  }

  if (cfg.mode === 'book_depth') {
    const { bars, priceMin, priceMax, volMax } = buildBookDepth(
      book,
      cfg.domLevels || 28
    )
    if (bars.length === 0) return emptyModel('book_depth', 'Waiting for L2 book…')
    return {
      mode: 'book_depth',
      terrain: [],
      candles: [],
      book: bars,
      dom: [],
      bubbles: [],
      priceMin,
      priceMax,
      volMax,
      mid: (priceMin + priceMax) / 2,
      spread: 0,
      totalBid: 0,
      totalAsk: 0,
      ready: true,
      barCount: bars.length,
      note: `Book depth · ${bars.length} levels · real L2`,
    }
  }

  if (candles.length < 4) return emptyModel(cfg.mode, 'Need more candles (≥4)')

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
      bubbles: [],
      priceMin,
      priceMax,
      volMax,
      mid: (priceMin + priceMax) / 2,
      spread: 0,
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
    bubbles: [],
    priceMin,
    priceMax,
    volMax,
    mid: (priceMin + priceMax) / 2,
    spread: 0,
    totalBid: 0,
    totalAsk: 0,
    ready: cells.length > 0,
    barCount: cells.length,
    note: `Volume terrain · ${cells.length} cells · OHLC-derived VP`,
  }
}
