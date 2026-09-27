/**
 * Binance USDT-M Futures – public REST + reconnecting WebSocket.
 * REST: https://fapi.binance.com
 * WS:   wss://fstream.binance.com
 *
 * Public endpoints only (no API key):
 *   klines, depth, ticker, premiumIndex, fundingRate, openInterest
 *   streams: aggTrade, kline, depth, markPrice, forceOrder
 *
 * Limits (documented): REST weight shared per IP; prefer combined streams;
 * multi-symbol in one browser can hit 429 – surface errors, never mock.
 */

import type {
  Candle,
  Trade,
  OrderBook,
  Ticker,
  Interval,
  ConnectionStatus,
  MarketError,
  LiquidationEvent,
  MarkPriceTick,
  OpenInterestSnapshot,
  FundingRateRow,
} from '@/types'
import type { ExchangeClient, StatusCallback } from './types'
import { ReconnectingWebSocket } from '@/data/ws/reconnecting-ws'

const REST_BASE = 'https://fapi.binance.com'
const WS_BASE = 'wss://fstream.binance.com'

function toInterval(interval: Interval): string {
  return interval
}

function createError(code: string, message: string): MarketError {
  return {
    code,
    message,
    exchange: 'binance_futures',
    timestamp: Date.now(),
  }
}

async function restJson(path: string): Promise<any> {
  const res = await fetch(`${REST_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 429) {
      throw createError(
        'RATE_LIMIT',
        `Binance Futures rate limit (429). Reduce symbols / poll interval. ${body}`
      )
    }
    if (res.status === 400) {
      throw createError('BAD_SYMBOL', `Futures rejected request: ${body}`)
    }
    throw createError('REST_ERROR', `HTTP ${res.status}: ${body}`)
  }
  return res.json()
}

export class BinanceFuturesClient implements ExchangeClient {
  readonly name = 'binance_futures'
  private status: ConnectionStatus = 'disconnected'

  getStatus(): ConnectionStatus {
    return this.status
  }

  // ─── REST ───────────────────────────────────────────────────────────────

  async getKlines(symbol: string, interval: Interval, limit = 500): Promise<Candle[]> {
    const lim = Math.min(Math.max(limit, 1), 1500)
    const sym = symbol.toUpperCase()
    try {
      const raw: any[][] = await restJson(
        `/fapi/v1/klines?symbol=${sym}&interval=${toInterval(interval)}&limit=${lim}`
      )
      if (!Array.isArray(raw) || raw.length === 0) {
        throw createError('EMPTY_KLINES', `No futures klines for ${sym} ${interval}`)
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
      throw createError('REST_KLINES', err.message || 'Futures klines failed')
    }
  }

  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const sym = symbol.toUpperCase()
    const lim = [5, 10, 20, 50, 100, 500, 1000].includes(limit) ? limit : 20
    try {
      const raw = await restJson(`/fapi/v1/depth?symbol=${sym}&limit=${lim}`)
      return {
        symbol: sym,
        lastUpdateId: raw.lastUpdateId,
        bids: (raw.bids || []).map(([p, q]: [string, string]) => ({
          price: parseFloat(p),
          qty: parseFloat(q),
        })),
        asks: (raw.asks || []).map(([p, q]: [string, string]) => ({
          price: parseFloat(p),
          qty: parseFloat(q),
        })),
      }
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_DEPTH', err.message || 'Futures depth failed')
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const sym = symbol.toUpperCase()
    try {
      const raw = await restJson(`/fapi/v1/ticker/24hr?symbol=${sym}`)
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
      throw createError('REST_TICKER', err.message || 'Futures ticker failed')
    }
  }

  /** Mark + index + last funding (premiumIndex). */
  async getPremiumIndex(symbol: string): Promise<MarkPriceTick> {
    const sym = symbol.toUpperCase()
    try {
      const raw = await restJson(`/fapi/v1/premiumIndex?symbol=${sym}`)
      return {
        exchange: 'binance_futures',
        symbol: raw.symbol || sym,
        markPrice: parseFloat(raw.markPrice),
        indexPrice: parseFloat(raw.indexPrice),
        fundingRate: parseFloat(raw.lastFundingRate),
        nextFundingTime: Number(raw.nextFundingTime),
        time: Number(raw.time) || Date.now(),
      }
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_PREMIUM', err.message || 'premiumIndex failed')
    }
  }

  /** Recent funding rates (public). */
  async getFundingRate(symbol: string, limit = 8): Promise<FundingRateRow[]> {
    const sym = symbol.toUpperCase()
    const lim = Math.min(Math.max(limit, 1), 100)
    try {
      const raw = await restJson(
        `/fapi/v1/fundingRate?symbol=${sym}&limit=${lim}`
      )
      if (!Array.isArray(raw)) return []
      return raw.map((r: any) => ({
        symbol: r.symbol || sym,
        fundingRate: parseFloat(r.fundingRate),
        fundingTime: Number(r.fundingTime),
        markPrice: r.markPrice != null ? parseFloat(r.markPrice) : undefined,
      }))
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_FUNDING', err.message || 'fundingRate failed')
    }
  }

  /** Current open interest (contracts). */
  async getOpenInterest(symbol: string): Promise<OpenInterestSnapshot> {
    const sym = symbol.toUpperCase()
    try {
      const raw = await restJson(`/fapi/v1/openInterest?symbol=${sym}`)
      return {
        exchange: 'binance_futures',
        symbol: raw.symbol || sym,
        openInterest: parseFloat(raw.openInterest),
        time: Number(raw.time) || Date.now(),
      }
    } catch (err: any) {
      if (err.code) throw err
      throw createError('REST_OI', err.message || 'openInterest failed')
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
      onMessage: (data) => onData(data),
      onError: (msg) => onError(createError('WS_ERROR', msg)),
    })
    void rws.connect()
    return () => rws.close()
  }

  /** Combined multi-stream (one socket) – preferred for multi-symbol. */
  subscribeCombined(
    streams: string[],
    onData: (stream: string, data: any) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    if (streams.length === 0) return () => {}
    const path = streams.map((s) => s.toLowerCase()).join('/')
    const url = `${WS_BASE}/stream?streams=${path}`
    const rws = new ReconnectingWebSocket(url, {
      minBackoffMs: 1000,
      maxBackoffMs: 30_000,
      onStatus: (s, detail) => {
        this.status = s
        onStatus?.(s, detail)
      },
      onMessage: (msg) => {
        // combined: { stream, data }
        if (msg && msg.stream && msg.data) {
          onData(msg.stream, msg.data)
        } else {
          onData('', msg)
        }
      },
      onError: (m) => onError(createError('WS_ERROR', m)),
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
    const stream = `${symbol.toLowerCase()}@kline_${toInterval(interval)}`
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
        const bids = data.b || data.bids
        const asks = data.a || data.asks
        if (!bids || !asks) return
        onUpdate({
          symbol: symbol.toUpperCase(),
          lastUpdateId: data.u ?? data.lastUpdateId ?? 0,
          bids: bids.map(([p, q]: [string, string]) => ({
            price: parseFloat(p),
            qty: parseFloat(q),
          })),
          asks: asks.map(([p, q]: [string, string]) => ({
            price: parseFloat(p),
            qty: parseFloat(q),
          })),
        })
      },
      onError,
      onStatus
    )
  }

  /** Mark price stream (~1s or 3s). */
  subscribeMarkPrice(
    symbol: string,
    onTick: (t: MarkPriceTick) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const stream = `${symbol.toLowerCase()}@markPrice@1s`
    return this.subscribeStream(
      stream,
      (data) => {
        if (data.e !== 'markPriceUpdate') return
        onTick({
          exchange: 'binance_futures',
          symbol: data.s,
          markPrice: parseFloat(data.p),
          indexPrice: parseFloat(data.i),
          fundingRate: parseFloat(data.r),
          nextFundingTime: Number(data.T),
          time: Number(data.E) || Date.now(),
        })
      },
      onError,
      onStatus
    )
  }

  /** Liquidations (forceOrder). */
  subscribeForceOrder(
    symbol: string,
    onLiq: (e: LiquidationEvent) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    const stream = `${symbol.toLowerCase()}@forceOrder`
    return this.subscribeStream(
      stream,
      (data) => {
        if (data.e !== 'forceOrder') return
        const o = data.o
        if (!o) return
        // S: SELL = long liquidated (market sell), BUY = short liquidated
        const side = String(o.S).toUpperCase() === 'SELL' ? 'sell' : 'buy'
        onLiq({
          exchange: 'binance_futures',
          symbol: o.s || symbol.toUpperCase(),
          side,
          price: parseFloat(o.p),
          qty: parseFloat(o.q),
          averagePrice: parseFloat(o.ap || o.p),
          time: Number(o.T) || Number(data.E) || Date.now(),
          orderStatus: o.X,
        })
      },
      onError,
      onStatus
    )
  }
}

export const binanceFuturesClient = new BinanceFuturesClient()
