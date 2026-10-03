/**
 * Robust multi-page history loader with AbortSignal, metrics, and venue fallback.
 */

import type { Candle, ExchangeId, Interval } from '@/types'
import { getExchangeClient } from '@/data/exchanges/registry'
import {
  fetchKlinesPages,
  mergeCandlesOlder,
  MAX_BARS_IN_MEMORY,
} from '@/data/klines/history'
import { fallbackChainFor, RESYNC_POLICY } from './feedPolicy'
import { toVenueSymbol } from './symbolNormalize'
import { recordFeedError, recordResync } from '@/data/shared/feedHealth'

export interface HistoryLoadResult {
  candles: Candle[]
  exchangeUsed: ExchangeId
  pages: number
  fallbackUsed: boolean
  durationMs: number
  aborted: boolean
  error?: string
}

let inflight = 0

export async function loadHistoryRobust(
  primary: ExchangeId,
  symbol: string,
  interval: Interval,
  opts?: {
    pages?: number
    signal?: AbortSignal
    allowFallback?: boolean
  }
): Promise<HistoryLoadResult> {
  const pages = Math.min(
    opts?.pages ?? RESYNC_POLICY.initialPages,
    RESYNC_POLICY.maxPagesDeep
  )
  const allowFallback = opts?.allowFallback !== false
  const chain = allowFallback ? fallbackChainFor(primary) : [primary]
  const t0 = Date.now()

  if (inflight >= RESYNC_POLICY.maxConcurrentHistory) {
    return {
      candles: [],
      exchangeUsed: primary,
      pages: 0,
      fallbackUsed: false,
      durationMs: 0,
      aborted: false,
      error: 'History load backpressure – too many concurrent requests',
    }
  }

  inflight++
  try {
    for (let i = 0; i < chain.length; i++) {
      if (opts?.signal?.aborted) {
        return {
          candles: [],
          exchangeUsed: primary,
          pages: 0,
          fallbackUsed: false,
          durationMs: Date.now() - t0,
          aborted: true,
          error: 'aborted',
        }
      }
      const ex = chain[i]!
      const venueSym = toVenueSymbol(symbol, ex)
      try {
        const client = getExchangeClient(ex)
        const timeout = RESYNC_POLICY.historyTimeoutMs
        const candles = await Promise.race([
          fetchKlinesPages(
            client,
            venueSym,
            interval,
            pages,
            RESYNC_POLICY.pagePauseMs
          ),
          new Promise<Candle[]>((_, rej) =>
            setTimeout(() => rej(new Error('history timeout')), timeout)
          ),
        ])
        if (candles.length === 0) throw new Error('empty history')
        recordResync(ex, symbol)
        return {
          candles:
            candles.length > MAX_BARS_IN_MEMORY
              ? candles.slice(candles.length - MAX_BARS_IN_MEMORY)
              : candles,
          exchangeUsed: ex,
          pages,
          fallbackUsed: i > 0,
          durationMs: Date.now() - t0,
          aborted: false,
        }
      } catch (e: any) {
        recordFeedError(
          ex,
          symbol,
          'HIST_FAIL',
          e?.message || 'history failed'
        )
        if (i === chain.length - 1) {
          return {
            candles: [],
            exchangeUsed: primary,
            pages: 0,
            fallbackUsed: chain.length > 1,
            durationMs: Date.now() - t0,
            aborted: false,
            error: e?.message || 'All venues failed history load',
          }
        }
      }
    }
    return {
      candles: [],
      exchangeUsed: primary,
      pages: 0,
      fallbackUsed: false,
      durationMs: Date.now() - t0,
      aborted: false,
      error: 'No venue available',
    }
  } finally {
    inflight--
  }
}

export function mergeHistory(existing: Candle[], older: Candle[]): Candle[] {
  return mergeCandlesOlder(existing, older)
}
