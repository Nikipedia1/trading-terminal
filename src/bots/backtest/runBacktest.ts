import { evaluateBot, type CandleLike } from '../engine'
import type { BotInstance } from '../types'
import { ensureRisk, defaultConfig, defaultParams } from '../types'
import { evaluateRisk, ensureDayRuntime } from '../risk'

export interface BacktestTrade {
  time: number
  side: 'long' | 'short'
  price: number
  qty: number
  reason: string
  pnl?: number
}

export interface BacktestResult {
  trades: BacktestTrade[]
  equity: { t: number; equity: number }[]
  stats: {
    trades: number
    wins: number
    losses: number
    realizedPnl: number
    maxDrawdownPct: number
    finalEquity: number
  }
}

export interface BacktestOpts {
  bot: BotInstance
  candles: CandleLike[]
  initialBalance?: number
  feeBps?: number
}

export function runBacktest(opts: BacktestOpts): BacktestResult {
  const { bot: botIn, candles } = opts
  const initial = opts.initialBalance ?? 10_000
  const feeBps = opts.feeBps ?? 4
  let bot: BotInstance = {
    ...botIn,
    config: ensureRisk(botIn.config),
    runtime: {},
  }
  let cash = initial
  let position: { side: 'long' | 'short'; qty: number; entry: number } | null = null
  const trades: BacktestTrade[] = []
  const equity: { t: number; equity: number }[] = []
  let peak = initial
  let maxDd = 0
  let wins = 0
  let losses = 0
  let realized = 0

  for (let i = 20; i < candles.length; i++) {
    const slice = candles.slice(0, i + 1)
    const bar = candles[i]!
    const mark = bar.close
    bot = { ...bot, runtime: ensureDayRuntime(bot) }

    const signal = evaluateBot(bot, slice, mark)
    if (signal && signal.side !== 'flat') {
      const side = signal.side as 'long' | 'short'
      const risk = evaluateRisk(
        bot,
        {
          equity:
            cash +
            (position
              ? (position.side === 'long' ? mark - position.entry : position.entry - mark) *
                position.qty
              : 0),
          balance: cash,
          openMargin: position ? (position.qty * mark) / bot.config.leverage : 0,
          openPositions: position ? 1 : 0,
          dayPnl: bot.runtime?.dayPnl ?? 0,
          markPrice: mark,
        },
        side,
        null
      )

      if (risk.ok && risk.qty > 0) {
        if (position && position.side !== side) {
          const pnl =
            (position.side === 'long' ? mark - position.entry : position.entry - mark) *
            position.qty
          const fee = (position.qty * mark * feeBps) / 10_000
          cash += pnl - fee
          realized += pnl - fee
          if (pnl > 0) wins++
          else losses++
          trades.push({
            time: bar.time,
            side: position.side,
            price: mark,
            qty: position.qty,
            reason: 'close',
            pnl: pnl - fee,
          })
          position = null
        }
        if (!position) {
          const qty = risk.qty
          const fee = (qty * mark * feeBps) / 10_000
          cash -= fee
          position = { side, qty, entry: mark }
          trades.push({
            time: bar.time,
            side,
            price: mark,
            qty,
            reason: signal.reason,
          })
          bot = {
            ...bot,
            runtime: {
              ...bot.runtime,
              lastOrderAt: Date.now(),
              lastSide: side,
              dcaCount:
                (bot.runtime?.dcaCount ?? 0) + (bot.kind === 'dca' ? 1 : 0),
            },
          }
        }
      }
    }

    const u =
      position != null
        ? (position.side === 'long' ? mark - position.entry : position.entry - mark) *
          position.qty
        : 0
    const eq = cash + u
    equity.push({ t: bar.time, equity: eq })
    if (eq > peak) peak = eq
    const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0
    if (dd > maxDd) maxDd = dd
  }

  if (position && candles.length) {
    const mark = candles[candles.length - 1]!.close
    const pnl =
      (position.side === 'long' ? mark - position.entry : position.entry - mark) *
      position.qty
    realized += pnl
    if (pnl > 0) wins++
    else losses++
    cash += pnl
    trades.push({
      time: candles[candles.length - 1]!.time,
      side: position.side,
      price: mark,
      qty: position.qty,
      reason: 'eod',
      pnl,
    })
  }

  return {
    trades,
    equity,
    stats: {
      trades: trades.length,
      wins,
      losses,
      realizedPnl: realized,
      maxDrawdownPct: maxDd,
      finalEquity: cash,
    },
  }
}

export function makeBacktestBot(
  kind: BotInstance['kind'],
  symbol = 'BTCUSDT'
): BotInstance {
  return {
    id: 'bt-1',
    name: `Backtest ${kind}`,
    kind,
    status: 'idle',
    enabled: false,
    config: defaultConfig(symbol),
    params: defaultParams(kind),
    createdAt: Date.now(),
    lastTickAt: null,
    lastSignal: null,
    lastError: null,
    stats: { trades: 0, wins: 0, losses: 0, realizedPnl: 0 },
  }
}
