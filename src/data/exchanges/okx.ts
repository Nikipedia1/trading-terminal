/**
 * OKX public v5 – free REST + WS.
 * InstId format: BTC-USDT (converted from BTCUSDT).
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

const REST = 'https://www.okx.com'
const WS = 'wss://ws.okx.com:8443/ws/v5/public'

function createError(code: string, message: string): MarketError {
  return { code, message, exchange: 'okx', timestamp: Date.now() }
}

function toInstId(symbol: string): string {
  const s = symbol.toUpperCase().replace('/', '-')
  if (s.includes('-')) return s
  for (const q of ['USDT', 'USDC', 'USD', 'BTC', 'ETH']) {
    if (s.endsWith(q) && s.length > q.length) return `${s.slice(0, -q.length)}-${q}`
  }
  return s
}

function toOkxBar(interval: Interval): string {
  const map: Partial<Record<Interval, string>> = {
    '1m': '1m',
    '3m': '3m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1H',
    '2h': '2H',
    '4h': '4H',
    '6h': '6H',
    '12h': '12H',
    '1d': '1D',
    '1w': '1W',
    '1M': '1M',
  }
  return map[interval] ?? '1m'
}

export class OkxClient implements ExchangeClient {
  readonly name = 'okx'
  private status: ConnectionStatus = 'disconnected'

  getStatus() {
    return this.status
  }

  async getKlines(symbol: string, interval: Interval, limit = 300): Promise<Candle[]> {
    const instId = toInstId(symbol)
    const lim = Math.min(Math.max(limit, 1), 300)
    const url = `${REST}/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${toOkxBar(interval)}&limit=${lim}`
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (json.code !== '0') {
        throw createError('REST_KLINES', json.msg || 'OKX kline failed')
      }
      const rows = (json.data || []) as string[][]
      return rows
        .map((k) => ({
          time: Math.floor(Number(k[0]) / 1000),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }))
        .sort((a, b) => a.time - b.time)
    } catch (e: any) {
      if (e.code) throw e
      throw createError('REST_KLINES', e.message || 'OKX klines failed')
    }
  }

  async getOrderBook(symbol: string, limit = 50): Promise<OrderBook> {
    const instId = toInstId(symbol)
    const url = `${REST}/api/v5/market/books?instId=${encodeURIComponent(instId)}&sz=${Math.min(limit, 400)}`
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (json.code !== '0' || !json.data?.[0]) {
        throw createError('REST_DEPTH', json.msg || 'books failed')
      }
      const d = json.data[0]
      return {
        symbol: symbol.toUpperCase(),
        lastUpdateId: Number(d.ts) || 0,
        bids: (d.bids || []).map((r: string[]) => ({
          price: parseFloat(r[0]),
          qty: parseFloat(r[1]),
        })),
        asks: (d.asks || []).map((r: string[]) => ({
          price: parseFloat(r[0]),
          qty: parseFloat(r[1]),
        })),
      }
    } catch (e: any) {
      if (e.code) throw e
      throw createError('REST_DEPTH', e.message || 'OKX depth failed')
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const instId = toInstId(symbol)
    const url = `${REST}/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (json.code !== '0' || !json.data?.[0]) {
        throw createError('REST_TICKER', json.msg || 'ticker failed')
      }
      const t = json.data[0]
      const last = parseFloat(t.last)
      const open = parseFloat(t.open24h)
      return {
        symbol: symbol.toUpperCase(),
        lastPrice: last,
        priceChange: last - open,
        priceChangePercent: open ? ((last - open) / open) * 100 : 0,
        highPrice: parseFloat(t.high24h),
        lowPrice: parseFloat(t.low24h),
        volume: parseFloat(t.vol24h),
        quoteVolume: parseFloat(t.volCcy24h),
      }
    } catch (e: any) {
      if (e.code) throw e
      throw createError('REST_TICKER', e.message || 'OKX ticker failed')
    }
  }

  private subscribe(
    args: { channel: string; instId: string }[],
    onData: (data: any) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const rws = new ReconnectingWebSocket(WS, {
      minBackoffMs: 1000,
      maxBackoffMs: 30_000,
      onStatus: (s, d) => {
        this.status = s
        onStatus?.(s, d)
        if (s === 'connected') {
          rws.send({ op: 'subscribe', args })
        }
      },
      onMessage: (msg: any) => {
        if (msg?.arg && msg?.data) onData(msg)
      },
      onError: (m) => onError(createError('WS_ERROR', m)),
    })
    void rws.connect()
    return () => rws.close()
  }

  subscribeKlines(
    symbol: string,
    interval: Interval,
    onCandle: (c: Candle, isFinal: boolean) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const instId = toInstId(symbol)
    return this.subscribe(
      [{ channel: `candle${toOkxBar(interval)}`, instId }],
      (msg) => {
        for (const k of msg.data || []) {
          onCandle(
            {
              time: Math.floor(Number(k[0]) / 1000),
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            },
            k[8] === '1'
          )
        }
      },
      onError,
      onStatus
    )
  }

  subscribeTrades(
    symbol: string,
    onTrade: (t: Trade) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const instId = toInstId(symbol)
    return this.subscribe(
      [{ channel: 'trades', instId }],
      (msg) => {
        for (const t of msg.data || []) {
          onTrade({
            id: String(t.tradeId),
            time: Number(t.ts),
            price: parseFloat(t.px),
            qty: parseFloat(t.sz),
            isBuyerMaker: t.side === 'sell',
            symbol: symbol.toUpperCase(),
          })
        }
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
    const instId = toInstId(symbol)
    return this.subscribe(
      [{ channel: 'books5', instId }],
      (msg) => {
        for (const d of msg.data || []) {
          onUpdate({
            symbol: symbol.toUpperCase(),
            lastUpdateId: Number(d.ts) || 0,
            bids: (d.bids || []).map((r: string[]) => ({
              price: parseFloat(r[0]),
              qty: parseFloat(r[1]),
            })),
            asks: (d.asks || []).map((r: string[]) => ({
              price: parseFloat(r[0]),
              qty: parseFloat(r[1]),
            })),
          })
        }
      },
      onError,
      onStatus
    )
  }
}

export const okxClient = new OkxClient()
