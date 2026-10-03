/**
 * Primary-panel market store (candles / trades / orderbook / ticker).
 * Trades + L2 book come from shared feeds (one WS per symbol, refcounted).
 * Real data only — robust history + stream throttle under load.
 */

import { create } from 'zustand'
import type {
  Candle,
  Trade,
  OrderBook,
  Ticker,
  Interval,
  ConnectionStatus,
  MarketError,
  ExchangeId,
} from '@/types'
import { getExchangeClient } from '@/data/exchanges/registry'
import { subscribeTradeFeed, subscribeOrderBookFeed } from '@/data/shared'
import { loadHistoryRobust } from '@/data/market/historyLoader'
import { tradeThrottle, bookThrottle } from '@/data/market/streamThrottle'
import { toCanonicalSymbol, toVenueSymbol } from '@/data/market/symbolNormalize'
import { RESYNC_POLICY } from '@/data/market/feedPolicy'

const LIVE_BUFFER_MAX = 1500

interface MarketState {
  symbol: string
  interval: Interval
  exchange: ExchangeId
  candles: Candle[]
  trades: Trade[]
  orderBook: OrderBook | null
  ticker: Ticker | null
  status: ConnectionStatus
  lastError: MarketError | null
  statusDetail?: string
  /** Last history load meta */
  historyMeta?: {
    exchangeUsed: ExchangeId
    fallbackUsed: boolean
    pages: number
    durationMs: number
  }
  streamDropped?: { trades: number; book: number }

  setSymbol: (symbol: string) => void
  setInterval: (interval: Interval) => void
  setExchange: (exchange: ExchangeId) => void
  loadHistorical: (opts?: { pages?: number }) => Promise<void>
  loadMoreHistory: () => Promise<void>
  startLive: () => void
  stopLive: () => void
  clearError: () => void
}

let unsubKlines: (() => void) | null = null
let unsubTrades: (() => void) | null = null
let unsubDepth: (() => void) | null = null
let historyAbort: AbortController | null = null
let tradeTh: ReturnType<typeof tradeThrottle> | null = null
let bookTh: ReturnType<typeof bookThrottle> | null = null

export const useMarketStore = create<MarketState>((set, get) => ({
  symbol: 'BTCUSDT',
  interval: '1m',
  exchange: 'binance',
  candles: [],
  trades: [],
  orderBook: null,
  ticker: null,
  status: 'disconnected',
  lastError: null,
  streamDropped: { trades: 0, book: 0 },

  setSymbol: (symbol) => {
    get().stopLive()
    set({
      symbol: toCanonicalSymbol(symbol),
      candles: [],
      trades: [],
      orderBook: null,
      ticker: null,
      historyMeta: undefined,
    })
  },

  setInterval: (interval) => {
    get().stopLive()
    set({ interval, candles: [], historyMeta: undefined })
  },

  setExchange: (exchange) => {
    get().stopLive()
    set({
      exchange,
      candles: [],
      trades: [],
      orderBook: null,
      ticker: null,
      historyMeta: undefined,
    })
  },

  clearError: () => set({ lastError: null }),

  loadHistorical: async (opts) => {
    const { symbol, interval, exchange } = get()
    historyAbort?.abort()
    historyAbort = new AbortController()
    const signal = historyAbort.signal

    set({
      status: 'connecting',
      lastError: null,
      statusDetail: 'loading history (multi-page + fallback)',
    })

    const hist = await loadHistoryRobust(exchange, symbol, interval, {
      pages: opts?.pages ?? RESYNC_POLICY.initialPages,
      signal,
      allowFallback: true,
    })

    if (hist.aborted) return

    if (hist.error || hist.candles.length === 0) {
      set({
        status: 'error',
        lastError: {
          code: 'LOAD_HIST',
          message: hist.error || 'Failed to load historical data',
          exchange,
          timestamp: Date.now(),
        },
        statusDetail: hist.error,
      })
      return
    }

    // Ticker + book still from primary (or exchangeUsed if fallback)
    const used = hist.exchangeUsed
    const client = getExchangeClient(used)
    const venueSym = toVenueSymbol(symbol, used)
    try {
      const [ticker, book] = await Promise.all([
        client.getTicker(venueSym),
        client.getOrderBook(venueSym, 20),
      ])
      set({
        candles: hist.candles,
        ticker,
        orderBook: book,
        status: 'connected',
        statusDetail: hist.fallbackUsed
          ? `history via ${used} (fallback)`
          : undefined,
        historyMeta: {
          exchangeUsed: used,
          fallbackUsed: hist.fallbackUsed,
          pages: hist.pages,
          durationMs: hist.durationMs,
        },
      })
    } catch (err: any) {
      // History OK even if ticker/book fail
      set({
        candles: hist.candles,
        status: 'connected',
        statusDetail: `history ok; book/ticker: ${err?.message || 'fail'}`,
        historyMeta: {
          exchangeUsed: used,
          fallbackUsed: hist.fallbackUsed,
          pages: hist.pages,
          durationMs: hist.durationMs,
        },
      })
    }
  },

  loadMoreHistory: async () => {
    const { symbol, interval, exchange, candles } = get()
    if (candles.length === 0) {
      await get().loadHistorical({ pages: RESYNC_POLICY.initialPages + 2 })
      return
    }
    historyAbort?.abort()
    historyAbort = new AbortController()
    set({ statusDetail: 'loading deeper history…' })
    const hist = await loadHistoryRobust(exchange, symbol, interval, {
      pages: 3,
      signal: historyAbort.signal,
      allowFallback: true,
    })
    if (hist.aborted || hist.candles.length === 0) {
      set({ statusDetail: hist.error })
      return
    }
    const { mergeHistory } = await import('@/data/market/historyLoader')
    const merged = mergeHistory(candles, hist.candles)
    set({
      candles: merged,
      statusDetail: `history ${merged.length} bars`,
      historyMeta: {
        exchangeUsed: hist.exchangeUsed,
        fallbackUsed: hist.fallbackUsed,
        pages: hist.pages,
        durationMs: hist.durationMs,
      },
    })
  },

  startLive: () => {
    const { symbol, interval, exchange, stopLive } = get()
    stopLive()
    const client = getExchangeClient(exchange)
    const venueSym = toVenueSymbol(symbol, exchange)

    set({
      status: 'connecting',
      lastError: null,
      statusDetail: 'opening websocket',
      streamDropped: { trades: 0, book: 0 },
    })

    const onStatus = (status: ConnectionStatus, detail?: string) => {
      set({ status, statusDetail: detail })
    }

    unsubKlines = client.subscribeKlines(
      venueSym,
      interval,
      (candle) => {
        set((state) => {
          const candles = [...state.candles]
          const last = candles[candles.length - 1]
          if (last && last.time === candle.time) {
            candles[candles.length - 1] = candle
          } else if (!last || candle.time > last.time) {
            candles.push(candle)
            if (candles.length > LIVE_BUFFER_MAX) candles.shift()
          }
          return { candles, status: 'connected', lastError: null }
        })
      },
      (err) => set({ status: 'error', lastError: err, statusDetail: err.message }),
      onStatus
    )

    tradeTh = tradeThrottle((trade: Trade) => {
      set((state) => ({
        trades: [trade, ...state.trades].slice(0, 100),
        streamDropped: {
          trades: tradeTh?.dropped() ?? 0,
          book: state.streamDropped?.book ?? 0,
        },
      }))
    })

    const tradeSub = subscribeTradeFeed(exchange, symbol, {
      onTrade: (t) => {
        const trade: Trade = {
          id: t.id,
          time: t.time,
          price: t.price,
          qty: t.qty,
          isBuyerMaker: t.isBuyerMaker,
          symbol: t.symbol,
        }
        tradeTh?.call(trade)
      },
      onError: ({ error }) => set({ lastError: error }),
    })
    unsubTrades = () => {
      tradeSub.unsubscribe()
      tradeTh?.reset()
      tradeTh = null
    }

    bookTh = bookThrottle((snap: OrderBook) => {
      set((state) => ({
        orderBook: snap,
        streamDropped: {
          trades: state.streamDropped?.trades ?? 0,
          book: bookTh?.dropped() ?? 0,
        },
      }))
    })

    const bookSub = subscribeOrderBookFeed(exchange, symbol, {
      onBook: (snap) => {
        if (!snap.ready) return
        bookTh?.call({
          symbol: snap.symbol,
          lastUpdateId: snap.lastUpdateId,
          bids: snap.bids,
          asks: snap.asks,
        })
      },
      onError: ({ error }) => set({ lastError: error }),
    })
    unsubDepth = () => {
      bookSub.unsubscribe()
      bookTh?.reset()
      bookTh = null
    }
  },

  stopLive: () => {
    historyAbort?.abort()
    historyAbort = null
    unsubKlines?.()
    unsubTrades?.()
    unsubDepth?.()
    unsubKlines = null
    unsubTrades = null
    unsubDepth = null
    tradeTh = null
    bookTh = null
    set({ status: 'disconnected', statusDetail: undefined })
  },
}))
