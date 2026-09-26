/**
 * Ring buffer of aggressor trades for Deep Print aggregation.
 * Fed by shared subscribeTradeFeed – real ticks only.
 */

import type { ExchangeId } from '@/types'
import { subscribeTradeFeed, type AggressorTrade } from '@/data/shared'
import { feedKey } from '@/data/shared'

const MAX_TRADES = 20_000

interface BufferSlot {
  refCount: number
  trades: AggressorTrade[]
  unsub: (() => void) | null
}

const buffers = new Map<string, BufferSlot>()

function getSlot(exchange: ExchangeId, symbol: string): BufferSlot {
  const key = feedKey(exchange, symbol)
  let slot = buffers.get(key)
  if (slot) return slot
  slot = { refCount: 0, trades: [], unsub: null }
  buffers.set(key, slot)
  return slot
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

export function tradeBufferSize(exchange: ExchangeId, symbol: string): number {
  return buffers.get(feedKey(exchange, symbol))?.trades.length ?? 0
}
