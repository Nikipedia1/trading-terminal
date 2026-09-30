/**
 * BotScheduler – engine outside React.
 *
 * Stability:
 *  - Idempotency: signalId = botId:action:candleCloseTime (once per closed bar)
 *  - Hard cooldown: min ms between any order for the same bot
 *  - Debounce: skip tick if (lastPrice, candleCloseTime) unchanged since last run
 *  - dayPnl from paper fills (UTC day) before risk gate
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

/** Minimum gap between orders for the same bot (ms). */
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

export function makeSignalId(
  botId: string,
  action: string,
  candleCloseTime: number
): string {
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

  constructor(
    deps: SchedulerDeps,
    opts?: { tickMs?: number; cooldownMs?: number }
  ) {
    this.deps = deps
    this.tickMs = opts?.tickMs ?? 5_000
    this.cooldownMs = opts?.cooldownMs ?? BOT_HARD_COOLDOWN_MS
  }

  start() {
    if (this.timer) return
    void this.tick()
    this.timer = setInterval(() => void this.tick(), this.tickMs)
    log.info('started', { tickMs: this.tickMs, cooldownMs: this.cooldownMs })
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
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

  private pruneSignals(now: number) {
    const maxAge = 6 * 60 * 60_000
    for (const [id, at] of this.executedSignals) {
      if (now - at > maxAge) this.executedSignals.delete(id)
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
    const candleCloseTime = primaryCandles.length
      ? primaryCandles[primaryCandles.length - 1]!.time
      : 0
    const marketFp = `${primarySym}|${candleCloseTime}|${primaryPrice ?? ''}`

    if (marketFp === this.lastMarketFp && candleCloseTime > 0) {
      return
    }
    this.lastMarketFp = marketFp

    const sentiment = this.deps.getSentiment()
    const fills = this.deps.getFills()
    const now = Date.now()
    this.pruneSignals(now)

    for (const bot of enabled) {
      const cfg = bot.config
      const sym = (cfg.symbol || primarySym).toUpperCase()
      let candles: CandleLike[] = primaryCandles
      let mark = primaryPrice

      if (sym !== primarySym) {
        const snap = getInstrumentSnapshot(
          makeInstrumentKey('binance', sym, primaryIv)
        )
        if (snap?.candles?.length) {
          candles = snap.candles as CandleLike[]
          mark = snap.lastPrice
        } else {
          const feed = await fetchSymbolFeed(sym, primaryIv, 120)
          if (!feed?.candles?.length) {
            store.updateBot(bot.id, {
              lastSignal: `no feed for ${sym}`,
              lastTickAt: now,
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
      const barTime = last.time

      const dayPnl = realizedDayPnlFromFills(fills, sym)
      const runtime = ensureDayRuntime({
        ...bot,
        runtime: { ...bot.runtime, dayPnl },
      })
      if (
        bot.runtime?.dayPnl !== runtime.dayPnl ||
        bot.runtime?.dayKey !== runtime.dayKey
      ) {
        store.updateBot(bot.id, { runtime })
      }

      const signal = evaluateBot({ ...bot, runtime }, candles, sentiment)
      if (!signal || signal.action === 'hold') continue

      const signalId = makeSignalId(bot.id, signal.action, barTime)
      if (this.executedSignals.has(signalId)) continue

      const lastOrd = this.lastOrderAt.get(bot.id) ?? 0
      if (now - lastOrd < this.cooldownMs) {
        store.updateBot(bot.id, {
          lastSignal: `cooldown ${Math.ceil((this.cooldownMs - (now - lastOrd)) / 1000)}s`,
          lastTickAt: now,
        })
        continue
      }

      if (signal.action === 'close_long' || signal.action === 'close_short') {
        const side = signal.action === 'close_long' ? 'long' : 'short'
        this.deps.closeSide(sym, side, mark)
        this.executedSignals.set(signalId, now)
        this.lastOrderAt.set(bot.id, now)
        store.updateBot(bot.id, {
          lastSignal: `${signal.action} [${signalId}]`,
          lastTickAt: now,
          runtime: {
            ...runtime,
            dayTrades: (runtime.dayTrades ?? 0) + 1,
            lastOrderAt: now,
          },
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
          lastTickAt: now,
        })
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
        lastSignal: `${signal.action} qty=${decision.qty}`,
        lastTickAt: now,
        runtime: {
          ...runtime,
          dayTrades: (runtime.dayTrades ?? 0) + 1,
          lastOrderAt: now,
        },
      })
    }
  }
}
