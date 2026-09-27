/**
 * Bybit v5 public – free REST + WS (spot + linear share similar paths).
 * Spot category for klines/trades; linear optional via same symbol form.
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

const REST = 'https://api.bybit.com'
const WS_SPOT = 'wss://stream.bybit.com/v5/public/spot'

function createError(code: string, message: string): MarketError {
  return { code, message, exchange: 'bybit', timestamp: Date.now() }
}

function toBybitInterval(interval: Interval): string {
  const map: Partial<Record<Interval, string>> = {
    '1m': '1',
    '3m': '3',
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1h': '60',
    '2h': '120',
    '4h': '240',
    '6h': '360',
    '12h': '720',
    '1d': 'D',
    '1w': 'W',
    '1M': 'M',
  }
  return map[interval] ?? '1'
}

export class BybitClient implements ExchangeClient {
  readonly name = 'bybit'
  private status: ConnectionStatus = 'disconnected'

  getStatus() {
    return this.status
  }

  async getKlines(symbol: string, interval: Interval, limit = 500): Promise<Candle[]> {
    const lim = Math.min(Math.max(limit, 1), 1000)
    const url = `${REST}/v5/market/kline?category=spot&symbol=${symbol.toUpperCase()}&interval=${toBybitInterval(interval)}&limit=${lim}`
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (json.retCode !== 0) {
        throw createError(
          json.retCode === 10001 ? 'BAD_SYMBOL' : 'REST_KLINES',
          json.retMsg || 'Bybit kline failed'
        )
      }
      const list = (json.result?.list || []) as string[][]
      // Bybit returns newest first
      return list
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
      throw createError('REST_KLINES', e.message || 'Bybit klines failed')
    }
  }

  async getOrderBook(symbol: string, limit = 50): Promise<OrderBook> {
    const url = `${REST}/v5/market/orderbook?category=spot&symbol=${symbol.toUpperCase()}&limit=${Math.min(limit, 200)}`
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (json.retCode !== 0) {
        throw createError('REST_DEPTH', json.retMsg || 'orderbook failed')
      }
      const r = json.result
      return {
        symbol: symbol.toUpperCase(),
        lastUpdateId: Number(r.ts) || 0,
        bids: (r.b || []).map(([p, q]: string[]) => ({
          price: parseFloat(p),
          qty: parseFloat(q),
        })),
        asks: (r.a || []).map(([p, q]: string[]) => ({
          price: parseFloat(p),
          qty: parseFloat(q),
        })),
      }
    } catch (e: any) {
      if (e.code) throw e
      throw createError('REST_DEPTH', e.message || 'Bybit depth failed')
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const url = `${REST}/v5/market/tickers?category=spot&symbol=${symbol.toUpperCase()}`
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (json.retCode !== 0 || !json.result?.list?.[0]) {
        throw createError('REST_TICKER', json.retMsg || 'ticker failed')
      }
      const t = json.result.list[0]
      return {
        symbol: t.symbol,
        lastPrice: parseFloat(t.lastPrice),
        priceChange: parseFloat(t.price24hPcnt) * parseFloat(t.lastPrice),
        priceChangePercent: parseFloat(t.price24hPcnt) * 100,
        highPrice: parseFloat(t.highPrice24h),
        lowPrice: parseFloat(t.lowPrice24h),
        volume: parseFloat(t.volume24h),
        quoteVolume: parseFloat(t.turnover24h),
      }
    } catch (e: any) {
      if (e.code) throw e
      throw createError('REST_TICKER', e.message || 'Bybit ticker failed')
    }
  }

  private subscribeTopic(
    args: string[],
    onData: (data: any) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const rws = new ReconnectingWebSocket(WS_SPOT, {
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
        if (msg?.topic && msg?.data) onData(msg)
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
    const topic = `kline.${toBybitInterval(interval)}.${symbol.toUpperCase()}`
    return this.subscribeTopic(
      [topic],
      (msg) => {
        const rows = Array.isArray(msg.data) ? msg.data : [msg.data]
        for (const k of rows) {
          onCandle(
            {
              time: Math.floor(Number(k.start) / 1000),
              open: parseFloat(k.open),
              high: parseFloat(k.high),
              low: parseFloat(k.low),
              close: parseFloat(k.close),
              volume: parseFloat(k.volume),
            },
            k.confirm === true
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
    const topic = `publicTrade.${symbol.toUpperCase()}`
    return this.subscribeTopic(
      [topic],
      (msg) => {
        const rows = Array.isArray(msg.data) ? msg.data : [msg.data]
        for (const t of rows) {
          onTrade({
            id: String(t.i ?? t.tradeId ?? t.T),
            time: Number(t.T ?? t.ts),
            price: parseFloat(t.p ?? t.price),
            qty: parseFloat(t.v ?? t.size),
            isBuyerMaker: (t.S ?? t.side) === 'Sell',
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
    const topic = `orderbook.50.${symbol.toUpperCase()}`
    return this.subscribeTopic(
      [topic],
      (msg) => {
        const d = msg.data
        if (!d) return
        onUpdate({
          symbol: symbol.toUpperCase(),
          lastUpdateId: Number(d.u ?? d.ts) || 0,
          bids: (d.b || []).map(([p, q]: string[]) => ({
            price: parseFloat(p),
            qty: parseFloat(q),
          })),
          asks: (d.a || []).map(([p, q]: string[]) => ({
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

export const bybitClient = new BybitClient()
