/**
 * Multi-pair bot runner: primary chart via marketStore, other symbols via REST feed.
 * Stable deps, dayPnl from fills, grid level tracking.
 */

import { useEffect, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { usePaperStore, positionUnrealizedPnl } from '@/trading/paper'
import { useBotStore } from './botStore'
import { evaluateBot, type CandleLike } from './engine'
import { evaluateRisk, ensureDayRuntime } from './risk'
import { computeSentiment, fetchFearGreed, type SentimentSnapshot } from './sentiment'
import { ensureRisk } from './types'
import { fetchSymbolFeed } from './symbolFeed'

function utcDayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function dayStartMs(key: string): number {
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

export function useMarketSentiment(): SentimentSnapshot | null {
  const candles = useMarketStore((s) => s.candles)
  const ticker = useMarketStore((s) => s.ticker)
  const [fg, setFg] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void fetchFearGreed().then((v) => {
      if (alive) setFg(v)
    })
    const t = window.setInterval(() => {
      void fetchFearGreed().then((v) => {
        if (alive) setFg(v)
      })
    }, 15 * 60_000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  if (!candles.length) return null
  return computeSentiment(candles, ticker?.priceChangePercent ?? null, fg)
}

export function useBotRunner() {
  const candles = useMarketStore((s) => s.candles)
  const ticker = useMarketStore((s) => s.ticker)
  const symbol = useMarketStore((s) => s.symbol)
  const interval = useMarketStore((s) => s.interval)
  const fills = usePaperStore((s) => s.fills)
  const positions = usePaperStore((s) => s.positions)
  const account = usePaperStore((s) => s.account)
  const placeOrder = usePaperStore((s) => s.placeOrder)
  const closeSide = usePaperStore((s) => s.closeSide)
  const markToMarket = usePaperStore((s) => s.markToMarket)
  const checkExits = usePaperStore((s) => s.checkExits)

  const enabledKey = useBotStore((s) =>
    s.bots
      .filter((b) => b.enabled)
      .map((b) => `${b.id}:${b.config.symbol}`)
      .sort()
      .join(',')
  )

  const lastCandleTime = candles.length ? candles[candles.length - 1].time : 0
  const lastPrice = ticker?.lastPrice ?? 0
  const sentiment = useMarketSentiment()
  const busy = useRef(false)
  const signalDone = useRef<Map<string, string>>(new Map())
  const lastEvalCandle = useRef<number>(0)
  const lastUiUpdate = useRef<Map<string, string>>(new Map())
  const secondary = useRef<Map<string, { candles: CandleLike[]; price: number }>>(new Map())
  const [, bump] = useState(0)

  useEffect(() => {
    if (!enabledKey) return
    let alive = true
    const bots = useBotStore.getState().bots.filter((b) => b.enabled)
    const primary = symbol.toUpperCase()
    const others = [
      ...new Set(
        bots
          .map((b) => b.config.symbol.toUpperCase())
          .filter((s) => s && s !== primary)
      ),
    ]

    const load = async () => {
      for (const sym of others) {
        const feed = await fetchSymbolFeed(sym, interval || '1m')
        if (!alive || !feed) continue
        secondary.current.set(sym, feed)
        markToMarket(sym, feed.price)
        checkExits(sym, feed.price)
      }
      if (alive && others.length) bump((n) => n + 1)
    }
    void load()
    const t = window.setInterval(load, 15_000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [enabledKey, symbol, interval, markToMarket, checkExits])

  useEffect(() => {
    if (!enabledKey) return
    const px = lastPrice
    if (!px || !Number.isFinite(px) || px <= 0) return
    const sym = symbol.toUpperCase()
    markToMarket(sym, px)
    checkExits(sym, px)
  }, [lastPrice, symbol, enabledKey, markToMarket, checkExits])

  useEffect(() => {
    if (!enabledKey) return
    if (busy.current) return

    const primaryPx = lastPrice
    const primarySym = symbol.toUpperCase()
    const hasAnyPrice =
      (primaryPx > 0 && Number.isFinite(primaryPx)) || secondary.current.size > 0
    if (!hasAnyPrice) return

    const evalKey = lastCandleTime || Date.now()
    if (lastCandleTime) lastEvalCandle.current = lastCandleTime

    busy.current = true
    try {
      const bots = useBotStore
        .getState()
        .bots.filter((b) => b.enabled)
        .map((b) => ({ ...b, config: ensureRisk(b.config) }))

      const openMargin = positions.reduce((s, p) => s + p.margin, 0)
      const upnl = positions.reduce((s, p) => s + positionUnrealizedPnl(p), 0)
      const equity = account.balance + openMargin + upnl
      const dayKey = utcDayKey()
      const globalDayPnl = realizedDayPnlFromFills(fills)

      for (const bot of bots) {
        const sym = bot.config.symbol.toUpperCase()
        let botCandles: CandleLike[] = candles as CandleLike[]
        let px = primaryPx

        if (sym !== primarySym) {
          const feed = secondary.current.get(sym)
          if (!feed || !feed.price) {
            useBotStore.getState().updateBot(bot.id, {
              lastSignal: `waiting feed ${sym}`,
            })
            continue
          }
          botCandles = feed.candles
          px = feed.price
        } else if (!px || px <= 0) {
          continue
        }

        const cooldownMs = (bot.config.cooldownSec || 60) * 1000
        const lastOrd = bot.runtime?.lastOrderAt ?? 0

        const dayPnl = realizedDayPnlFromFills(fills, sym)
        let runtime = ensureDayRuntime(bot)
        runtime = { ...runtime, dayPnl }

        if (bot.kind === 'grid' && runtime.gridCenter == null) {
          runtime = { ...runtime, gridCenter: px, gridFilledLevels: [] }
        }

        const candleT =
          botCandles.length > 0 ? botCandles[botCandles.length - 1].time : evalKey
        const signal = evaluateBot(bot, botCandles, px)
        const sentLabel = sentiment
          ? ` · sent ${sentiment.label} (${sentiment.score.toFixed(2)})`
          : ''
        const signalText = signal
          ? `${signal.side}: ${signal.reason}${sentLabel}`
          : bot.lastSignal
        const prevUi = lastUiUpdate.current.get(bot.id)
        if (signalText && signalText !== prevUi) {
          lastUiUpdate.current.set(bot.id, signalText)
          useBotStore.getState().updateBot(bot.id, {
            lastTickAt: Date.now(),
            lastSignal: signalText,
            runtime,
          })
        } else {
          useBotStore.getState().updateBot(bot.id, { runtime })
        }

        if (!signal || signal.side === 'flat') continue
        if (Date.now() - lastOrd < cooldownMs && bot.kind !== 'dca') continue

        const level = signal.meta?.gridLevel
        const sigKey =
          level != null
            ? `grid-${level}@${Math.floor(px)}`
            : `${signal.side}@${candleT}`
        if (signalDone.current.get(bot.id) === sigKey) continue

        const openSame = positions.filter(
          (p) => p.symbol === sym && p.side === signal.side
        )
        if (openSame.length >= bot.config.maxPositions) continue

        const risk = evaluateRisk(
          { ...bot, runtime },
          {
            equity,
            balance: account.balance,
            openMargin,
            openPositions: positions.length,
            dayPnl: runtime.dayPnl ?? globalDayPnl,
            markPrice: px,
          },
          signal.side,
          sentiment
        )

        if (!risk.ok) {
          const blocked = `blocked: ${risk.reason}`
          if (lastUiUpdate.current.get(bot.id) !== blocked) {
            lastUiUpdate.current.set(bot.id, blocked)
            useBotStore.getState().updateBot(bot.id, {
              lastError: risk.reason ?? 'Risk blocked',
              lastSignal: blocked,
            })
          }
          continue
        }

        const opposite = signal.side === 'long' ? 'short' : 'long'
        const hasOpp = positions.some((p) => p.symbol === sym && p.side === opposite)
        if (hasOpp) closeSide(sym, opposite, px)

        let tp: number | null = null
        let sl: number | null = null
        if (risk.takeProfitPct && risk.takeProfitPct > 0) {
          const r = risk.takeProfitPct / 100
          tp = signal.side === 'long' ? px * (1 + r) : px * (1 - r)
        }
        if (risk.stopLossPct && risk.stopLossPct > 0) {
          const r = risk.stopLossPct / 100
          sl = signal.side === 'long' ? px * (1 - r) : px * (1 + r)
        }

        const res = placeOrder({
          symbol: sym,
          side: signal.side,
          type: 'market',
          qty: risk.qty,
          leverage: risk.leverage,
          marginMode: 'isolated',
          markPrice: px,
          takeProfit: tp,
          stopLoss: sl,
        })

        if (res.ok) {
          signalDone.current.set(bot.id, sigKey)
          const filledLevels = [...(runtime.gridFilledLevels ?? [])]
          if (level != null && !filledLevels.includes(level)) {
            filledLevels.push(level)
            const maxLevels =
              bot.params.kind === 'grid' ? bot.params.grid.levels || 6 : 6
            if (filledLevels.length >= maxLevels) {
              filledLevels.length = 0
              runtime = { ...runtime, gridCenter: px }
            }
          }
          const stats = bot.stats ?? {
            trades: 0,
            wins: 0,
            losses: 0,
            realizedPnl: 0,
          }
          useBotStore.getState().updateBot(bot.id, {
            lastError: null,
            lastSignal: `filled ${signal.side} ${sym} @ ${px.toFixed(4)}`,
            lastTickAt: Date.now(),
            stats: { ...stats, trades: stats.trades + 1 },
            runtime: {
              ...runtime,
              lastOrderAt: Date.now(),
              lastSide: signal.side,
              dayTrades: (runtime.dayTrades ?? 0) + 1,
              dayPnl: runtime.dayPnl,
              dayKey,
              gridFilledLevels: filledLevels,
              dcaCount:
                bot.kind === 'dca' ? (runtime.dcaCount ?? 0) + 1 : runtime.dcaCount,
            },
          })
        } else {
          useBotStore.getState().updateBot(bot.id, {
            lastError: res.error,
            lastSignal: `order failed: ${res.error}`,
          })
        }
      }
    } finally {
      busy.current = false
    }
  }, [
    enabledKey,
    lastCandleTime,
    lastPrice,
    symbol,
    candles,
    positions,
    account.balance,
    fills,
    sentiment,
    placeOrder,
    closeSide,
  ])
}
