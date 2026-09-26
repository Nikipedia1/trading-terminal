/**
 * Primary-panel market store (trades / orderbook / ticker).
 * REST snapshot + reconnecting WS. Real data only.
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

  setSymbol: (symbol: string) => void
  setInterval: (interval: Interval) => void
  setExchange: (exchange: ExchangeId) => void
  loadHistorical: () => Promise<void>
  startLive: () => void
  stopLive: () => void
  clearError: () => void
}

let unsubKlines: (() => void) | null = null
let unsubTrades: (() => void) | null = null
let unsubDepth: (() => void) | null = null

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

  setSymbol: (symbol) => {
    get().stopLive()
    set({
      symbol: symbol.toUpperCase(),
      candles: [],
      trades: [],
      orderBook: null,
      ticker: null,
    })
  },

  setInterval: (interval) => {
    get().stopLive()
    set({ interval, candles: [] })
  },

  setExchange: (exchange) => {
    get().stopLive()
    set({ exchange, candles: [], trades: [], orderBook: null, ticker: null })
  },

  clearError: () => set({ lastError: null }),

  loadHistorical: async () => {
    const { symbol, interval, exchange } = get()
    const client = getExchangeClient(exchange)
    set({ status: 'connecting', lastError: null, statusDetail: 'loading history' })
    try {
      const [candles, ticker, book] = await Promise.all([
        client.getKlines(symbol, interval, 300),
        client.getTicker(symbol),
        client.getOrderBook(symbol, 20),
      ])
      set({
        candles,
        ticker,
        orderBook: book,
        status: 'connected',
        statusDetail: undefined,
      })
    } catch (err: any) {
      set({
        status: 'error',
        lastError: err.code
          ? err
          : {
              code: 'LOAD_HIST',
              message: err.message || 'Failed to load historical data',
              exchange,
              timestamp: Date.now(),
            },
        statusDetail: err.message,
      })
    }
  },

  startLive: () => {
    const { symbol, interval, exchange, stopLive } = get()
    stopLive()
    const client = getExchangeClient(exchange)

    set({ status: 'connecting', lastError: null, statusDetail: 'opening websocket' })

    const onStatus = (status: ConnectionStatus, detail?: string) => {
      set({ status, statusDetail: detail })
    }

    unsubKlines = client.subscribeKlines(
      symbol,
      interval,
      (candle) => {
        set((state) => {
          const candles = [...state.candles]
          const last = candles[candles.length - 1]
          if (last && last.time === candle.time) {
            candles[candles.length - 1] = candle
          } else if (!last || candle.time > last.time) {
            candles.push(candle)
            if (candles.length > 500) candles.shift()
          }
          return { candles, status: 'connected', lastError: null }
        })
      },
      (err) => set({ status: 'error', lastError: err, statusDetail: err.message }),
      onStatus
    )

    unsubTrades = client.subscribeTrades(
      symbol,
      (trade) => {
        set((state) => {
          const trades = [trade, ...state.trades].slice(0, 100)
          return { trades }
        })
      },
      (err) => set({ status: 'error', lastError: err }),
      undefined
    )

    unsubDepth = client.subscribeDepth(
      symbol,
      (book) => set({ orderBook: book }),
      (err) => {
        // KuCoin incremental depth may not deliver full book – don't wipe UI on soft issues
        if (err.code === 'WS_ERROR') {
          set({ lastError: err })
        }
      },
      undefined
    )
  },

  stopLive: () => {
    unsubKlines?.()
    unsubTrades?.()
    unsubDepth?.()
    unsubKlines = null
    unsubTrades = null
    unsubDepth = null
    set({ status: 'disconnected', statusDetail: undefined })
  },
}))
