/**
 * Tick enabled bots → risk gate + sentiment → paper orders.
 */

import { useEffect, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { usePaperStore, positionUnrealizedPnl } from '@/trading/paper'
import { useBotStore } from './botStore'
import { evaluateBot } from './engine'
import { evaluateRisk, ensureDayRuntime } from './risk'
import { computeSentiment, fetchFearGreed, type SentimentSnapshot } from './sentiment'
import { ensureRisk } from './types'

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
  const bots = useBotStore((s) => s.bots)
  const updateBot = useBotStore((s) => s.updateBot)
  const placeOrder = usePaperStore((s) => s.placeOrder)
  const positions = usePaperStore((s) => s.positions)
  const account = usePaperStore((s) => s.account)
  const closeSide = usePaperStore((s) => s.closeSide)
  const markToMarket = usePaperStore((s) => s.markToMarket)
  const checkExits = usePaperStore((s) => s.checkExits)

  const sentiment = useMarketSentiment()
  const busy = useRef(false)

  useEffect(() => {
    const enabled = bots.filter((b) => b.enabled)
    if (!enabled.length) return
    const px = ticker?.lastPrice
    if (!px || !Number.isFinite(px) || px <= 0) return
    if (busy.current) return
    busy.current = true

    try {
      const openMargin = positions.reduce((s, p) => s + p.margin, 0)
      const upnl = positions.reduce((s, p) => s + positionUnrealizedPnl(p), 0)
      const equity = account.balance + openMargin + upnl

      for (const raw of enabled) {
        const bot = { ...raw, config: ensureRisk(raw.config) }
        const sym = bot.config.symbol.toUpperCase()
        if (sym !== symbol.toUpperCase()) continue

        const cooldownMs = (bot.config.cooldownSec || 60) * 1000
        const lastOrd = bot.runtime?.lastOrderAt ?? 0

        markToMarket(sym, px)
        checkExits(sym, px)

        const signal = evaluateBot(bot, candles, px)
        const sentLabel = sentiment
          ? ` · sent ${sentiment.label} (${sentiment.score.toFixed(2)})`
          : ''
        updateBot(bot.id, {
          lastTickAt: Date.now(),
          lastSignal: signal
            ? `${signal.side}: ${signal.reason}${sentLabel}`
            : bot.lastSignal,
        })

        if (!signal || signal.side === 'flat') continue
        if (Date.now() - lastOrd < cooldownMs && bot.kind !== 'dca') continue

        const openSame = positions.filter(
          (p) => p.symbol === sym && p.side === signal.side
        )
        if (openSame.length >= bot.config.maxPositions) continue

        const risk = evaluateRisk(
          bot,
          {
            equity,
            balance: account.balance,
            openMargin,
            openPositions: positions.length,
            dayPnl: bot.runtime?.dayPnl ?? 0,
            markPrice: px,
          },
          signal.side,
          sentiment
        )

        if (!risk.ok) {
          updateBot(bot.id, {
            lastError: risk.reason ?? 'Risk blocked',
            lastSignal: `blocked: ${risk.reason}`,
          })
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
          markPrice: px,
          takeProfit: tp,
          stopLoss: sl,
        })

        if (!res.ok) {
          updateBot(bot.id, { lastError: res.error, status: 'error' })
          continue
        }

        const dayRt = ensureDayRuntime(bot)
        const runtime = {
          ...dayRt,
          lastOrderAt: Date.now(),
          lastSide: signal.side,
          dcaCount:
            bot.kind === 'dca' ? (dayRt.dcaCount ?? 0) + 1 : dayRt.dcaCount,
          gridCenter:
            bot.kind === 'grid' ? dayRt.gridCenter ?? px : dayRt.gridCenter,
          dayTrades: (dayRt.dayTrades ?? 0) + 1,
        }

        updateBot(bot.id, {
          lastError: null,
          status: 'running',
          lastSignal: `${signal.side}: ${signal.reason} qty=${risk.qty}${sentLabel}`,
          runtime,
          stats: {
            ...bot.stats,
            trades: bot.stats.trades + 1,
          },
        })
      }
    } finally {
      busy.current = false
    }
  }, [
    candles,
    ticker?.lastPrice,
    symbol,
    bots,
    positions,
    account.balance,
    sentiment,
    updateBot,
    placeOrder,
    closeSide,
    markToMarket,
    checkExits,
  ])

  return sentiment
}
