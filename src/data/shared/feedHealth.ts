/**
 * Feed quality metrics – client-side only (free).
 * Latency from exchange event time vs local clock (not true one-way RTT).
 * Never invents health when disconnected.
 */

import type { ExchangeId } from '@/types'
import { EventBus } from './eventBus'
import { feedKey } from './types'

const LATENCY_WINDOW = 200
const STALE_BOOK_MS = 3000
const STALE_TICK_MS = 5000
const ERROR_QUEUE_MAX = 30

export interface FeedErrorEntry {
  ts: number
  code: string
  message: string
}

export interface FeedHealthSnapshot {
  key: string
  exchange: ExchangeId
  symbol: string
  /** Latency samples ms (event→local), newest last */
  latencyMs: number[]
  latencyP50: number | null
  latencyP99: number | null
  reconnects: number
  gaps: number
  resyncs: number
  lastEventAt: number | null
  lastBookAt: number | null
  lastTickAt: number | null
  /** ms since last trade/tick event; null if never */
  tickAgeMs: number | null
  /** ms since last book update; null if never */
  bookAgeMs: number | null
  bookStale: boolean
  tickStale: boolean
  status: string
  /** Recent errors (newest first), capped */
  errorQueue: FeedErrorEntry[]
}

interface Internal {
  exchange: ExchangeId
  symbol: string
  latency: number[]
  reconnects: number
  gaps: number
  resyncs: number
  lastEventAt: number | null
  lastBookAt: number | null
  lastTickAt: number | null
  status: string
  errors: FeedErrorEntry[]
}

const state = new Map<string, Internal>()
const bus = new EventBus<{ update: FeedHealthSnapshot }>()

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  )
  return sorted[idx]
}

function ensure(exchange: ExchangeId, symbol: string): Internal {
  const key = feedKey(exchange, symbol)
  let s = state.get(key)
  if (!s) {
    s = {
      exchange,
      symbol: symbol.toUpperCase(),
      latency: [],
      reconnects: 0,
      gaps: 0,
      resyncs: 0,
      lastEventAt: null,
      lastBookAt: null,
      lastTickAt: null,
      status: 'disconnected',
      errors: [],
    }
    state.set(key, s)
  }
  return s
}

function toSnap(s: Internal): FeedHealthSnapshot {
  const sorted = [...s.latency].sort((a, b) => a - b)
  const now = Date.now()
  const tickAgeMs = s.lastTickAt != null ? now - s.lastTickAt : null
  const bookAgeMs = s.lastBookAt != null ? now - s.lastBookAt : null
  return {
    key: feedKey(s.exchange, s.symbol),
    exchange: s.exchange,
    symbol: s.symbol,
    latencyMs: s.latency,
    latencyP50: percentile(sorted, 50),
    latencyP99: percentile(sorted, 99),
    reconnects: s.reconnects,
    gaps: s.gaps,
    resyncs: s.resyncs,
    lastEventAt: s.lastEventAt,
    lastBookAt: s.lastBookAt,
    lastTickAt: s.lastTickAt,
    tickAgeMs,
    bookAgeMs,
    bookStale: bookAgeMs != null ? bookAgeMs > STALE_BOOK_MS : false,
    tickStale: tickAgeMs != null ? tickAgeMs > STALE_TICK_MS : false,
    status: s.status,
    errorQueue: s.errors.slice(0, ERROR_QUEUE_MAX),
  }
}

function emit(s: Internal) {
  bus.emit('update', toSnap(s))
}

/** Record exchange event time (ms) → local latency sample */
export function recordEventLatency(
  exchange: ExchangeId,
  symbol: string,
  eventTimeMs: number
) {
  if (!Number.isFinite(eventTimeMs) || eventTimeMs <= 0) return
  const s = ensure(exchange, symbol)
  const lag = Date.now() - eventTimeMs
  // Ignore absurd clock skew (>60s) so p99 stays meaningful
  if (lag < -5000 || lag > 60_000) return
  s.latency.push(Math.max(0, lag))
  if (s.latency.length > LATENCY_WINDOW) s.latency.shift()
  s.lastEventAt = Date.now()
  emit(s)
}

/** Mark a trade/tick arrival (for tick age) */
export function recordTick(exchange: ExchangeId, symbol: string) {
  const s = ensure(exchange, symbol)
  const now = Date.now()
  s.lastTickAt = now
  s.lastEventAt = now
  emit(s)
}

export function recordBookUpdate(exchange: ExchangeId, symbol: string) {
  const s = ensure(exchange, symbol)
  s.lastBookAt = Date.now()
  s.lastEventAt = s.lastBookAt
  emit(s)
}

export function recordGap(exchange: ExchangeId, symbol: string) {
  const s = ensure(exchange, symbol)
  s.gaps += 1
  emit(s)
}

export function recordResync(exchange: ExchangeId, symbol: string) {
  const s = ensure(exchange, symbol)
  s.resyncs += 1
  emit(s)
}

export function recordReconnect(exchange: ExchangeId, symbol: string) {
  const s = ensure(exchange, symbol)
  s.reconnects += 1
  emit(s)
}

export function recordFeedStatus(
  exchange: ExchangeId,
  symbol: string,
  status: string
) {
  const s = ensure(exchange, symbol)
  if (status === 'reconnecting' && s.status === 'connected') {
    s.reconnects += 1
  }
  s.status = status
  emit(s)
}

export function recordFeedError(
  exchange: ExchangeId,
  symbol: string,
  code: string,
  message: string
) {
  const s = ensure(exchange, symbol)
  s.errors.unshift({
    ts: Date.now(),
    code: code || 'ERR',
    message: (message || '').slice(0, 200),
  })
  if (s.errors.length > ERROR_QUEUE_MAX) s.errors.length = ERROR_QUEUE_MAX
  emit(s)
}

export function clearFeedErrors(exchange: ExchangeId, symbol: string) {
  const s = ensure(exchange, symbol)
  s.errors = []
  emit(s)
}

export function getFeedHealth(
  exchange: ExchangeId,
  symbol: string
): FeedHealthSnapshot {
  return toSnap(ensure(exchange, symbol))
}

export function getAllFeedHealth(): FeedHealthSnapshot[] {
  return Array.from(state.values()).map(toSnap)
}

export function subscribeFeedHealth(
  handler: (s: FeedHealthSnapshot) => void
): () => void {
  return bus.on('update', handler)
}

export const FEED_HEALTH_NOTES = {
  latency:
    'Latency = local receive − exchange event time (clock skew included). Not pure network RTT.',
  history:
    'Tick history is local IndexedDB only (free). No 24/7 cloud recorder in free tier.',
  book: 'Public L2 is aggregated depth, not MBO/full market-by-order.',
  stale: `Book stale >${STALE_BOOK_MS}ms · Tick stale >${STALE_TICK_MS}ms`,
} as const
