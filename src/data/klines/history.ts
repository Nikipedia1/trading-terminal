/**
 * Paginated kline history – exceeds per-request exchange limits (Binance 1000, OKX 300, …).
 * Real REST only; never mocks.
 */

import type { Candle, Interval, ExchangeId } from '@/types'
import type { ExchangeClient } from '@/data/exchanges/types'

/** Per-request page size caps (public APIs). */
export const PAGE_LIMIT: Record<ExchangeId, number> = {
  binance: 1000,
  binance_futures: 1500,
  kucoin: 1500,
  bybit: 1000,
  okx: 300,
}

/** Hard cap in browser memory (bars). */
export const MAX_BARS_IN_MEMORY = 20_000

/** How far left (logical bars) before we prefetch older history. */
export const LOAD_MORE_THRESHOLD = 40

export function mergeCandlesOlder(existing: Candle[], older: Candle[]): Candle[] {
  if (older.length === 0) return existing
  if (existing.length === 0) return older
  const map = new Map<number, Candle>()
  for (const c of older) map.set(c.time, c)
  for (const c of existing) map.set(c.time, c)
  const merged = [...map.values()].sort((a, b) => a.time - b.time)
  if (merged.length > MAX_BARS_IN_MEMORY) {
    return merged.slice(merged.length - MAX_BARS_IN_MEMORY)
  }
  return merged
}

export function appendLiveCandle(candles: Candle[], candle: Candle): Candle[] {
  const next = candles.slice()
  const last = next[next.length - 1]
  if (last && last.time === candle.time) {
    next[next.length - 1] = candle
  } else if (!last || candle.time > last.time) {
    next.push(candle)
    if (next.length > MAX_BARS_IN_MEMORY) {
      next.splice(0, next.length - MAX_BARS_IN_MEMORY)
    }
  }
  return next
}

/**
 * Fetch one page of klines ending before `beforeTimeSec` (exclusive).
 * If beforeTimeSec is omitted, returns the most recent page.
 */
export async function fetchKlinesPage(
  client: ExchangeClient,
  symbol: string,
  interval: Interval,
  opts?: { limit?: number; beforeTimeSec?: number }
): Promise<Candle[]> {
  const exchange = client.name as ExchangeId
  const pageCap = PAGE_LIMIT[exchange] ?? 1000
  const limit = Math.min(Math.max(opts?.limit ?? pageCap, 1), pageCap)
  const endTimeMs =
    opts?.beforeTimeSec != null ? opts.beforeTimeSec * 1000 - 1 : undefined
  return client.getKlines(symbol, interval, limit, endTimeMs)
}

/**
 * Load N pages of history (most recent first), merging chronologically.
 * Use sparingly on open; prefer load-on-scroll for deep history.
 */
export async function fetchKlinesPages(
  client: ExchangeClient,
  symbol: string,
  interval: Interval,
  pages = 1,
  pauseMs = 120
): Promise<Candle[]> {
  let all: Candle[] = []
  let before: number | undefined
  const maxPages = Math.max(1, Math.min(pages, 50))

  for (let i = 0; i < maxPages; i++) {
    const batch = await fetchKlinesPage(client, symbol, interval, {
      beforeTimeSec: before,
    })
    if (batch.length === 0) break
    all = mergeCandlesOlder(all, batch)
    const oldest = batch[0]
    if (!oldest) break
    before = oldest.time
    if (batch.length < (PAGE_LIMIT[client.name as ExchangeId] ?? 500)) break
    if (i < maxPages - 1 && pauseMs > 0) {
      await new Promise((r) => setTimeout(r, pauseMs))
    }
  }
  return all
}
