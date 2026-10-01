/**
 * Live microstructure engine – subscribes to shared feeds only.
 * Publishes rolling OFI / multi-level OFI / depth imbalance / VPIN from real data.
 */

import { subscribeTradeFeed, subscribeOrderBookFeed } from '@/data/shared'
import type { AggressorTrade, OrderBookSnapshot } from '@/data/shared'
import type { ExchangeId } from '@/types'
import {
  type L1Quote,
  type LnQuote,
  ofiContribution,
  depthImbalance,
  weightedMid,
  relativeSpreadBps,
  multiLevelOfiContribution,
  multiLevelDepthImbalance,
  lnQuoteFromLevels,
  topOfLn,
} from './ofi'
import {
  type SignedTrade,
  type VolumeBucket,
  bucketByVolume,
  vpin,
  tradeImbalance,
} from './vpin'

const MAX_QUOTES = 2_000
const MAX_TRADES = 8_000
const DEFAULT_BUCKET_VOL = 50 // base asset units – adaptive below
const VPIN_WINDOW = 50
const DEFAULT_MULTI_LEVELS = 5

export interface MicroSnapshot {
  exchange: ExchangeId
  symbol: string
  /** Cumulative L1 OFI since subscribe */
  ofiCum: number
  /** Last step L1 OFI contribution */
  ofiStep: number
  /** Cumulative multi-level OFI (top-N) */
  multiOfiCum: number
  /** Last step multi-level OFI */
  multiOfiStep: number
  /** Levels used for multi-level metrics */
  multiLevels: number
  depthImb: number
  /** Multi-level depth imbalance [-1, 1] */
  multiDepthImb: number
  mid: number | null
  microPrice: number | null
  spreadBps: number | null
  tradeImb: number
  vpin: number | null
  bucketCount: number
  tradeCount: number
  quoteCount: number
  ready: boolean
  updatedAt: number
}

export type MicroListener = (snap: MicroSnapshot) => void

export interface MicroEngineHandle {
  unsubscribe: () => void
  getSnapshot: () => MicroSnapshot
}

function buildLn(book: OrderBookSnapshot, levels: number): LnQuote | null {
  if (!book.bids.length || !book.asks.length) return null
  return lnQuoteFromLevels(book.bids, book.asks, levels, book.updatedAt)
}

export function startMicroEngine(
  exchange: ExchangeId,
  symbol: string,
  onUpdate: MicroListener,
  opts?: { vpinBucketVol?: number; vpinWindow?: number; multiLevels?: number }
): MicroEngineHandle {
  const sym = symbol.toUpperCase()
  const multiLevels = opts?.multiLevels ?? DEFAULT_MULTI_LEVELS
  const quotes: L1Quote[] = []
  const lnQuotes: LnQuote[] = []
  const signed: SignedTrade[] = []
  let ofiCum = 0
  let ofiStep = 0
  let multiOfiCum = 0
  let multiOfiStep = 0
  let lastQuote: L1Quote | null = null
  let lastLn: LnQuote | null = null
  let buckets: VolumeBucket[] = []
  let bucketVol = opts?.vpinBucketVol ?? DEFAULT_BUCKET_VOL
  const vpinWindow = opts?.vpinWindow ?? VPIN_WINDOW
  let ready = false

  const emit = () => {
    const q = lastQuote
    const ln = lastLn
    const snap: MicroSnapshot = {
      exchange,
      symbol: sym,
      ofiCum,
      ofiStep,
      multiOfiCum,
      multiOfiStep,
      multiLevels,
      depthImb: q ? depthImbalance(q) : 0,
      multiDepthImb: ln ? multiLevelDepthImbalance(ln, multiLevels) : 0,
      mid: q ? (q.bidPrice + q.askPrice) / 2 : null,
      microPrice: q ? weightedMid(q) : null,
      spreadBps: q ? relativeSpreadBps(q) : null,
      tradeImb: tradeImbalance(signed),
      vpin: vpin(buckets, vpinWindow),
      bucketCount: buckets.length,
      tradeCount: signed.length,
      quoteCount: quotes.length,
      ready,
      updatedAt: Date.now(),
    }
    onUpdate(snap)
  }

  const bookSub = subscribeOrderBookFeed(exchange, sym, {
    onBook: (snap) => {
      if (!snap.ready) return
      const ln = buildLn(snap, multiLevels)
      if (!ln) return
      const q = topOfLn(ln)
      if (!q) return

      if (lastQuote) {
        ofiStep = ofiContribution(lastQuote, q)
        ofiCum += ofiStep
      }
      if (lastLn) {
        multiOfiStep = multiLevelOfiContribution(lastLn, ln, multiLevels, 'equal')
        multiOfiCum += multiOfiStep
      }

      lastQuote = q
      lastLn = ln
      quotes.push(q)
      lnQuotes.push(ln)
      if (quotes.length > MAX_QUOTES) quotes.splice(0, quotes.length - MAX_QUOTES)
      if (lnQuotes.length > MAX_QUOTES) lnQuotes.splice(0, lnQuotes.length - MAX_QUOTES)
      ready = true
      emit()
    },
    onStatus: () => {},
    onError: () => {
      /* surface via ready=false – never invent book */
    },
  })

  const tradeSub = subscribeTradeFeed(exchange, sym, {
    onTrade: (t: AggressorTrade) => {
      signed.push({
        price: t.price,
        qty: t.qty,
        sign: t.aggressor === 'buy' ? 1 : -1,
        time: t.time,
      })
      if (signed.length > MAX_TRADES) signed.splice(0, signed.length - MAX_TRADES)

      // Adaptive bucket: ~1/50 of recent notional in base terms
      if (signed.length >= 100 && bucketVol === DEFAULT_BUCKET_VOL) {
        const recent = signed.slice(-200)
        const avg =
          recent.reduce((s, x) => s + x.qty, 0) / Math.max(1, recent.length)
        if (avg > 0) bucketVol = Math.max(avg * 20, avg)
      }

      buckets = bucketByVolume(signed, bucketVol)
      emit()
    },
    onStatus: () => {},
    onError: () => {},
  })

  return {
    unsubscribe: () => {
      bookSub.unsubscribe()
      tradeSub.unsubscribe()
    },
    getSnapshot: () => {
      const q = lastQuote
      const ln = lastLn
      return {
        exchange,
        symbol: sym,
        ofiCum,
        ofiStep,
        multiOfiCum,
        multiOfiStep,
        multiLevels,
        depthImb: q ? depthImbalance(q) : 0,
        multiDepthImb: ln ? multiLevelDepthImbalance(ln, multiLevels) : 0,
        mid: q ? (q.bidPrice + q.askPrice) / 2 : null,
        microPrice: q ? weightedMid(q) : null,
        spreadBps: q ? relativeSpreadBps(q) : null,
        tradeImb: tradeImbalance(signed),
        vpin: vpin(buckets, vpinWindow),
        bucketCount: buckets.length,
        tradeCount: signed.length,
        quoteCount: quotes.length,
        ready,
        updatedAt: Date.now(),
      }
    },
  }
}
