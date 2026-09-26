/**
 * Shared L2 order book with local reconstruction.
 *
 * Binance: depth@100ms + REST snapshot limit=1000 (official sync).
 * KuCoin: level2 sequence + REST level2_100 (max ~100 levels public).
 *
 * One connection per (exchange, symbol), refcounted. Never fabricates levels.
 */

import type { ExchangeId, MarketError, ConnectionStatus } from '@/types'
import { ReconnectingWebSocket } from '@/data/ws/reconnecting-ws'
import { EventBus } from './eventBus'
import {
  type LocalOrderBook,
  type OrderBookSnapshot,
  type FeedStatusEvent,
  type FeedErrorEvent,
  type BookLevel,
  feedKey,
} from './types'

const BINANCE_REST = 'https://api.binance.com'
const BINANCE_WS = 'wss://stream.binance.com:9443'
const KUCOIN_REST = 'https://api.kucoin.com'

/** Levels published per side – enough for DeepDom band around mid */
const SNAPSHOT_TOP_N = 200

interface BookFeedEvents {
  book: OrderBookSnapshot
  status: FeedStatusEvent
  error: FeedErrorEvent
}

interface Slot {
  refCount: number
  bus: EventBus<BookFeedEvents>
  stop: (() => void) | null
  lastStatus: FeedStatusEvent
  lastSnapshot: OrderBookSnapshot | null
}

const slots = new Map<string, Slot>()

function createError(exchange: string, code: string, message: string): MarketError {
  return { code, message, exchange, timestamp: Date.now() }
}

function mapsToSnapshot(book: LocalOrderBook, topN = SNAPSHOT_TOP_N): OrderBookSnapshot {
  const bids: BookLevel[] = []
  const asks: BookLevel[] = []
  for (const [price, qty] of book.bids) {
    if (qty > 0) bids.push({ price, qty })
  }
  for (const [price, qty] of book.asks) {
    if (qty > 0) asks.push({ price, qty })
  }
  bids.sort((a, b) => b.price - a.price)
  asks.sort((a, b) => a.price - b.price)
  return {
    exchange: book.exchange,
    symbol: book.symbol,
    lastUpdateId: book.lastUpdateId,
    bids: bids.slice(0, topN),
    asks: asks.slice(0, topN),
    updatedAt: book.updatedAt,
    ready: book.ready,
  }
}

function applySide(map: Map<number, number>, levels: [string, string][]) {
  for (const [p, q] of levels) {
    const price = parseFloat(p)
    const qty = parseFloat(q)
    if (!Number.isFinite(price) || !Number.isFinite(qty)) continue
    if (qty === 0) map.delete(price)
    else map.set(price, qty)
  }
}

function startBinanceBook(symbol: string, slot: Slot): () => void {
  const sym = symbol.toUpperCase()
  const stream = `${sym.toLowerCase()}@depth@100ms`

  let book: LocalOrderBook = {
    exchange: 'binance',
    symbol: sym,
    lastUpdateId: 0,
    bids: new Map(),
    asks: new Map(),
    updatedAt: 0,
    ready: false,
  }

  let buffer: any[] = []
  let syncing = false
  let synced = false
  let resyncAbort: AbortController | null = null

  const publish = () => {
    const snap = mapsToSnapshot(book)
    slot.lastSnapshot = snap
    slot.bus.emit('book', snap)
  }

  const setStatus = (status: ConnectionStatus, detail?: string) => {
    slot.lastStatus = { status, detail }
    slot.bus.emit('status', slot.lastStatus)
  }

  const resync = async () => {
    // Cancel any in-flight snapshot so a late response cannot overwrite newer state
    resyncAbort?.abort()
    resyncAbort = new AbortController()
    const signal = resyncAbort.signal

    syncing = true
    synced = false
    book.ready = false
    buffer = []
    setStatus('connecting', 'depth snapshot')

    try {
      await new Promise((r) => setTimeout(r, 50))
      if (signal.aborted) {
        syncing = false
        return
      }

      const url = `${BINANCE_REST}/api/v3/depth?symbol=${sym}&limit=1000`
      const res = await fetch(url, { signal })
      if (!res.ok) {
        const body = await res.text()
        const err =
          res.status === 429
            ? createError('binance', 'RATE_LIMIT', `Depth snapshot 429: ${body}`)
            : createError('binance', 'REST_DEPTH', `HTTP ${res.status}: ${body}`)
        slot.bus.emit('error', { error: err })
        setStatus('error', err.message)
        syncing = false
        return
      }
      const raw = await res.json()
      if (signal.aborted) {
        syncing = false
        return
      }
      const lastUpdateId = raw.lastUpdateId as number
      book = {
        exchange: 'binance',
        symbol: sym,
        lastUpdateId,
        bids: new Map(),
        asks: new Map(),
        updatedAt: Date.now(),
        ready: false,
      }
      for (const [p, q] of raw.bids as [string, string][]) {
        const qty = parseFloat(q)
        if (qty > 0) book.bids.set(parseFloat(p), qty)
      }
      for (const [p, q] of raw.asks as [string, string][]) {
        const qty = parseFloat(q)
        if (qty > 0) book.asks.set(parseFloat(p), qty)
      }

      buffer = buffer.filter((e) => e.u > lastUpdateId)

      const first = buffer[0]
      if (first && (first.U > lastUpdateId + 1 || first.u < lastUpdateId + 1)) {
        syncing = false
        void resync()
        return
      }

      for (const ev of buffer) {
        applySide(book.bids, ev.b || [])
        applySide(book.asks, ev.a || [])
        book.lastUpdateId = ev.u
      }
      buffer = []
      book.ready = true
      book.updatedAt = Date.now()
      synced = true
      syncing = false
      setStatus('connected', 'depth synced')
      publish()
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        syncing = false
        return
      }
      syncing = false
      const err = createError('binance', 'REST_DEPTH', e.message || 'Snapshot failed')
      slot.bus.emit('error', { error: err })
      setStatus('error', err.message)
    }
  }

  const onDiff = (data: any) => {
    if (data.e !== 'depthUpdate') return
    if (!synced) {
      buffer.push(data)
      if (buffer.length > 5000) buffer.shift()
      return
    }
    if (data.U > book.lastUpdateId + 1) {
      void resync()
      return
    }
    if (data.u <= book.lastUpdateId) return

    applySide(book.bids, data.b || [])
    applySide(book.asks, data.a || [])
    book.lastUpdateId = data.u
    book.updatedAt = Date.now()
    book.ready = true
    publish()
  }

  const rws = new ReconnectingWebSocket(`${BINANCE_WS}/ws/${stream}`, {
    minBackoffMs: 1000,
    maxBackoffMs: 30_000,
    onStatus: (s, detail) => {
      setStatus(s, detail)
      if (s === 'connected') void resync()
      if (s === 'reconnecting' || s === 'disconnected') {
        synced = false
        book.ready = false
      }
    },
    onMessage: (data) => onDiff(data),
    onError: (msg) => {
      slot.bus.emit('error', { error: createError('binance', 'WS_DEPTH', msg) })
    },
  })
  void rws.connect()

  return () => {
    resyncAbort?.abort()
    rws.close()
  }
}

async function kucoinBullet(): Promise<{ endpoint: string; token: string; pingInterval: number }> {
  const res = await fetch(`${KUCOIN_REST}/api/v1/bullet-public`, { method: 'POST' })
  if (!res.ok) throw new Error(`bullet-public HTTP ${res.status}`)
  const json = await res.json()
  if (json.code !== '200000') throw new Error(json.msg || 'bullet-public failed')
  const server = json.data.instanceServers?.[0]
  return {
    endpoint: server.endpoint,
    token: json.data.token,
    pingInterval: server.pingInterval ?? 18000,
  }
}

function toKucoinSymbol(symbol: string): string {
  const s = symbol.toUpperCase().replace('/', '-')
  if (s.includes('-')) return s
  for (const q of ['USDT', 'USDC', 'BTC', 'ETH', 'BUSD']) {
    if (s.endsWith(q) && s.length > q.length) return `${s.slice(0, -q.length)}-${q}`
  }
  return s
}

function startKucoinBook(symbol: string, slot: Slot): () => void {
  const sym = toKucoinSymbol(symbol)
  const topic = `/market/level2:${sym}`

  let book: LocalOrderBook = {
    exchange: 'kucoin',
    symbol: sym,
    lastUpdateId: 0,
    bids: new Map(),
    asks: new Map(),
    updatedAt: 0,
    ready: false,
  }
  let buffer: any[] = []
  let synced = false
  let syncing = false
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let rws: ReconnectingWebSocket | null = null
  let resyncAbort: AbortController | null = null

  const publish = () => {
    const snap = mapsToSnapshot(book)
    slot.lastSnapshot = snap
    slot.bus.emit('book', snap)
  }

  const setStatus = (status: ConnectionStatus, detail?: string) => {
    slot.lastStatus = { status, detail }
    slot.bus.emit('status', slot.lastStatus)
  }

  const applyKucoinChanges = (b: LocalOrderBook, data: any) => {
    const changes = data.changes || {}
    for (const row of changes.bids || []) {
      const price = parseFloat(row[0])
      const qty = parseFloat(row[1])
      if (qty === 0) b.bids.delete(price)
      else b.bids.set(price, qty)
    }
    for (const row of changes.asks || []) {
      const price = parseFloat(row[0])
      const qty = parseFloat(row[1])
      if (qty === 0) b.asks.delete(price)
      else b.asks.set(price, qty)
    }
    if (data.sequenceEnd != null) b.lastUpdateId = data.sequenceEnd
    b.updatedAt = Date.now()
  }

  const resync = async () => {
    resyncAbort?.abort()
    resyncAbort = new AbortController()
    const signal = resyncAbort.signal

    syncing = true
    synced = false
    book.ready = false
    buffer = []
    setStatus('connecting', 'kucoin depth snapshot')
    try {
      // Public API: max 100 levels – DeepDom band is limited vs Binance 1000
      const url = `${KUCOIN_REST}/api/v1/market/orderbook/level2_100?symbol=${encodeURIComponent(sym)}`
      const res = await fetch(url, { signal })
      if (!res.ok) {
        const err = createError('kucoin', 'REST_DEPTH', `HTTP ${res.status}`)
        slot.bus.emit('error', { error: err })
        setStatus('error', err.message)
        syncing = false
        return
      }
      const json = await res.json()
      if (signal.aborted) {
        syncing = false
        return
      }
      if (json.code !== '200000' || !json.data) {
        const err = createError('kucoin', 'REST_DEPTH', json.msg || 'snapshot failed')
        slot.bus.emit('error', { error: err })
        setStatus('error', err.message)
        syncing = false
        return
      }
      const seq = parseInt(json.data.sequence, 10)
      book = {
        exchange: 'kucoin',
        symbol: sym,
        lastUpdateId: seq,
        bids: new Map(),
        asks: new Map(),
        updatedAt: Date.now(),
        ready: false,
      }
      for (const [p, q] of json.data.bids || []) {
        const qty = parseFloat(q)
        if (qty > 0) book.bids.set(parseFloat(p), qty)
      }
      for (const [p, q] of json.data.asks || []) {
        const qty = parseFloat(q)
        if (qty > 0) book.asks.set(parseFloat(p), qty)
      }

      buffer = buffer.filter((e) => (e.sequenceEnd ?? 0) > seq)
      for (const ev of buffer) applyKucoinChanges(book, ev)
      buffer = []
      book.ready = true
      synced = true
      syncing = false
      setStatus('connected', 'depth synced (≤100 lvl)')
      publish()
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        syncing = false
        return
      }
      syncing = false
      const err = createError('kucoin', 'REST_DEPTH', e.message || 'Snapshot failed')
      slot.bus.emit('error', { error: err })
      setStatus('error', err.message)
    }
  }

  rws = new ReconnectingWebSocket('', {
    urlFactory: async () => {
      const b = await kucoinBullet()
      ;(rws as any)._ping = b.pingInterval
      return `${b.endpoint}?token=${encodeURIComponent(b.token)}&connectId=${Date.now()}`
    },
    minBackoffMs: 1500,
    maxBackoffMs: 30_000,
    onStatus: (s, detail) => {
      setStatus(s, detail)
      if (s === 'connected' && rws) {
        rws.send({
          id: Date.now(),
          type: 'subscribe',
          topic,
          privateChannel: false,
          response: true,
        })
        if (pingTimer) clearInterval(pingTimer)
        const ms = (rws as any)._ping ?? 18000
        pingTimer = setInterval(() => rws?.send({ id: Date.now(), type: 'ping' }), ms)
        void resync()
      }
      if (s === 'reconnecting' || s === 'disconnected') {
        synced = false
        book.ready = false
        if (pingTimer) {
          clearInterval(pingTimer)
          pingTimer = null
        }
      }
    },
    onMessage: (msg: any) => {
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'pong' || msg.type === 'welcome' || msg.type === 'ack') return
      if (msg.type !== 'message' || msg.topic !== topic) return
      const data = msg.data
      if (!synced) {
        buffer.push(data)
        if (buffer.length > 5000) buffer.shift()
        return
      }
      const start = data.sequenceStart
      if (start != null && start > book.lastUpdateId + 1) {
        void resync()
        return
      }
      applyKucoinChanges(book, data)
      book.ready = true
      publish()
    },
    onError: (m) => {
      slot.bus.emit('error', { error: createError('kucoin', 'WS_DEPTH', m) })
    },
  })
  void rws.connect()

  return () => {
    resyncAbort?.abort()
    if (pingTimer) clearInterval(pingTimer)
    rws?.close()
  }
}

function getOrCreateSlot(exchange: ExchangeId, symbol: string): Slot {
  const key = feedKey(exchange, symbol)
  let slot = slots.get(key)
  if (slot) return slot
  slot = {
    refCount: 0,
    bus: new EventBus(),
    stop: null,
    lastStatus: { status: 'disconnected' },
    lastSnapshot: null,
  }
  slots.set(key, slot)
  return slot
}

function ensureConnected(exchange: ExchangeId, symbol: string, slot: Slot) {
  if (slot.stop) return
  if (exchange === 'binance') {
    slot.stop = startBinanceBook(symbol, slot)
  } else if (exchange === 'kucoin') {
    slot.stop = startKucoinBook(symbol, slot)
  } else {
    const err = createError(exchange, 'UNSUPPORTED', `No L2 engine for ${exchange}`)
    slot.bus.emit('error', { error: err })
    slot.lastStatus = { status: 'error', detail: err.message }
  }
}

function release(exchange: ExchangeId, symbol: string) {
  const key = feedKey(exchange, symbol)
  const slot = slots.get(key)
  if (!slot) return
  slot.refCount -= 1
  if (slot.refCount <= 0) {
    slot.stop?.()
    slot.stop = null
    slot.bus.clear()
    slots.delete(key)
  }
}

export interface OrderBookFeedSubscription {
  getStatus: () => FeedStatusEvent
  getSnapshot: () => OrderBookSnapshot | null
  unsubscribe: () => void
}

export function subscribeOrderBookFeed(
  exchange: ExchangeId,
  symbol: string,
  handlers: {
    onBook?: (b: OrderBookSnapshot) => void
    onStatus?: (s: FeedStatusEvent) => void
    onError?: (e: FeedErrorEvent) => void
  }
): OrderBookFeedSubscription {
  const slot = getOrCreateSlot(exchange, symbol)
  slot.refCount += 1
  ensureConnected(exchange, symbol, slot)

  const unsubs: Array<() => void> = []
  if (handlers.onBook) {
    unsubs.push(slot.bus.on('book', handlers.onBook))
    if (slot.lastSnapshot) handlers.onBook(slot.lastSnapshot)
  }
  if (handlers.onStatus) {
    unsubs.push(slot.bus.on('status', handlers.onStatus))
    handlers.onStatus(slot.lastStatus)
  }
  if (handlers.onError) unsubs.push(slot.bus.on('error', handlers.onError))

  let closed = false
  return {
    getStatus: () => slot.lastStatus,
    getSnapshot: () => slot.lastSnapshot,
    unsubscribe: () => {
      if (closed) return
      closed = true
      unsubs.forEach((u) => u())
      release(exchange, symbol)
    },
  }
}

export function activeOrderBookFeedKeys(): string[] {
  return Array.from(slots.keys())
}
