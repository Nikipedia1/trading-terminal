/**
 * Binance Spot – real REST + reconnecting WebSocket.
 * REST: https://api.binance.com
 * WS:   wss://stream.binance.com:9443
 *
 * Limits (public): ~1200 request weight/min/IP; klines limit≤1000;
 * WS ~5 msg/s inbound control, many market streams OK.
 * Never returns mock data.
 */

import type {
  Candle,
  Trade,
  OrderBook,
  Ticker,
  Interval,
  ConnectionStatus,
  MarketError,
} from '@/types'
import type { ExchangeClient, StatusCallback } from './types'
import { ReconnectingWebSocket } from '@/data/ws/reconnecting-ws'

const REST_BASE = 'https://api.binance.com'
const WS_BASE = 'wss://stream.binance.com:9443'

function toBinanceInterval(interval: Interval): string {
  return interval
}

function createError(code: string, message: string): MarketError {
  return {
    code,
    message,
    exchange: 'binance',
    timestamp: Date.now(),
  }
}

export class BinanceClient implements ExchangeClient {
  readonly name = 'binance'
  private status: ConnectionStatus = 'disconnected'

  getStatus(): ConnectionStatus {
    return this.status
  }

  // ─── REST ───────────────────────────────────────────────────────────────

  async getKlines(symbol: string, interval: Interval, limit = 500): Promise<Candle[]> {
    const lim = Math.min(Math.max(limit, 1), 1000)
    const url = `${REST_BASE}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${toBinanceInterval(interval)}&limit=${lim}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.text()
        if (res.status === 429) {
          throw createError('RATE_LIMIT', `Binance rate limit (429). Weight budget ~1200/min per IP. ${body}`)
        }
        if (res.status === 400) {
          throw createError('BAD_SYMBOL', `Binance rejected request (invalid symbol/interval?): ${body}`)
        }
        throw createError('REST_KLINES', `HTTP ${res.status}: ${body}`)
      }
      const raw: any[][] = await res.json()
      if (!Array.isArray(raw) || raw.length === 0) {
        throw createError('EMPTY_KLINES', `No klines returned for ${symbol} ${interval}`)
      }
      return raw.map((k) => ({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }))
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_KLINES', err.message || 'Unknown error fetching klines')
    }
  }

  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const url = `${REST_BASE}/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=${limit}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.text()
        if (res.status === 429) {
          throw createError('RATE_LIMIT', `Binance rate limit (429). ${body}`)
        }
        throw createError('REST_DEPTH', `HTTP ${res.status}: ${body}`)
      }
      const raw = await res.json()
      return {
        symbol: symbol.toUpperCase(),
        lastUpdateId: raw.lastUpdateId,
        bids: raw.bids.map(([p, q]: [string, string]) => ({
          price: parseFloat(p),
          qty: parseFloat(q),
        })),
        asks: raw.asks.map(([p, q]: [string, string]) => ({
          price: parseFloat(p),
          qty: parseFloat(q),
        })),
      }
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_DEPTH', err.message || 'Unknown error fetching order book')
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const url = `${REST_BASE}/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.text()
        if (res.status === 429) {
          throw createError('RATE_LIMIT', `Binance rate limit (429). ${body}`)
        }
        throw createError('REST_TICKER', `HTTP ${res.status}: ${body}`)
      }
      const raw = await res.json()
      return {
        symbol: raw.symbol,
        lastPrice: parseFloat(raw.lastPrice),
        priceChange: parseFloat(raw.priceChange),
        priceChangePercent: parseFloat(raw.priceChangePercent),
        highPrice: parseFloat(raw.highPrice),
        lowPrice: parseFloat(raw.lowPrice),
        volume: parseFloat(raw.volume),
        quoteVolume: parseFloat(raw.quoteVolume),
      }
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_TICKER', err.message || 'Unknown error fetching ticker')
    }
  }

  // ─── WebSocket ──────────────────────────────────────────────────────────

  private subscribeStream(
    stream: string,
    onData: (data: any) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const url = `${WS_BASE}/ws/${stream}`
    const rws = new ReconnectingWebSocket(url, {
      minBackoffMs: 1000,
      maxBackoffMs: 30_000,
      onStatus: (s, detail) => {
        this.status = s
        onStatus?.(s, detail)
      },
      onMessage: (data) => {
        onData(data)
      },
      onError: (msg) => {
        onError(createError('WS_ERROR', msg))
      },
    })
    void rws.connect()
    return () => rws.close()
  }

  subscribeKlines(
    symbol: string,
    interval: Interval,
    onCandle: (candle: Candle, isFinal: boolean) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const stream = `${symbol.toLowerCase()}@kline_${toBinanceInterval(interval)}`
    return this.subscribeStream(
      stream,
      (data) => {
        if (data.e !== 'kline') return
        const k = data.k
        onCandle(
          {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          },
          k.x === true
        )
      },
      onError,
      onStatus
    )
  }

  subscribeTrades(
    symbol: string,
    onTrade: (trade: Trade) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const stream = `${symbol.toLowerCase()}@aggTrade`
    return this.subscribeStream(
      stream,
      (data) => {
        if (data.e !== 'aggTrade') return
        onTrade({
          id: String(data.a),
          time: data.T,
          price: parseFloat(data.p),
          qty: parseFloat(data.q),
          isBuyerMaker: data.m,
          symbol: data.s,
        })
      },
      onError,
      onStatus
    )
  }

  subscribeDepth(
    symbol: string,
    onUpdate: (book: OrderBook) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const stream = `${symbol.toLowerCase()}@depth20@100ms`
    return this.subscribeStream(
      stream,
      (data) => {
        if (!data.bids || !data.asks) return
        onUpdate({
          symbol: symbol.toUpperCase(),
          lastUpdateId: data.lastUpdateId ?? 0,
          bids: data.bids.map(([p, q]: [string, string]) => ({
            price: parseFloat(p),
            qty: parseFloat(q),
          })),
          asks: data.asks.map(([p, q]: [string, string]) => ({
            price: parseFloat(p),
            qty: parseFloat(q),
          })),
        })
      },
      onError,
      onStatus
    )
  }
}

export const binanceClient = new BinanceClient()
