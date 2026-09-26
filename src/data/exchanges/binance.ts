/**
 * Binance Spot exchange client – real data only.
 * REST: https://api.binance.com
 * WS:   wss://stream.binance.com:9443
 *
 * No mock / fallback data ever. On error → explicit MarketError.
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
import type { ExchangeClient } from './types'

const REST_BASE = 'https://api.binance.com'
const WS_BASE = 'wss://stream.binance.com:9443'

function toBinanceInterval(interval: Interval): string {
  return interval // Binance uses the same strings
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
  private activeSockets = new Set<WebSocket>()

  getStatus(): ConnectionStatus {
    return this.status
  }

  // ─── REST ───────────────────────────────────────────────────────────────

  async getKlines(symbol: string, interval: Interval, limit = 500): Promise<Candle[]> {
    const url = `${REST_BASE}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${toBinanceInterval(interval)}&limit=${limit}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        throw createError('REST_KLINES', `HTTP ${res.status}: ${await res.text()}`)
      }
      const raw: any[][] = await res.json()
      return raw.map((k) => ({
        time: Math.floor(k[0] / 1000), // ms → seconds for Lightweight Charts
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
        throw createError('REST_DEPTH', `HTTP ${res.status}: ${await res.text()}`)
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
        throw createError('REST_TICKER', `HTTP ${res.status}: ${await res.text()}`)
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

  // ─── WebSocket helpers ──────────────────────────────────────────────────

  private createSocket(
    stream: string,
    onMessage: (data: any) => void,
    onError: (err: MarketError) => void
  ): () => void {
    this.status = 'connecting'
    const ws = new WebSocket(`${WS_BASE}/ws/${stream}`)
    this.activeSockets.add(ws)

    ws.onopen = () => {
      this.status = 'connected'
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        onMessage(data)
      } catch (e: any) {
        onError(createError('WS_PARSE', e.message))
      }
    }

    ws.onerror = () => {
      this.status = 'error'
      onError(createError('WS_ERROR', `WebSocket error on stream ${stream}`))
    }

    ws.onclose = () => {
      this.activeSockets.delete(ws)
      if (this.activeSockets.size === 0) {
        this.status = 'disconnected'
      }
    }

    return () => {
      ws.close()
      this.activeSockets.delete(ws)
    }
  }

  // ─── Streams ────────────────────────────────────────────────────────────

  subscribeKlines(
    symbol: string,
    interval: Interval,
    onCandle: (candle: Candle, isFinal: boolean) => void,
    onError: (err: MarketError) => void
  ): () => void {
    const stream = `${symbol.toLowerCase()}@kline_${toBinanceInterval(interval)}`
    return this.createSocket(
      stream,
      (data) => {
        if (data.e !== 'kline') return
        const k = data.k
        const candle: Candle = {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        }
        onCandle(candle, k.x === true)
      },
      onError
    )
  }

  subscribeTrades(
    symbol: string,
    onTrade: (trade: Trade) => void,
    onError: (err: MarketError) => void
  ): () => void {
    const stream = `${symbol.toLowerCase()}@aggTrade`
    return this.createSocket(
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
      onError
    )
  }

  subscribeDepth(
    symbol: string,
    onUpdate: (book: OrderBook) => void,
    onError: (err: MarketError) => void
  ): () => void {
    // Partial book depth @20 levels, 100ms for lower latency
    const stream = `${symbol.toLowerCase()}@depth20@100ms`
    return this.createSocket(
      stream,
      (data) => {
        // depth20 stream does not have 'e' field in the same way; it is the book itself
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
      onError
    )
  }
}

/** Singleton instance – one client for the whole app */
export const binanceClient = new BinanceClient()
