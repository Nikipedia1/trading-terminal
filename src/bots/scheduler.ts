/**
 * BotScheduler – ticks outside React render cycle.
 * Idempotent signals: action@candleTime fingerprint.
 */

import { useBotStore } from './botStore'
import { evaluateBot, type CandleLike } from './engine'
import { evaluateRisk, ensureDayRuntime } from './risk'
import { type SentimentSnapshot } from './sentiment'
import { ensureRisk } from './types'
import { fetchSymbolFeed } from './symbolFeed'
import { createLogger } from '@/lib/logger'
import { makeInstrumentKey, getInstrumentSnapshot } from '@/data/instrumentRegistry'

const log = createLogger('BotScheduler')

export interface SchedulerDeps {
  getPrimaryCandles: () => CandleLike[]
  getPrimarySymbol: () => string
  getPrimaryInterval: () => string
  getPrimaryPrice: () => number | null
  getEquity: () => number
  getBalance: () => number
  getOpenMargin: () => number
  getOpenPositions: () => number
  getFills: () => { time: number; realizedPnl: number; symbol: string }[]
  placeOrder: (args: {
    symbol: string
    side: 'long' | 'short'
    qty: number
    leverage: number
    orderType: 'market'
    takeProfitPct?: number | null
    stopLossPct?: number | null
    markPrice: number
  }) => void
  closeSide: (symbol: string, side: 'long' | 'short', price: number) => void
  markToMarket: (symbol: string, price: number) => void
  checkExits: (symbol: string, price: number) => void
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

export class BotScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private busy = false
  private lastSignal = new Map<string, string>()
  private deps: SchedulerDeps
  private tickMs: number

  constructor(deps: SchedulerDeps, tickMs = 5_000) {
    this.deps = deps
    this.tickMs = tickMs
  }

  start() {
    if (this.timer) return
    void this.tick()
    this.timer = setInterval(() => void this.tick(), this.tickMs)
    log.info('started')
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    log.info('stopped')
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

  private async runOnce() {
    const store = useBotStore.getState()
    const enabled = store.bots.filter((b) => b.enabled)
    if (!enabled.length) return

    const primarySym = this.deps.getPrimarySymbol().toUpperCase()
    const primaryIv = this.deps.getPrimaryInterval()
    const primaryCandles = this.deps.getPrimaryCandles()
    const primaryPrice = this.deps.getPrimaryPrice()
    const sentiment = this.deps.getSentiment()
    const fills = this.deps.getFills()

    for (const bot of enabled) {
      const cfg = bot.config
      const sym = (cfg.symbol || primarySym).toUpperCase()
      let candles: CandleLike[] = primaryCandles
      let mark = primaryPrice

      if (sym !== primarySym) {
        const snap = getInstrumentSnapshot(makeInstrumentKey('binance', sym, primaryIv))
        if (snap?.candles?.length) {
          candles = snap.candles as CandleLike[]
          mark = snap.lastPrice
        } else {
          const feed = await fetchSymbolFeed(sym, primaryIv, 120)
          if (!feed?.candles?.length) {
            store.updateBot(bot.id, {
              lastSignal: `no feed for ${sym}`,
              lastTickAt: Date.now(),
            })
            continue
          }
          candles = feed.candles
          mark = feed.price
        }
      }

      if (!candles.length || mark == null || mark <= 0) continue

      this.deps.markToMarket(sym, mark)
      this.deps.checkExits(sym, mark)

      const last = candles[candles.length - 1]!
      const candleTime = last.time
      const dayPnl = realizedDayPnlFromFills(fills, sym)
      const runtime = ensureDayRuntime({
        ...bot,
        runtime: { ...bot.runtime, dayPnl },
      })
      store.updateBot(bot.id, { runtime })

      const signal = evaluateBot(bot, candles, sentiment)
      if (!signal || signal.action === 'hold') continue

      const fp = `${signal.action}@${candleTime}`
      if (this.lastSignal.get(bot.id) === fp) continue

      if (signal.action === 'close_long' || signal.action === 'close_short') {
        const side = signal.action === 'close_long' ? 'long' : 'short'
        this.deps.closeSide(sym, side, mark)
        this.lastSignal.set(bot.id, fp)
        store.updateBot(bot.id, {
          lastSignal: signal.action,
          lastTickAt: Date.now(),
          runtime: { ...runtime, dayTrades: (runtime.dayTrades ?? 0) + 1 },
        })
        continue
      }

      const side = signal.action === 'open_long' ? 'long' : 'short'
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
        store.updateBot(bot.id, {
          lastSignal: decision.reason || 'risk blocked',
          lastTickAt: Date.now(),
        })
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
      this.lastSignal.set(bot.id, fp)
      store.updateBot(bot.id, {
        lastSignal: `${signal.action} qty=${decision.qty}`,
        lastTickAt: Date.now(),
        runtime: { ...runtime, dayTrades: (runtime.dayTrades ?? 0) + 1 },
      })
    }
  }
}
