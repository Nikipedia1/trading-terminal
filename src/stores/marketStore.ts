import { create } from 'zustand'
import type { Candle, Trade, OrderBook, Ticker, Interval, ConnectionStatus, MarketError } from '@/types'
import { binanceClient } from '@/data/exchanges/binance'

interface MarketState {
  symbol: string
  interval: Interval
  candles: Candle[]
  trades: Trade[]
  orderBook: OrderBook | null
  ticker: Ticker | null
  status: ConnectionStatus
  lastError: MarketError | null

  setSymbol: (symbol: string) => void
  setInterval: (interval: Interval) => void
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
  candles: [],
  trades: [],
  orderBook: null,
  ticker: null,
  status: 'disconnected',
  lastError: null,

  setSymbol: (symbol) => {
    get().stopLive()
    set({ symbol: symbol.toUpperCase(), candles: [], trades: [], orderBook: null, ticker: null })
  },

  setInterval: (interval) => {
    get().stopLive()
    set({ interval, candles: [] })
  },

  clearError: () => set({ lastError: null }),

  loadHistorical: async () => {
    const { symbol, interval } = get()
    set({ status: 'connecting', lastError: null })
    try {
      const [candles, ticker, book] = await Promise.all([
        binanceClient.getKlines(symbol, interval, 300),
        binanceClient.getTicker(symbol),
        binanceClient.getOrderBook(symbol, 20),
      ])
      set({
        candles,
        ticker,
        orderBook: book,
        status: 'connected',
      })
    } catch (err: any) {
      set({
        status: 'error',
        lastError: err.code ? err : {
          code: 'LOAD_HIST',
          message: err.message || 'Failed to load historical data',
          exchange: 'binance',
          timestamp: Date.now(),
        },
      })
    }
  },

  startLive: () => {
    const { symbol, interval, stopLive } = get()
    stopLive()

    set({ status: 'connecting', lastError: null })

    unsubKlines = binanceClient.subscribeKlines(
      symbol,
      interval,
      (candle, isFinal) => {
        set((state) => {
          const candles = [...state.candles]
          const last = candles[candles.length - 1]
          if (last && last.time === candle.time) {
            candles[candles.length - 1] = candle
          } else if (!last || candle.time > last.time) {
            candles.push(candle)
            // keep last ~500 candles in memory for performance
            if (candles.length > 500) candles.shift()
          }
          return { candles, status: 'connected' }
        })
      },
      (err) => set({ status: 'error', lastError: err })
    )

    unsubTrades = binanceClient.subscribeTrades(
      symbol,
      (trade) => {
        set((state) => {
          const trades = [trade, ...state.trades].slice(0, 100)
          return { trades }
        })
      },
      (err) => set({ status: 'error', lastError: err })
    )

    unsubDepth = binanceClient.subscribeDepth(
      symbol,
      (book) => set({ orderBook: book }),
      (err) => set({ status: 'error', lastError: err })
    )
  },

  stopLive: () => {
    unsubKlines?.()
    unsubTrades?.()
    unsubDepth?.()
    unsubKlines = null
    unsubTrades = null
    unsubDepth = null
    set({ status: 'disconnected' })
  },
}))
