/**
 * Shared instrument subscription registry.
 * One network feed per exchange|symbol|interval; N UI consumers.
 */

import type { Candle, Interval, ExchangeId, ConnectionStatus } from '@/types'
import { getExchangeClient } from '@/data/exchanges/registry'
import { createLogger } from '@/lib/logger'

const log = createLogger('InstrumentRegistry')

export type InstrumentKey = string

export function makeInstrumentKey(
  exchange: ExchangeId | string,
  symbol: string,
  interval: Interval | string
): InstrumentKey {
  return `${exchange}|${symbol.toUpperCase()}|${interval}`
}

export interface InstrumentSnapshot {
  key: InstrumentKey
  candles: Candle[]
  status: ConnectionStatus
  lastError: string | null
  lastPrice: number | null
}

type Listener = (snap: InstrumentSnapshot) => void

interface Entry {
  key: InstrumentKey
  exchange: ExchangeId
  symbol: string
  interval: Interval
  candles: Candle[]
  status: ConnectionStatus
  lastError: string | null
  lastPrice: number | null
  listeners: Set<Listener>
  unsubLive: (() => void) | null
  gen: number
  refCount: number
}

const HISTORY_LIMIT = 1000
const LIVE_BUFFER_MAX = 1500
const entries = new Map<InstrumentKey, Entry>()

function notify(e: Entry) {
  const snap: InstrumentSnapshot = {
    key: e.key,
    candles: e.candles,
    status: e.status,
    lastError: e.lastError,
    lastPrice: e.lastPrice,
  }
  for (const fn of e.listeners) {
    try {
      fn(snap)
    } catch (err) {
      log.warn('listener error', err)
    }
  }
}

async function startFeed(e: Entry) {
  e.gen++
  const gen = e.gen
  e.unsubLive?.()
  e.unsubLive = null
  e.status = 'connecting'
  e.lastError = null
  notify(e)

  try {
    const client = getExchangeClient(e.exchange)
    const candles = await client.getKlines(e.symbol, e.interval, HISTORY_LIMIT)
    if (gen !== e.gen) return
    e.candles = candles
    e.lastPrice = candles.length ? candles[candles.length - 1]!.close : null
    e.status = 'connected'
    notify(e)

    e.unsubLive = client.subscribeKlines(e.symbol, e.interval, (bar) => {
      if (gen !== e.gen) return
      const next = [...e.candles]
      const last = next[next.length - 1]
      if (last && last.time === bar.time) next[next.length - 1] = bar
      else next.push(bar)
      if (next.length > LIVE_BUFFER_MAX) next.splice(0, next.length - LIVE_BUFFER_MAX)
      e.candles = next
      e.lastPrice = bar.close
      e.status = 'connected'
      notify(e)
    })
  } catch (err) {
    if (gen !== e.gen) return
    e.status = 'error'
    e.lastError = err instanceof Error ? err.message : String(err)
    log.warn(`feed ${e.key}`, e.lastError)
    notify(e)
  }
}

export function subscribeInstrument(
  exchange: ExchangeId | string,
  symbol: string,
  interval: Interval | string,
  listener: Listener
): () => void {
  const key = makeInstrumentKey(exchange, symbol, interval)
  let e = entries.get(key)
  if (!e) {
    e = {
      key,
      exchange: (exchange || 'binance') as ExchangeId,
      symbol: symbol.toUpperCase(),
      interval: interval as Interval,
      candles: [],
      status: 'disconnected',
      lastError: null,
      lastPrice: null,
      listeners: new Set(),
      unsubLive: null,
      gen: 0,
      refCount: 0,
    }
    entries.set(key, e)
  }
  e.listeners.add(listener)
  e.refCount++
  listener({
    key: e.key,
    candles: e.candles,
    status: e.status,
    lastError: e.lastError,
    lastPrice: e.lastPrice,
  })
  if (e.refCount === 1) void startFeed(e)

  return () => {
    e!.listeners.delete(listener)
    e!.refCount = Math.max(0, e!.refCount - 1)
    if (e!.refCount === 0) {
      e!.gen++
      e!.unsubLive?.()
      e!.unsubLive = null
      e!.status = 'disconnected'
      entries.delete(key)
    }
  }
}

export function getInstrumentSnapshot(key: InstrumentKey): InstrumentSnapshot | null {
  const e = entries.get(key)
  if (!e) return null
  return {
    key: e.key,
    candles: e.candles,
    status: e.status,
    lastError: e.lastError,
    lastPrice: e.lastPrice,
  }
}

export function _registrySize(): number {
  return entries.size
}
