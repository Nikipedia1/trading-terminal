/**
 * Shared Binance Futures metrics – mark/index/funding WS + OI REST + liquidations.
 *
 * Refcounted per symbol. Multi-symbol OK but watch public rate limits.
 * Never synthesizes liquidations or OI on error.
 */

import type {
  ExchangeId,
  LiquidationEvent,
  MarkPriceTick,
  OpenInterestSnapshot,
  FundingRateRow,
  MarketError,
} from '@/types'
import { binanceFuturesClient } from '@/data/exchanges/binanceFutures'
import { EventBus } from './eventBus'
import type { FeedStatusEvent, FeedErrorEvent } from './types'
import { feedKey } from './types'

const OI_POLL_MS = 20_000
const FUNDING_POLL_MS = 60_000
const MAX_LIQ_BUFFER = 200

interface MetricsEvents {
  mark: MarkPriceTick
  liquidation: LiquidationEvent
  openInterest: OpenInterestSnapshot
  funding: FundingRateRow[]
  status: FeedStatusEvent
  error: FeedErrorEvent
}

interface Slot {
  refCount: number
  bus: EventBus<MetricsEvents>
  unsubMark: (() => void) | null
  unsubLiq: (() => void) | null
  oiTimer: number | null
  fundingTimer: number | null
  lastMark: MarkPriceTick | null
  lastOi: OpenInterestSnapshot | null
  lastFunding: FundingRateRow[]
  liqBuffer: LiquidationEvent[]
  lastStatus: FeedStatusEvent
}

const slots = new Map<string, Slot>()

function getSlot(symbol: string): Slot {
  const key = feedKey('binance_futures', symbol)
  let s = slots.get(key)
  if (s) return s
  s = {
    refCount: 0,
    bus: new EventBus(),
    unsubMark: null,
    unsubLiq: null,
    oiTimer: null,
    fundingTimer: null,
    lastMark: null,
    lastOi: null,
    lastFunding: [],
    liqBuffer: [],
    lastStatus: { status: 'disconnected' },
  }
  slots.set(key, s)
  return s
}

function ensureConnected(symbol: string, slot: Slot) {
  if (slot.unsubMark) return
  const sym = symbol.toUpperCase()
  const client = binanceFuturesClient

  slot.lastStatus = { status: 'connecting', detail: 'futures metrics' }
  slot.bus.emit('status', slot.lastStatus)

  const onErr = (err: MarketError) => {
    slot.bus.emit('error', { error: err })
    slot.lastStatus = { status: 'error', detail: err.message }
    slot.bus.emit('status', slot.lastStatus)
  }

  slot.unsubMark = client.subscribeMarkPrice(
    sym,
    (t) => {
      slot.lastMark = t
      slot.bus.emit('mark', t)
    },
    onErr,
    (status, detail) => {
      slot.lastStatus = { status, detail }
      slot.bus.emit('status', slot.lastStatus)
    }
  )

  slot.unsubLiq = client.subscribeForceOrder(
    sym,
    (e) => {
      slot.liqBuffer.push(e)
      if (slot.liqBuffer.length > MAX_LIQ_BUFFER) {
        slot.liqBuffer.splice(0, slot.liqBuffer.length - MAX_LIQ_BUFFER)
      }
      slot.bus.emit('liquidation', e)
    },
    onErr
  )

  const pollOi = async () => {
    try {
      const oi = await client.getOpenInterest(sym)
      slot.lastOi = oi
      slot.bus.emit('openInterest', oi)
    } catch (err: any) {
      if (err?.code) onErr(err)
    }
  }
  const pollFunding = async () => {
    try {
      const rows = await client.getFundingRate(sym, 8)
      slot.lastFunding = rows
      slot.bus.emit('funding', rows)
    } catch (err: any) {
      if (err?.code) onErr(err)
    }
  }

  void pollOi()
  void pollFunding()
  // seed mark from REST once
  void client.getPremiumIndex(sym).then((t) => {
    slot.lastMark = t
    slot.bus.emit('mark', t)
  }).catch(() => {})

  slot.oiTimer = window.setInterval(() => void pollOi(), OI_POLL_MS)
  slot.fundingTimer = window.setInterval(() => void pollFunding(), FUNDING_POLL_MS)
}

function release(symbol: string) {
  const key = feedKey('binance_futures', symbol)
  const slot = slots.get(key)
  if (!slot) return
  slot.refCount -= 1
  if (slot.refCount <= 0) {
    slot.unsubMark?.()
    slot.unsubLiq?.()
    if (slot.oiTimer != null) window.clearInterval(slot.oiTimer)
    if (slot.fundingTimer != null) window.clearInterval(slot.fundingTimer)
    slot.bus.clear()
    slots.delete(key)
  }
}

export interface FuturesMetricsSubscription {
  getMark: () => MarkPriceTick | null
  getOpenInterest: () => OpenInterestSnapshot | null
  getFunding: () => FundingRateRow[]
  getRecentLiquidations: () => LiquidationEvent[]
  getStatus: () => FeedStatusEvent
  unsubscribe: () => void
}

/**
 * Subscribe to futures metrics for a USDT-M symbol.
 * Only meaningful for binance_futures; other exchanges return a no-op sub.
 */
export function subscribeFuturesMetrics(
  exchange: ExchangeId,
  symbol: string,
  handlers: {
    onMark?: (t: MarkPriceTick) => void
    onLiquidation?: (e: LiquidationEvent) => void
    onOpenInterest?: (o: OpenInterestSnapshot) => void
    onFunding?: (rows: FundingRateRow[]) => void
    onStatus?: (s: FeedStatusEvent) => void
    onError?: (e: FeedErrorEvent) => void
  } = {}
): FuturesMetricsSubscription {
  if (exchange !== 'binance_futures') {
    return {
      getMark: () => null,
      getOpenInterest: () => null,
      getFunding: () => [],
      getRecentLiquidations: () => [],
      getStatus: () => ({
        status: 'disconnected',
        detail: 'Metrics only on Binance Futures',
      }),
      unsubscribe: () => {},
    }
  }

  const slot = getSlot(symbol)
  slot.refCount += 1
  ensureConnected(symbol, slot)

  const unsubs: Array<() => void> = []
  if (handlers.onMark) {
    unsubs.push(slot.bus.on('mark', handlers.onMark))
    if (slot.lastMark) handlers.onMark(slot.lastMark)
  }
  if (handlers.onLiquidation) {
    unsubs.push(slot.bus.on('liquidation', handlers.onLiquidation))
  }
  if (handlers.onOpenInterest) {
    unsubs.push(slot.bus.on('openInterest', handlers.onOpenInterest))
    if (slot.lastOi) handlers.onOpenInterest(slot.lastOi)
  }
  if (handlers.onFunding) {
    unsubs.push(slot.bus.on('funding', handlers.onFunding))
    if (slot.lastFunding.length) handlers.onFunding(slot.lastFunding)
  }
  if (handlers.onStatus) {
    unsubs.push(slot.bus.on('status', handlers.onStatus))
    handlers.onStatus(slot.lastStatus)
  }
  if (handlers.onError) unsubs.push(slot.bus.on('error', handlers.onError))

  let closed = false
  return {
    getMark: () => slot.lastMark,
    getOpenInterest: () => slot.lastOi,
    getFunding: () => slot.lastFunding,
    getRecentLiquidations: () => [...slot.liqBuffer],
    getStatus: () => slot.lastStatus,
    unsubscribe: () => {
      if (closed) return
      closed = true
      unsubs.forEach((u) => u())
      release(symbol)
    },
  }
}

export function activeFuturesMetricsKeys(): string[] {
  return Array.from(slots.keys())
}
