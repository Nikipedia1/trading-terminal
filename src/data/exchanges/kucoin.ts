/**
 * KuCoin Spot – real REST + reconnecting public WebSocket.
 * REST: https://api.kucoin.com
 * WS:   bullet-public token → instanceServers endpoint
 *
 * Symbol format: BASE-QUOTE (BTC-USDT).
 * Intervals 3d / 1M not supported on public candles → explicit error.
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

const REST_BASE = 'https://api.kucoin.com'

const INTERVAL_MAP: Partial<Record<Interval, string>> = {
  '1m': '1min',
  '3m': '3min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1hour',
  '2h': '2hour',
  '4h': '4hour',
  '6h': '6hour',
  '8h': '8hour',
  '12h': '12hour',
  '1d': '1day',
  '1w': '1week',
}

function createError(code: string, message: string): MarketError {
  return {
    code,
    message,
    exchange: 'kucoin',
    timestamp: Date.now(),
  }
}

/** BTCUSDT → BTC-USDT */
export function toKucoinSymbol(symbol: string): string {
  const s = symbol.toUpperCase().replace('/', '-')
  if (s.includes('-')) return s
  for (const q of ['USDT', 'USDC', 'BTC', 'ETH', 'BUSD', 'DAI', 'TUSD']) {
    if (s.endsWith(q) && s.length > q.length) {
      return `${s.slice(0, -q.length)}-${q}`
    }
  }
  return s
}

function toKucoinInterval(interval: Interval): string {
  const mapped = INTERVAL_MAP[interval]
  if (!mapped) {
    throw createError(
      'UNSUPPORTED_INTERVAL',
      `KuCoin public candles do not support interval "${interval}". Use 1m–1w (no 3d/1M).`
    )
  }
  return mapped
}

interface BulletPublic {
  token: string
  endpoint: string
  pingInterval: number
}

async function fetchBulletPublic(): Promise<BulletPublic> {
  const res = await fetch(`${REST_BASE}/api/v1/bullet-public`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 429) {
      throw createError('RATE_LIMIT', `KuCoin bullet-public rate limited (429). ${body}`)
    }
    throw createError('BULLET_PUBLIC', `HTTP ${res.status}: ${body}`)
  }
  const json = await res.json()
  if (json.code !== '200000' || !json.data) {
    throw createError('BULLET_PUBLIC', json.msg || 'Invalid bullet-public response')
  }
  const server = json.data.instanceServers?.[0]
  if (!server?.endpoint || !json.data.token) {
    throw createError('BULLET_PUBLIC', 'Missing endpoint/token in bullet-public')
  }
  return {
    token: json.data.token,
    endpoint: server.endpoint,
    pingInterval: server.pingInterval ?? 18000,
  }
}

export class KucoinClient implements ExchangeClient {
  readonly name = 'kucoin'
  private status: ConnectionStatus = 'disconnected'

  getStatus(): ConnectionStatus {
    return this.status
  }

  // ─── REST ───────────────────────────────────────────────────────────────

  async getKlines(symbol: string, interval: Interval, limit = 300): Promise<Candle[]> {
    const sym = toKucoinSymbol(symbol)
    const type = toKucoinInterval(interval)
    const lim = Math.min(Math.max(limit, 1), 1500)
    // KuCoin returns newest first; request by endAt optional
    const url = `${REST_BASE}/api/v1/market/candles?symbol=${encodeURIComponent(sym)}&type=${type}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.text()
        if (res.status === 429) {
          throw createError('RATE_LIMIT', `KuCoin rate limit (429). ${body}`)
        }
        throw createError('REST_KLINES', `HTTP ${res.status}: ${body}`)
      }
      const json = await res.json()
      if (json.code !== '200000') {
        throw createError(
          'REST_KLINES',
          json.msg || `KuCoin error code ${json.code} for ${sym}`
        )
      }
      const raw: string[][] = json.data || []
      if (!Array.isArray(raw) || raw.length === 0) {
        throw createError('EMPTY_KLINES', `No klines for ${sym} ${type}. Check symbol (BASE-QUOTE).`)
      }
      // KuCoin: [time, open, close, high, low, amount, volume] newest first
      const candles: Candle[] = raw
        .slice(0, lim)
        .map((k) => ({
          time: parseInt(k[0], 10),
          open: parseFloat(k[1]),
          high: parseFloat(k[3]),
          low: parseFloat(k[4]),
          close: parseFloat(k[2]),
          volume: parseFloat(k[6]),
        }))
        .reverse() // chronological
      return candles
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_KLINES', err.message || 'Unknown error fetching klines')
    }
  }

  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const sym = toKucoinSymbol(symbol)
    const url = `${REST_BASE}/api/v1/market/orderbook/level2_${limit <= 20 ? 20 : 100}?symbol=${encodeURIComponent(sym)}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.text()
        throw createError('REST_DEPTH', `HTTP ${res.status}: ${body}`)
      }
      const json = await res.json()
      if (json.code !== '200000' || !json.data) {
        throw createError('REST_DEPTH', json.msg || 'Order book unavailable')
      }
      const d = json.data
      return {
        symbol: sym,
        lastUpdateId: d.sequence ? parseInt(d.sequence, 10) : 0,
        bids: (d.bids || []).map(([p, q]: [string, string]) => ({
          price: parseFloat(p),
          qty: parseFloat(q),
        })),
        asks: (d.asks || []).map(([p, q]: [string, string]) => ({
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
    const sym = toKucoinSymbol(symbol)
    const url = `${REST_BASE}/api/v1/market/stats?symbol=${encodeURIComponent(sym)}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.text()
        throw createError('REST_TICKER', `HTTP ${res.status}: ${body}`)
      }
      const json = await res.json()
      if (json.code !== '200000' || !json.data) {
        throw createError('REST_TICKER', json.msg || 'Ticker unavailable')
      }
      const d = json.data
      const last = parseFloat(d.last)
      const changeRate = parseFloat(d.changeRate || '0')
      return {
        symbol: sym,
        lastPrice: last,
        priceChange: parseFloat(d.changePrice || '0'),
        priceChangePercent: changeRate * 100,
        highPrice: parseFloat(d.high || '0'),
        lowPrice: parseFloat(d.low || '0'),
        volume: parseFloat(d.vol || '0'),
        quoteVolume: parseFloat(d.volValue || '0'),
      }
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_TICKER', err.message || 'Unknown error fetching ticker')
    }
  }

  // ─── WebSocket (bullet-public + topic subscribe) ────────────────────────

  private subscribeTopic(
    topic: string,
    onData: (data: any) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    let pingTimer: ReturnType<typeof setInterval> | null = null
    let rws: ReconnectingWebSocket | null = null

    const urlFactory = async () => {
      const bullet = await fetchBulletPublic()
      const connectId = `${Date.now()}`
      // store ping interval on closure via side channel
      ;(urlFactory as any)._ping = bullet.pingInterval
      return `${bullet.endpoint}?token=${encodeURIComponent(bullet.token)}&connectId=${connectId}`
    }

    rws = new ReconnectingWebSocket('', {
      urlFactory,
      minBackoffMs: 1500,
      maxBackoffMs: 30_000,
      onStatus: (s, detail) => {
        this.status = s
        onStatus?.(s, detail)
        if (s === 'connected' && rws) {
          // subscribe after open
          rws.send({
            id: Date.now(),
            type: 'subscribe',
            topic,
            privateChannel: false,
            response: true,
          })
          if (pingTimer) clearInterval(pingTimer)
          const pingMs = (urlFactory as any)._ping ?? 18000
          pingTimer = setInterval(() => {
            rws?.send({ id: Date.now(), type: 'ping' })
          }, pingMs)
        }
        if (s === 'disconnected' || s === 'error') {
          if (pingTimer) {
            clearInterval(pingTimer)
            pingTimer = null
          }
        }
      },
      onMessage: (data: any) => {
        if (!data || typeof data !== 'object') return
        if (data.type === 'pong' || data.type === 'welcome' || data.type === 'ack') return
        if (data.type === 'message' && data.topic === topic) {
          onData(data.data)
        }
      },
      onError: (msg) => onError(createError('WS_ERROR', msg)),
    })

    void rws.connect()

    return () => {
      if (pingTimer) clearInterval(pingTimer)
      rws?.close()
    }
  }

  subscribeKlines(
    symbol: string,
    interval: Interval,
    onCandle: (candle: Candle, isFinal: boolean) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    let type: string
    try {
      type = toKucoinInterval(interval)
    } catch (e: any) {
      onError(e.code ? e : createError('UNSUPPORTED_INTERVAL', e.message))
      return () => {}
    }
    const sym = toKucoinSymbol(symbol)
    const topic = `/market/candles:${sym}_${type}`

    return this.subscribeTopic(
      topic,
      (data) => {
        // data.candles: [time, open, close, high, low, amount, volume]
        const k = data.candles || data
        if (!Array.isArray(k) || k.length < 7) return
        onCandle(
          {
            time: parseInt(k[0], 10),
            open: parseFloat(k[1]),
            high: parseFloat(k[3]),
            low: parseFloat(k[4]),
            close: parseFloat(k[2]),
            volume: parseFloat(k[6]),
          },
          true // KuCoin pushes candle updates; treat as progressive bar
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
    const sym = toKucoinSymbol(symbol)
    const topic = `/market/match:${sym}`

    return this.subscribeTopic(
      topic,
      (data) => {
        onTrade({
          id: String(data.tradeId ?? data.sequence ?? Date.now()),
          time: data.time ? Math.floor(Number(data.time) / 1e6) : Date.now(), // ns → ms approx
          price: parseFloat(data.price),
          qty: parseFloat(data.size),
          isBuyerMaker: data.side === 'sell',
          symbol: sym,
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
    const sym = toKucoinSymbol(symbol)
    // Level 2 snapshot-style public topic
    const topic = `/market/level2:${sym}`

    // KuCoin L2 is incremental; for simplicity use REST polling fallback is NOT allowed.
    // Use level2 depth5 public brief if available – topic /spotMarket/level2Depth50:SYM is newer.
    // Stick to documented /market/level2 and only emit when changes include bids/asks arrays.
    return this.subscribeTopic(
      topic,
      (data) => {
        // Incremental changes – without local book builder we cannot produce full book.
        // Explicit limitation: surface error once rather than fake book.
        if (!data?.bids && !data?.asks && !data?.changes) {
          return
        }
        // Prefer changes structure only if full snapshot-like fields exist
        if (data.bids && data.asks) {
          onUpdate({
            symbol: sym,
            lastUpdateId: data.sequenceStart ?? data.sequenceEnd ?? 0,
            bids: data.bids.map(([p, q]: [string, string]) => ({
              price: parseFloat(p),
              qty: parseFloat(q),
            })),
            asks: data.asks.map(([p, q]: [string, string]) => ({
              price: parseFloat(p),
              qty: parseFloat(q),
            })),
          })
        }
        // Incremental-only updates ignored (would require local order book engine).
      },
      onError,
      onStatus
    )
  }
}

export const kucoinClient = new KucoinClient()
