/**
 * BotScheduler – multi-symbol feeds, true grid limits, signalId + cooldown.
 */

import { useBotStore } from './botStore'
import { evaluateBot, type CandleLike } from './engine'
import { evaluateRisk, ensureDayRuntime } from './risk'
import { type SentimentSnapshot } from './sentiment'
import { ensureRisk } from './types'
import { fetchSymbolFeed } from './symbolFeed'
import { createLogger } from '@/lib/logger'
import {
  makeInstrumentKey,
  getInstrumentSnapshot,
  subscribeInstrument,
} from '@/data/instrumentRegistry'
import { planGridSync, applyGridFill, ensureGridParams } from './gridEngine'

const log = createLogger('BotScheduler')
export const BOT_HARD_COOLDOWN_MS = 15_000

export interface SchedulerDeps {
  getPrimaryCandles: () => CandleLike[]
  getPrimarySymbol: () => string
  getPrimaryInterval: () => string
  getPrimaryPrice: () => number | null
  getEquity: () => number
  getBalance: () => number
  getOpenMargin: () => number
  getOpenPositions: () => number
  getFills: () => {
    time: number
    realizedPnl: number
    symbol: string
    orderId?: string
    side?: string
    qty?: number
  }[]
  getOpenLimits: (symbol: string) => {
    id: string
    symbol: string
    side: 'long' | 'short'
    type: string
    status: string
    price: number | null
    qty: number
  }[]
  placeOrder: (args: {
    symbol: string
    side: 'long' | 'short'
    qty: number
    leverage: number
    orderType: 'market' | 'limit'
    price?: number | null
    takeProfitPct?: number | null
    stopLossPct?: number | null
    markPrice: number
    postOnly?: boolean
  }) => { ok: boolean; orderId?: string; error?: string }
  cancelOrder: (orderId: string) => void
  closeSide: (symbol: string, side: 'long' | 'short', price: number) => void
  markToMarket: (symbol: string, price: number) => void
  tryFillLimits: (symbol: string, price: number) => void
  checkExits: (symbol: string, price: number) => void
  applyFunding: (marks: Record<string, number>) => void
  recordEquity: () => void
  getSentiment: () => SentimentSnapshot | null
}

function utcDayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10)
}
function dayStartMs(key: string) {
  return Date.parse(`${key}T00:00:00.000Z`)
}

export function realizedDayPnlFromFills(
  fills: { time: number; realizedPnl: number; symbol: string }[],
  symbol?: string
): number {
  const key = utcDayKey()
  const start = dayStartMs(key)
  let sum = 0
  for (const f of fills) {
    if (f.time < start) continue
    if (!Number.isFinite(f.realizedPnl) || f.realizedPnl === 0) continue
    if (symbol && f.symbol.toUpperCase() !== symbol.toUpperCase()) continue
    sum += f.realizedPnl
  }
  return sum
}

export function makeSignalId(botId: string, action: string, candleCloseTime: number): string {
  return `${botId}:${action}:${candleCloseTime}`
}

export class BotScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private busy = false
  private executedSignals = new Map<string, number>()
  private lastOrderAt = new Map<string, number>()
  private lastMarketFp = ''
  private deps: SchedulerDeps
  private tickMs: number
  private cooldownMs: number
  private feedUnsubs = new Map<string, () => void>()
  private lastEquityAt = 0
  private lastFundingAt = 0

  constructor(deps: SchedulerDeps, opts?: { tickMs?: number; cooldownMs?: number }) {
    this.deps = deps
    this.tickMs = opts?.tickMs ?? 4_000
    this.cooldownMs = opts?.cooldownMs ?? BOT_HARD_COOLDOWN_MS
  }

  start() {
    if (this.timer) return
    void this.tick()
    this.timer = setInterval(() => void this.tick(), this.tickMs)
    log.info('started', { tickMs: this.tickMs })
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    for (const u of this.feedUnsubs.values()) u()
    this.feedUnsubs.clear()
    log.info('stopped')
  }

  async forceTick() {
    this.lastMarketFp = ''
    await this.tick()
  }

  async tick() {
    if (this.busy) return
    this.busy = true
    try {
      await this.runOnce()
    } catch (e) {
      log.error('tick failed', e)
    } finally {
      this.busy = false
    }
  }

  private syncFeeds(symbols: string[], interval: string) {
    const want = new Set(symbols.map((s) => s.toUpperCase()))
    for (const [sym, unsub] of this.feedUnsubs) {
      if (!want.has(sym)) {
        unsub()
        this.feedUnsubs.delete(sym)
      }
    }
    for (const sym of want) {
      if (this.feedUnsubs.has(sym)) continue
      const unsub = subscribeInstrument('binance', sym, interval, () => {})
      this.feedUnsubs.set(sym, unsub)
      log.info(`feed subscribed ${sym}`)
    }
  }

  private async resolveMarket(
    sym: string,
    primarySym: string,
    primaryIv: string,
    primaryCandles: CandleLike[],
    primaryPrice: number | null
  ): Promise<{ candles: CandleLike[]; mark: number | null }> {
    if (sym === primarySym) return { candles: primaryCandles, mark: primaryPrice }
    const snap = getInstrumentSnapshot(makeInstrumentKey('binance', sym, primaryIv))
    if (snap?.candles?.length) {
      return { candles: snap.candles as CandleLike[], mark: snap.lastPrice }
    }
    const feed = await fetchSymbolFeed(sym, primaryIv, 120)
    if (!feed?.candles?.length) return { candles: [], mark: null }
    return { candles: feed.candles, mark: feed.price }
  }

  private pruneSignals(now: number) {
    const maxAge = 6 * 60 * 60_000
    for (const [id, at] of this.executedSignals) {
      if (now - at > maxAge) this.executedSignals.delete(id)
    }
  }

  private async runGridBot(
    bot: ReturnType<typeof useBotStore.getState>['bots'][0],
    sym: string,
    mark: number,
    now: number
  ) {
    const store = useBotStore.getState()
    const openLimits = this.deps.getOpenLimits(sym)
    const plan = planGridSync(bot, mark, openLimits)
    if (!plan) return

    for (const id of plan.toCancel) this.deps.cancelOrder(id)

    const runtime = { ...plan.runtime }
    const orderIds = { ...(runtime.gridOrderIds ?? {}) }

    for (const p of plan.toPlace) {
      const res = this.deps.placeOrder({
        symbol: sym,
        side: p.side,
        qty: p.qty,
        leverage: bot.config.leverage,
        orderType: 'limit',
        price: p.price,
        markPrice: mark,
        postOnly: true,
      })
      if (res.ok && res.orderId) orderIds[String(p.levelIndex)] = res.orderId
    }

    const fills = this.deps.getFills()
    const tracked = new Set(Object.values(bot.runtime?.gridOrderIds ?? {}))
    for (const f of fills.slice(0, 20)) {
      if (!f.orderId || !tracked.has(f.orderId)) continue
      if (f.time < now - 60_000) continue
      const side = (f.side as 'long' | 'short') || 'long'
      Object.assign(runtime, applyGridFill(runtime, side, f.qty ?? 0, f.orderId))
    }

    runtime.gridOrderIds = orderIds
    store.updateBot(bot.id, { runtime, lastSignal: plan.message, lastTickAt: now })
  }

  private async runOnce() {
    const store = useBotStore.getState()
    const enabled = store.bots.filter((b) => b.enabled)
    if (!enabled.length) return

    const primarySym = this.deps.getPrimarySymbol().toUpperCase()
    const primaryIv = this.deps.getPrimaryInterval()
    const primaryCandles = this.deps.getPrimaryCandles()
    const primaryPrice = this.deps.getPrimaryPrice()
    const candleCloseTime = primaryCandles.length
      ? primaryCandles[primaryCandles.length - 1]!.time
      : 0

    const symbols = enabled.map((b) => (b.config.symbol || primarySym).toUpperCase())
    this.syncFeeds([...new Set(symbols)], primaryIv)

    const marketFp = `${primarySym}|${candleCloseTime}|${primaryPrice ?? ''}|${enabled.map((b) => b.id).join(',')}`
    if (marketFp !== this.lastMarketFp) this.lastMarketFp = marketFp

    const sentiment = this.deps.getSentiment()
    const fills = this.deps.getFills()
    const now = Date.now()
    this.pruneSignals(now)
    const marks: Record<string, number> = {}
    if (primaryPrice) marks[primarySym] = primaryPrice

    for (const bot of enabled) {
      const cfg = bot.config
      const sym = (cfg.symbol || primarySym).toUpperCase()
      const { candles, mark } = await this.resolveMarket(
        sym, primarySym, primaryIv, primaryCandles, primaryPrice
      )
      if (!candles.length || mark == null || mark <= 0) continue
      marks[sym] = mark

      this.deps.markToMarket(sym, mark)
      this.deps.tryFillLimits(sym, mark)
      this.deps.checkExits(sym, mark)

      if (bot.kind === 'grid' && bot.params.kind === 'grid') {
        ensureGridParams(bot.params.grid)
        await this.runGridBot(bot, sym, mark, now)
        continue
      }

      const last = candles[candles.length - 1]!
      const barTime = last.time
      const dayPnl = realizedDayPnlFromFills(fills, sym)
      const runtime = ensureDayRuntime({ ...bot, runtime: { ...bot.runtime, dayPnl } })
      if (bot.runtime?.dayPnl !== runtime.dayPnl || bot.runtime?.dayKey !== runtime.dayKey) {
        store.updateBot(bot.id, { runtime })
      }

      const signal = evaluateBot({ ...bot, runtime }, candles, mark)
      if (!signal || signal.side === 'flat') continue

      const action =
        signal.side === 'long' ? 'open_long' : signal.side === 'short' ? 'open_short' : 'hold'
      if (action === 'hold') continue

      const signalId = makeSignalId(bot.id, action, barTime)
      if (this.executedSignals.has(signalId)) continue
      const lastOrd = this.lastOrderAt.get(bot.id) ?? 0
      if (now - lastOrd < this.cooldownMs) continue

      const side = action === 'open_long' ? 'long' : 'short'
      const riskBot = { ...bot, runtime, config: ensureRisk({ ...cfg }) }
      const decision = evaluateRisk(
        riskBot,
        {
          equity: this.deps.getEquity(),
          balance: this.deps.getBalance(),
          openMargin: this.deps.getOpenMargin(),
          openPositions: this.deps.getOpenPositions(),
          dayPnl,
          markPrice: mark,
        },
        side,
        sentiment
      )
      if (!decision.ok || decision.qty <= 0) {
        store.updateBot(bot.id, { lastSignal: decision.reason || 'risk blocked', lastTickAt: now })
        this.executedSignals.set(signalId, now)
        continue
      }

      this.deps.placeOrder({
        symbol: sym,
        side,
        qty: decision.qty,
        leverage: decision.leverage,
        orderType: 'market',
        takeProfitPct: decision.takeProfitPct,
        stopLossPct: decision.stopLossPct,
        markPrice: mark,
      })
      this.executedSignals.set(signalId, now)
      this.lastOrderAt.set(bot.id, now)
      store.updateBot(bot.id, {
        lastSignal: `${action} qty=${decision.qty}`,
        lastTickAt: now,
        runtime: { ...runtime, dayTrades: (runtime.dayTrades ?? 0) + 1, lastOrderAt: now },
      })
    }

    if (now - this.lastFundingAt > 60_000) {
      this.deps.applyFunding(marks)
      this.lastFundingAt = now
    }
    if (now - this.lastEquityAt > 30_000) {
      this.deps.recordEquity()
      this.lastEquityAt = now
    }
  }
}
