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

  async getKlines(
    symbol: string,
    interval: Interval,
    limit = 500,
    endTimeMs?: number
  ): Promise<Candle[]> {
    const lim = Math.min(Math.max(limit, 1), 1000)
    let url =
      `${REST_BASE}/api/v3/klines?symbol=${symbol.toUpperCase()}` +
      `&interval=${toBinanceInterval(interval)}&limit=${lim}`
    if (endTimeMs != null) url += `&endTime=${endTimeMs}`
    const res = await fetch(url)
    if (!res.ok) {
      throw createError('REST_KLINES', `Binance klines HTTP ${res.status}`)
    }
    const raw = await res.json()
    return (raw as any[]).map((k) => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }))
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const url = `${REST_BASE}/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`
    const res = await fetch(url)
    if (!res.ok) throw createError('REST_TICKER', `Binance ticker HTTP ${res.status}`)
    const t = await res.json()
    return {
      symbol: t.symbol,
      lastPrice: parseFloat(t.lastPrice),
      bidPrice: parseFloat(t.bidPrice),
      askPrice: parseFloat(t.askPrice),
      priceChangePercent: parseFloat(t.priceChangePercent),
      highPrice: parseFloat(t.highPrice),
      lowPrice: parseFloat(t.lowPrice),
      volume: parseFloat(t.volume),
      quoteVolume: parseFloat(t.quoteVolume),
    }
  }

  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const url =
      `${REST_BASE}/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) throw createError('REST_DEPTH', `Binance depth HTTP ${res.status}`)
    const d = await res.json()
    return {
      symbol: symbol.toUpperCase(),
      lastUpdateId: d.lastUpdateId,
      bids: (d.bids || []).map(
        (b: string[]) => [parseFloat(b[0]), parseFloat(b[1])] as [number, number]
      ),
      asks: (d.asks || []).map(
        (a: string[]) => [parseFloat(a[0]), parseFloat(a[1])] as [number, number]
      ),
    }
  }

  // ─── WS ─────────────────────────────────────────────────────────────────

  subscribeKlines(
    symbol: string,
    interval: Interval,
    onCandle: (candle: Candle, isFinal: boolean) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const stream = `${symbol.toLowerCase()}@kline_${toBinanceInterval(interval)}`
    const url = `${WS_BASE}/ws/${stream}`
    this.status = 'connecting'
    onStatus?.('connecting', 'opening kline stream')

    const ws = new ReconnectingWebSocket(url, {
      onStatus: (s, detail) => {
        this.status = s
        onStatus?.(s, detail ?? (s === 'connected' ? 'kline stream live' : undefined))
      },
      onMessage: (data) => {
        try {
          const msg = typeof data === 'string' ? JSON.parse(data) : data
          const k = msg?.k
          if (!k) return
          const candle: Candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          }
          onCandle(candle, !!k.x)
        } catch (e: any) {
          onError(createError('WS_PARSE', e.message || 'kline parse error'))
        }
      },
      onError: (message) => {
        this.status = 'error'
        onError(createError('WS_ERROR', message || 'Binance kline WebSocket error'))
      },
    })
    void ws.connect()

    return () => {
      ws.close()
      this.status = 'disconnected'
    }
  }

  subscribeTrades(
    symbol: string,
    onTrade: (trade: Trade) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const stream = `${symbol.toLowerCase()}@trade`
    const url = `${WS_BASE}/ws/${stream}`
    const ws = new ReconnectingWebSocket(url, {
      onStatus: (s, detail) =>
        onStatus?.(s, detail ?? (s === 'connected' ? 'trade stream live' : undefined)),
      onMessage: (data) => {
        try {
          const msg = typeof data === 'string' ? JSON.parse(data) : data
          onTrade({
            id: String(msg.t),
            time: Math.floor(msg.T / 1000),
            price: parseFloat(msg.p),
            qty: parseFloat(msg.q),
            isBuyerMaker: !!msg.m,
            symbol: symbol.toUpperCase(),
          })
        } catch (e: any) {
          onError(createError('WS_PARSE', e.message || 'trade parse error'))
        }
      },
      onError: (message) =>
        onError(createError('WS_ERROR', message || 'Binance trade WebSocket error')),
    })
    void ws.connect()
    return () => ws.close()
  }

  subscribeDepth(
    symbol: string,
    onUpdate: (book: OrderBook) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const stream = `${symbol.toLowerCase()}@depth20@100ms`
    const url = `${WS_BASE}/ws/${stream}`
    const ws = new ReconnectingWebSocket(url, {
      onStatus: (s, detail) =>
        onStatus?.(s, detail ?? (s === 'connected' ? 'depth stream live' : undefined)),
      onMessage: (data) => {
        try {
          const msg = typeof data === 'string' ? JSON.parse(data) : data
          onUpdate({
            symbol: symbol.toUpperCase(),
            lastUpdateId: msg.lastUpdateId ?? msg.u,
            bids: (msg.bids || []).map(
              (b: string[]) => [parseFloat(b[0]), parseFloat(b[1])] as [number, number]
            ),
            asks: (msg.asks || []).map(
              (a: string[]) => [parseFloat(a[0]), parseFloat(a[1])] as [number, number]
            ),
          })
        } catch (e: any) {
          onError(createError('WS_PARSE', e.message || 'depth parse error'))
        }
      },
      onError: (message) =>
        onError(createError('WS_ERROR', message || 'Binance depth WebSocket error')),
    })
    void ws.connect()
    return () => ws.close()
  }
}

export const binanceClient = new BinanceClient()
