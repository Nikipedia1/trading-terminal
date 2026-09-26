/**
 * Shared tick-by-tick trade stream (Binance aggTrade / KuCoin match).
 *
 * - One WebSocket per (exchange, symbol)
 * - Reference-counted: last unsubscriber closes the socket
 * - Emits AggressorTrade (price, qty, time, aggressor side)
 * - Reconnect + status via underlying exchange client / RWS
 * - Never synthesizes trades on error
 */

import type { ExchangeId, MarketError } from '@/types'
import { getExchangeClient } from '@/data/exchanges/registry'
import { EventBus } from './eventBus'
import {
  type AggressorTrade,
  type FeedStatusEvent,
  type FeedErrorEvent,
  aggressorFromBuyerMaker,
  feedKey,
} from './types'

interface TradeFeedEvents {
  trade: AggressorTrade
  status: FeedStatusEvent
  error: FeedErrorEvent
}

interface Slot {
  refCount: number
  bus: EventBus<TradeFeedEvents>
  unsubWs: (() => void) | null
  lastStatus: FeedStatusEvent
}

const slots = new Map<string, Slot>()

function getOrCreateSlot(exchange: ExchangeId, symbol: string): Slot {
  const key = feedKey(exchange, symbol)
  let slot = slots.get(key)
  if (slot) return slot

  slot = {
    refCount: 0,
    bus: new EventBus<TradeFeedEvents>(),
    unsubWs: null,
    lastStatus: { status: 'disconnected' },
  }
  slots.set(key, slot)
  return slot
}

function ensureConnected(exchange: ExchangeId, symbol: string, slot: Slot) {
  if (slot.unsubWs) return

  const client = getExchangeClient(exchange)
  const sym = symbol.toUpperCase()

  slot.lastStatus = { status: 'connecting', detail: 'trade stream' }
  slot.bus.emit('status', slot.lastStatus)

  slot.unsubWs = client.subscribeTrades(
    sym,
    (trade) => {
      const payload: AggressorTrade = {
        id: trade.id,
        exchange,
        symbol: trade.symbol || sym,
        price: trade.price,
        qty: trade.qty,
        time: trade.time,
        isBuyerMaker: trade.isBuyerMaker,
        aggressor: aggressorFromBuyerMaker(trade.isBuyerMaker),
      }
      slot.bus.emit('trade', payload)
    },
    (err: MarketError) => {
      slot.bus.emit('error', { error: err })
      slot.lastStatus = { status: 'error', detail: err.message }
      slot.bus.emit('status', slot.lastStatus)
    },
    (status, detail) => {
      slot.lastStatus = { status, detail }
      slot.bus.emit('status', slot.lastStatus)
    }
  )
}

function release(exchange: ExchangeId, symbol: string) {
  const key = feedKey(exchange, symbol)
  const slot = slots.get(key)
  if (!slot) return
  slot.refCount -= 1
  if (slot.refCount <= 0) {
    slot.unsubWs?.()
    slot.unsubWs = null
    slot.bus.clear()
    slots.delete(key)
  }
}

export interface TradeFeedSubscription {
  /** Latest connection status for this feed */
  getStatus: () => FeedStatusEvent
  unsubscribe: () => void
}

/**
 * Subscribe to shared trade stream for exchange+symbol.
 * Multiple callers share one WS until all unsubscribe.
 */
export function subscribeTradeFeed(
  exchange: ExchangeId,
  symbol: string,
  handlers: {
    onTrade?: (t: AggressorTrade) => void
    onStatus?: (s: FeedStatusEvent) => void
    onError?: (e: FeedErrorEvent) => void
  }
): TradeFeedSubscription {
  const slot = getOrCreateSlot(exchange, symbol)
  slot.refCount += 1
  ensureConnected(exchange, symbol, slot)

  const unsubs: Array<() => void> = []
  if (handlers.onTrade) unsubs.push(slot.bus.on('trade', handlers.onTrade))
  if (handlers.onStatus) {
    unsubs.push(slot.bus.on('status', handlers.onStatus))
    // replay current status
    handlers.onStatus(slot.lastStatus)
  }
  if (handlers.onError) unsubs.push(slot.bus.on('error', handlers.onError))

  let closed = false
  return {
    getStatus: () => slot.lastStatus,
    unsubscribe: () => {
      if (closed) return
      closed = true
      unsubs.forEach((u) => u())
      release(exchange, symbol)
    },
  }
}

/** Test/debug: active feed keys */
export function activeTradeFeedKeys(): string[] {
  return Array.from(slots.keys())
}
