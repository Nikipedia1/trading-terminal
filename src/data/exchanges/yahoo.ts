/**
 * Yahoo Finance adapter – stocks, ETFs, indices, forex, commodities.
 * REST via same-origin proxy /api/market/klines (Cloudflare) to avoid CORS.
 * Live: poll latest bars (no public tick WS).
 * Order book / trades: empty (not available on free Yahoo chart).
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

function createError(code: string, message: string): MarketError {
  return {
    code,
    message,
    exchange: 'yahoo',
    timestamp: Date.now(),
  }
}

function toYahooParams(interval: Interval, limit: number): { interval: string; range: string } {
  const map: Record<string, { interval: string; range: string }> = {
    '1m': { interval: '1m', range: '1d' },
    '3m': { interval: '2m', range: '5d' },
    '5m': { interval: '5m', range: '5d' },
    '15m': { interval: '15m', range: '1mo' },
    '30m': { interval: '30m', range: '1mo' },
    '1h': { interval: '60m', range: '3mo' },
    '2h': { interval: '60m', range: '6mo' },
    '4h': { interval: '60m', range: '1y' },
    '6h': { interval: '60m', range: '1y' },
    '8h': { interval: '60m', range: '1y' },
    '12h': { interval: '60m', range: '1y' },
    '1d': { interval: '1d', range: '2y' },
    '3d': { interval: '1d', range: '5y' },
    '1w': { interval: '1wk', range: '10y' },
    '1M': { interval: '1mo', range: 'max' },
  }
  const base = map[interval] ?? { interval: '1d', range: '1y' }
  if (limit > 500 && base.range === '1d') return { ...base, range: '5d' }
  if (limit > 500 && base.range === '5d') return { ...base, range: '1mo' }
  return base
}

function pollMs(interval: Interval): number {
  const m: Record<string, number> = {
    '1m': 15_000,
    '3m': 20_000,
    '5m': 30_000,
    '15m': 45_000,
    '30m': 60_000,
    '1h': 90_000,
    '2h': 120_000,
    '4h': 180_000,
    '6h': 180_000,
    '8h': 180_000,
    '12h': 180_000,
    '1d': 300_000,
    '3d': 300_000,
    '1w': 600_000,
    '1M': 600_000,
  }
  return m[interval] ?? 60_000
}

async function fetchKlines(
  symbol: string,
  interval: Interval,
  limit: number
): Promise<Candle[]> {
  const { interval: yInt, range } = toYahooParams(interval, limit)
  const qs = new URLSearchParams({
    symbol,
    interval: yInt,
    range,
    limit: String(Math.min(Math.max(limit, 1), 2500)),
  })
  const urls = [
    `/api/market/klines?${qs}`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${yInt}&range=${range}`,
  ]
  let lastErr: Error | null = null
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: url.startsWith('/') ? undefined : { Accept: 'application/json' },
      })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`)
        continue
      }
      const data = await res.json()
      if (Array.isArray(data?.candles)) {
        return (data.candles as Candle[]).slice(-limit)
      }
      const result = data?.chart?.result?.[0]
      if (!result) {
        lastErr = new Error('Empty Yahoo result')
        continue
      }
      const ts: number[] = result.timestamp ?? []
      const q = result.indicators?.quote?.[0] ?? {}
      const opens: (number | null)[] = q.open ?? []
      const highs: (number | null)[] = q.high ?? []
      const lows: (number | null)[] = q.low ?? []
      const closes: (number | null)[] = q.close ?? []
      const vols: (number | null)[] = q.volume ?? []
      const out: Candle[] = []
      for (let i = 0; i < ts.length; i++) {
        const o = opens[i]
        const h = highs[i]
        const l = lows[i]
        const c = closes[i]
        if (o == null || h == null || l == null || c == null) continue
        out.push({
          time: ts[i]!,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: vols[i] ?? 0,
        })
      }
      return out.slice(-limit)
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw createError('REST_KLINES', lastErr?.message ?? 'Yahoo klines failed')
}

export class YahooClient implements ExchangeClient {
  readonly name = 'yahoo'
  private status: ConnectionStatus = 'disconnected'

  getStatus(): ConnectionStatus {
    return this.status
  }

  async getKlines(
    symbol: string,
    interval: Interval,
    limit = 500,
    _endTimeMs?: number
  ): Promise<Candle[]> {
    this.status = 'connecting'
    try {
      const candles = await fetchKlines(symbol.trim(), interval, limit)
      this.status = 'connected'
      return candles
    } catch (e) {
      this.status = 'error'
      throw e
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const bars = await fetchKlines(symbol.trim(), '1d', 5)
    if (!bars.length) throw createError('REST_TICKER', 'No bars for ticker')
    const last = bars[bars.length - 1]!
    const prev = bars[bars.length - 2] ?? last
    const change = last.close - prev.close
    const pct = prev.close ? (change / prev.close) * 100 : 0
    return {
      symbol: symbol.trim().toUpperCase(),
      lastPrice: last.close,
      priceChange: change,
      priceChangePercent: pct,
      highPrice: last.high,
      lowPrice: last.low,
      volume: last.volume,
      quoteVolume: last.volume * last.close,
    }
  }

  async getOrderBook(symbol: string, _limit = 20): Promise<OrderBook> {
    return {
      symbol: symbol.trim().toUpperCase(),
      bids: [],
      asks: [],
      lastUpdateId: 0,
    }
  }

  subscribeKlines(
    symbol: string,
    interval: Interval,
    onCandle: (candle: Candle, isFinal: boolean) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    let stopped = false
    this.status = 'connecting'
    onStatus?.('connecting', 'yahoo poll starting')

    const tick = async () => {
      if (stopped) return
      try {
        const bars = await fetchKlines(symbol.trim(), interval, 3)
        if (stopped) return
        const last = bars[bars.length - 1]
        if (last) {
          this.status = 'connected'
          onStatus?.('connected', 'yahoo poll ok')
          onCandle(last, true)
        }
      } catch (e) {
        if (stopped) return
        this.status = 'error'
        const err =
          e && typeof e === 'object' && 'code' in e
            ? (e as MarketError)
            : createError('WS_KLINES', e instanceof Error ? e.message : String(e))
        onError(err)
        onStatus?.('error', err.message)
      }
    }

    void tick()
    const id = setInterval(() => void tick(), pollMs(interval))
    return () => {
      stopped = true
      clearInterval(id)
      this.status = 'disconnected'
      onStatus?.('disconnected', 'yahoo poll stopped')
    }
  }

  subscribeTrades(
    _symbol: string,
    _onTrade: (trade: Trade) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    onStatus?.('disconnected', 'yahoo: no public trades stream')
    onError(createError('NO_TRADES', 'Yahoo adapter has no tape/trades feed'))
    return () => {}
  }

  subscribeDepth(
    _symbol: string,
    _onUpdate: (book: OrderBook) => void,
    onError: (err: MarketError) => void,
    onStatus?: StatusCallback
  ): () => void {
    onStatus?.('disconnected', 'yahoo: no public order book')
    onError(createError('NO_DEPTH', 'Yahoo adapter has no L2 depth feed'))
    return () => {}
  }
}

export const yahooClient = new YahooClient()
