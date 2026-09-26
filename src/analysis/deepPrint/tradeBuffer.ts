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

function getSlot(exchange: ExchangeId, symbol: string): BufferSlot {
  const key = feedKey(exchange, symbol)
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
  const key = feedKey(exchange, symbol)
  const slot = getSlot(exchange, symbol)
  slot.refCount += 1
  if (!slot.unsub) {
    const sub = subscribeTradeFeed(exchange, symbol, {
      onTrade: (t) => {
        slot.trades.push(t)
        if (slot.trades.length > MAX_TRADES) {
          slot.trades.splice(0, slot.trades.length - MAX_TRADES)
        }
        slot.pendingArchive.push(t)
        if (slot.pendingArchive.length >= ARCHIVE_BATCH) {
          flushArchive(exchange, symbol, slot)
        } else if (!slot.archiveTimer) {
          slot.archiveTimer = setTimeout(() => {
            slot.archiveTimer = null
            flushArchive(exchange, symbol, slot)
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
      flushArchive(exchange, symbol, slot)
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

/** Trades with event time in [startSec, endSec) – times in unix seconds. */
export function queryTradesInRange(
  exchange: ExchangeId,
  symbol: string,
  startSec: number,
  endSec: number
): AggressorTrade[] {
  const slot = buffers.get(feedKey(exchange, symbol))
  if (!slot) return []
  const startMs = startSec * 1000
  const endMs = endSec * 1000
  return slot.trades.filter((t) => t.time >= startMs && t.time < endMs)
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
  return queryArchivedTrades(exchange, symbol, startSec * 1000, endSec * 1000)
}

export function tradeBufferSize(exchange: ExchangeId, symbol: string): number {
  return buffers.get(feedKey(exchange, symbol))?.trades.length ?? 0
}
