/**
 * Ring buffer of aggressor trades for Deep Print aggregation.
 * Fed by shared subscribeTradeFeed – real ticks only.
 * Dual-writes to IndexedDB archive for historical replay.
 */

import type { ExchangeId } from '@/types'
import { subscribeTradeFeed, type AggressorTrade } from '@/data/shared'
import { feedKey } from '@/data/shared'
import { archiveTrades } from '@/data/tradeArchive'

const MAX_TRADES = 20_000
const ARCHIVE_BATCH = 40

interface BufferSlot {
  refCount: number
  trades: AggressorTrade[]
  unsub: (() => void) | null
  pendingArchive: AggressorTrade[]
  archiveTimer: ReturnType<typeof setTimeout> | null
}

const buffers = new Map<string, BufferSlot>()

/**
 * Exchange clients disagree on trade.time units:
 *   Binance spot → unix seconds
 *   Bybit/OKX/KuCoin often → milliseconds
 * Candles are always unix seconds. Normalize to ms for range queries.
 */
function tradeTimeMs(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0
  // sec ≈ 1e9, ms ≈ 1e12
  return t < 1e11 ? t * 1000 : t
}

function getSlot(exchange: ExchangeId, symbol: string): BufferSlot {
  const key = feedKey(exchange, (symbol ?? '').toUpperCase())
  let slot = buffers.get(key)
  if (slot) return slot
  slot = {
    refCount: 0,
    trades: [],
    unsub: null,
    pendingArchive: [],
    archiveTimer: null,
  }
  buffers.set(key, slot)
  return slot
}

function flushArchive(exchange: ExchangeId, symbol: string, slot: BufferSlot) {
  if (slot.pendingArchive.length === 0) return
  const batch = slot.pendingArchive.splice(0, slot.pendingArchive.length)
  void archiveTrades(exchange, symbol, batch)
}

/** Retain a live trade buffer for exchange+symbol (refcount). */
export function retainTradeBuffer(exchange: ExchangeId, symbol: string): () => void {
  const sym = (symbol ?? '').toUpperCase()
  const key = feedKey(exchange, sym)
  const slot = getSlot(exchange, sym)
  slot.refCount += 1
  if (!slot.unsub) {
    const sub = subscribeTradeFeed(exchange, sym, {
      onTrade: (t) => {
        // Store with normalized ms so archive + queries stay consistent
        const normalized: AggressorTrade = {
          ...t,
          time: tradeTimeMs(t.time),
        }
        slot.trades.push(normalized)
        if (slot.trades.length > MAX_TRADES) {
          slot.trades.splice(0, slot.trades.length - MAX_TRADES)
        }
        slot.pendingArchive.push(normalized)
        if (slot.pendingArchive.length >= ARCHIVE_BATCH) {
          flushArchive(exchange, sym, slot)
        } else if (!slot.archiveTimer) {
          slot.archiveTimer = setTimeout(() => {
            slot.archiveTimer = null
            flushArchive(exchange, sym, slot)
          }, 1500)
        }
      },
    })
    slot.unsub = () => sub.unsubscribe()
  }
  let released = false
  return () => {
    if (released) return
    released = true
    slot.refCount -= 1
    if (slot.refCount <= 0) {
      flushArchive(exchange, sym, slot)
      if (slot.archiveTimer) {
        clearTimeout(slot.archiveTimer)
        slot.archiveTimer = null
      }
      slot.unsub?.()
      slot.unsub = null
      buffers.delete(key)
    }
  }
}

/** Trades with event time in [startSec, endSec) – candle times in unix seconds. */
export function queryTradesInRange(
  exchange: ExchangeId,
  symbol: string,
  startSec: number,
  endSec: number
): AggressorTrade[] {
  const slot = buffers.get(feedKey(exchange, (symbol ?? '').toUpperCase()))
  if (!slot) return []
  const startMs = startSec * 1000
  const endMs = endSec * 1000
  return slot.trades.filter((t) => {
    const tm = tradeTimeMs(t.time)
    return tm >= startMs && tm < endMs
  })
}

/**
 * Prefer ring buffer; if empty for range, fall back to IndexedDB archive (async helper).
 */
export async function queryTradesInRangeAsync(
  exchange: ExchangeId,
  symbol: string,
  startSec: number,
  endSec: number
): Promise<AggressorTrade[]> {
  const live = queryTradesInRange(exchange, symbol, startSec, endSec)
  if (live.length > 0) return live
  const { queryArchivedTrades } = await import('@/data/tradeArchive')
  return queryArchivedTrades(
    exchange,
    (symbol ?? '').toUpperCase(),
    startSec * 1000,
    endSec * 1000
  )
}

export function tradeBufferSize(exchange: ExchangeId, symbol: string): number {
  return buffers.get(feedKey(exchange, (symbol ?? '').toUpperCase()))?.trades.length ?? 0
}
