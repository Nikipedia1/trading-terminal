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

  async getKlines(symbol: string, interval: Interval, limit = 500, endTimeMs?: number): Promise<Candle[]> {
    const lim = Math.min(Math.max(limit, 1), 1000)
    let url = `${REST_BASE}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${toBinanceInterval(interval)}&limit=${lim}`
    if (endTimeMs != null && Number.isFinite(endTimeMs)) {
      url += `&endTime=${Math.floor(endTimeMs)}`
    }
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
        bids: (raw.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])] as [number, number]),
        asks: (raw.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])] as [number, number]),
      }
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_DEPTH', err.message || 'Unknown error fetching depth')
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
        bidPrice: parseFloat(raw.bidPrice),
        askPrice: parseFloat(raw.askPrice),
        volume24h: parseFloat(raw.volume),
        quoteVolume24h: parseFloat(raw.quoteVolume),
        priceChangePercent: parseFloat(raw.priceChangePercent),
        high24h: parseFloat(raw.highPrice),
        low24h: parseFloat(raw.lowPrice),
      }
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_TICKER', err.message || 'Unknown error fetching ticker')
    }
  }

  // ─── WebSocket ──────────────────────────────────────────────────────────

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
      onOpen: () => {
        this.status = 'connected'
        onStatus?.('connected', 'kline stream live')
      },
      onMessage: (data) => {
        try {
          const msg = JSON.parse(data)
          const k = msg.k
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
      onError: () => {
        this.status = 'error'
        onError(createError('WS_ERROR', 'Binance kline WebSocket error'))
        onStatus?.('error', 'kline socket error')
      },
      onClose: () => {
        this.status = 'disconnected'
        onStatus?.('disconnected', 'kline socket closed')
      },
    })

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
      onOpen: () => onStatus?.('connected', 'trade stream live'),
      onMessage: (data) => {
        try {
          const msg = JSON.parse(data)
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
      onError: () => onError(createError('WS_ERROR', 'Binance trade WebSocket error')),
      onClose: () => onStatus?.('disconnected', 'trade socket closed'),
    })
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
      onOpen: () => onStatus?.('connected', 'depth stream live'),
      onMessage: (data) => {
        try {
          const msg = JSON.parse(data)
          onUpdate({
            symbol: symbol.toUpperCase(),
            lastUpdateId: msg.lastUpdateId ?? msg.u,
            bids: (msg.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])] as [number, number]),
            asks: (msg.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])] as [number, number]),
          })
        } catch (e: any) {
          onError(createError('WS_PARSE', e.message || 'depth parse error'))
        }
      },
      onError: () => onError(createError('WS_ERROR', 'Binance depth WebSocket error')),
      onClose: () => onStatus?.('disconnected', 'depth socket closed'),
    })
    return () => ws.close()
  }
}

export const binanceClient = new BinanceClient()
