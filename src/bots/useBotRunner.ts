/**
 * Tick enabled bots against live candles/ticker → paper orders.
 */

import { useEffect, useRef } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { usePaperStore } from '@/trading/paper'
import { useBotStore } from './botStore'
import { evaluateBot } from './engine'

export function useBotRunner() {
  const candles = useMarketStore((s) => s.candles)
  const ticker = useMarketStore((s) => s.ticker)
  const symbol = useMarketStore((s) => s.symbol)
  const bots = useBotStore((s) => s.bots)
  const updateBot = useBotStore((s) => s.updateBot)
  const placeOrder = usePaperStore((s) => s.placeOrder)
  const positions = usePaperStore((s) => s.positions)
  const closeSide = usePaperStore((s) => s.closeSide)
  const markToMarket = usePaperStore((s) => s.markToMarket)
  const checkExits = usePaperStore((s) => s.checkExits)

  const busy = useRef(false)

  useEffect(() => {
    const enabled = bots.filter((b) => b.enabled)
    if (!enabled.length) return
    const px = ticker?.lastPrice
    if (!px || !Number.isFinite(px) || px <= 0) return
    if (busy.current) return
    busy.current = true

    try {
      for (const bot of enabled) {
        const sym = bot.config.symbol.toUpperCase()
        if (sym !== symbol.toUpperCase()) continue

        const cooldownMs = (bot.config.cooldownSec || 60) * 1000
        const lastOrd = bot.runtime?.lastOrderAt ?? 0

        markToMarket(sym, px)
        checkExits(sym, px)

        const signal = evaluateBot(bot, candles, px)
        updateBot(bot.id, {
          lastTickAt: Date.now(),
          lastSignal: signal ? `${signal.side}: ${signal.reason}` : bot.lastSignal,
        })

        if (!signal || signal.side === 'flat') continue
        if (Date.now() - lastOrd < cooldownMs && bot.kind !== 'dca') continue

        const openSame = positions.filter(
          (p) => p.symbol === sym && p.side === signal.side
        )
        if (openSame.length >= bot.config.maxPositions) continue

        const opposite = signal.side === 'long' ? 'short' : 'long'
        const hasOpp = positions.some((p) => p.symbol === sym && p.side === opposite)
        if (hasOpp) closeSide(sym, opposite, px)

        const qty = bot.config.qty
        if (!Number.isFinite(qty) || qty <= 0) continue

        let tp: number | null = null
        let sl: number | null = null
        if (bot.config.takeProfitPct && bot.config.takeProfitPct > 0) {
          const r = bot.config.takeProfitPct / 100
          tp = signal.side === 'long' ? px * (1 + r) : px * (1 - r)
        }
        if (bot.config.stopLossPct && bot.config.stopLossPct > 0) {
          const r = bot.config.stopLossPct / 100
          sl = signal.side === 'long' ? px * (1 - r) : px * (1 + r)
        }

        const res = placeOrder({
          symbol: sym,
          side: signal.side,
          type: 'market',
          qty,
          leverage: bot.config.leverage,
          markPrice: px,
          takeProfit: tp,
          stopLoss: sl,
        })

        if (!res.ok) {
          updateBot(bot.id, { lastError: res.error, status: 'error' })
          continue
        }

        const runtime = {
          ...bot.runtime,
          lastOrderAt: Date.now(),
          lastSide: signal.side,
          dcaCount:
            bot.kind === 'dca' ? (bot.runtime?.dcaCount ?? 0) + 1 : bot.runtime?.dcaCount,
          gridCenter:
            bot.kind === 'grid'
              ? bot.runtime?.gridCenter ?? px
              : bot.runtime?.gridCenter,
        }

        updateBot(bot.id, {
          lastError: null,
          status: 'running',
          lastSignal: `${signal.side}: ${signal.reason}`,
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
    updateBot,
    placeOrder,
    closeSide,
    markToMarket,
    checkExits,
  ])
}
