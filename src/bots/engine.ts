/** Local signal engine – pure functions on candle closes. */

import type { BotInstance, BotKind } from './types'

export interface CandleLike {
  open: number
  high: number
  low: number
  close: number
  volume?: number
  time: number
}

export type Signal = {
  side: 'long' | 'short' | 'flat'
  reason: string
}

function closes(c: CandleLike[]): number[] {
  return c.map((x) => x.close)
}

function sma(arr: number[], period: number): number | null {
  if (arr.length < period) return null
  let s = 0
  for (let i = arr.length - period; i < arr.length; i++) s += arr[i]
  return s / period
}

function emaSeries(arr: number[], period: number): number[] {
  if (arr.length === 0) return []
  const k = 2 / (period + 1)
  const out: number[] = [arr[0]]
  for (let i = 1; i < arr.length; i++) {
    out.push(arr[i] * k + out[i - 1] * (1 - k))
  }
  return out
}

function rsi(arr: number[], period: number): number | null {
  if (arr.length < period + 1) return null
  let gains = 0
  let losses = 0
  for (let i = arr.length - period; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1]
    if (d >= 0) gains += d
    else losses -= d
  }
  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

function stdev(arr: number[], period: number): number | null {
  const m = sma(arr, period)
  if (m == null) return null
  let s = 0
  for (let i = arr.length - period; i < arr.length; i++) {
    const d = arr[i] - m
    s += d * d
  }
  return Math.sqrt(s / period)
}

export function evaluateBot(
  bot: BotInstance,
  candles: CandleLike[],
  lastPrice: number
): Signal | null {
  if (!candles.length || !Number.isFinite(lastPrice) || lastPrice <= 0) return null
  const c = closes(candles)
  const kind = bot.kind

  if (kind === 'dca' && bot.params.kind === 'dca') {
    const intervalMs = bot.params.dca.intervalMin * 60_000
    const last = bot.runtime?.lastOrderAt ?? 0
    const count = bot.runtime?.dcaCount ?? 0
    if (count >= bot.params.dca.maxOrders) {
      return { side: 'flat', reason: 'DCA max orders reached' }
    }
    if (Date.now() - last < intervalMs) return null
    return { side: 'long', reason: `DCA buy #${count + 1}` }
  }

  if (kind === 'grid' && bot.params.kind === 'grid') {
    const rangePct = bot.params.grid.rangePct / 100
    const center = bot.runtime?.gridCenter ?? lastPrice
    const upper = center * (1 + rangePct / 2)
    const lower = center * (1 - rangePct / 2)
    if (lastPrice <= lower) return { side: 'long', reason: `Grid bid @ ${lower.toFixed(2)}` }
    if (lastPrice >= upper) return { side: 'short', reason: `Grid ask @ ${upper.toFixed(2)}` }
    return null
  }

  if (kind === 'rsi' && bot.params.kind === 'rsi') {
    const v = rsi(c, bot.params.rsi.period)
    if (v == null) return null
    if (v <= bot.params.rsi.oversold)
      return { side: 'long', reason: `RSI ${v.toFixed(1)} ≤ ${bot.params.rsi.oversold}` }
    if (v >= bot.params.rsi.overbought)
      return { side: 'short', reason: `RSI ${v.toFixed(1)} ≥ ${bot.params.rsi.overbought}` }
    return null
  }

  if (kind === 'ema_cross' && bot.params.kind === 'ema_cross') {
    const { fast, slow } = bot.params.ema
    if (c.length < slow + 2) return null
    const f = emaSeries(c, fast)
    const s = emaSeries(c, slow)
    const i = f.length - 1
    const crossUp = f[i - 1] <= s[i - 1] && f[i] > s[i]
    const crossDn = f[i - 1] >= s[i - 1] && f[i] < s[i]
    if (crossUp) return { side: 'long', reason: `EMA${fast} cross above EMA${slow}` }
    if (crossDn) return { side: 'short', reason: `EMA${fast} cross below EMA${slow}` }
    return null
  }

  if (kind === 'breakout' && bot.params.kind === 'breakout') {
    const lb = bot.params.breakout.lookback
    if (c.length < lb + 1) return null
    const window = c.slice(-lb - 1, -1)
    const hi = Math.max(...window)
    const lo = Math.min(...window)
    const buf = bot.params.breakout.bufferPct / 100
    if (lastPrice > hi * (1 + buf))
      return { side: 'long', reason: `Break high ${hi.toFixed(2)}` }
    if (lastPrice < lo * (1 - buf))
      return { side: 'short', reason: `Break low ${lo.toFixed(2)}` }
    return null
  }

  if (kind === 'bollinger' && bot.params.kind === 'bollinger') {
    const { period, stdDev } = bot.params.bollinger
    const mid = sma(c, period)
    const sd = stdev(c, period)
    if (mid == null || sd == null) return null
    const upper = mid + stdDev * sd
    const lower = mid - stdDev * sd
    if (lastPrice <= lower) return { side: 'long', reason: `BB lower ${lower.toFixed(2)}` }
    if (lastPrice >= upper) return { side: 'short', reason: `BB upper ${upper.toFixed(2)}` }
    return null
  }

  return null
}

export function botKindList(): BotKind[] {
  return ['grid', 'dca', 'rsi', 'ema_cross', 'breakout', 'bollinger']
}
