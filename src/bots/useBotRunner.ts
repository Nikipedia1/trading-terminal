/**
 * React adapter for BotScheduler.
 *
 * Stable dependencies only:
 *  - enabledBotIds (sorted id list of enabled bots)
 *  - candleCloseTime + lastPrice (drive forceTick without recreating scheduler)
 *
 * Scheduler instance lives for the whole "has enabled bots" session.
 * Debounce + signalId + hard cooldown live inside BotScheduler.
 */

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { usePaperStore, positionUnrealizedPnl } from '@/trading/paper'
import {
  BotScheduler,
  realizedDayPnlFromFills,
  BOT_HARD_COOLDOWN_MS,
} from './scheduler'
import {
  computeSentiment,
  fetchFearGreed,
  type SentimentSnapshot,
} from './sentiment'
import { useBotStore } from './botStore'

export { realizedDayPnlFromFills, BOT_HARD_COOLDOWN_MS }

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

function buildDeps(
  sentimentRef: MutableRefObject<SentimentSnapshot | null>
) {
  return {
    getPrimaryCandles: () => useMarketStore.getState().candles,
    getPrimarySymbol: () => useMarketStore.getState().symbol,
    getPrimaryInterval: () => useMarketStore.getState().interval,
    getPrimaryPrice: () => {
      const t = useMarketStore.getState().ticker
      const c = useMarketStore.getState().candles
      return t?.last ?? (c.length ? c[c.length - 1]!.close : null)
    },
    getEquity: () => {
      const p = usePaperStore.getState()
      let u = 0
      for (const pos of p.positions) u += positionUnrealizedPnl(pos)
      return p.account.balance + u
    },
    getBalance: () => usePaperStore.getState().account.balance,
    getOpenMargin: () =>
      usePaperStore.getState().positions.reduce((s, p) => s + (p.margin || 0), 0),
    getOpenPositions: () => usePaperStore.getState().positions.length,
    getFills: () => usePaperStore.getState().fills,
    placeOrder: (args: {
      symbol: string
      side: 'long' | 'short'
      qty: number
      leverage: number
      markPrice: number
      takeProfitPct?: number | null
      stopLossPct?: number | null
    }) => {
      const mark = args.markPrice
      const tp =
        args.takeProfitPct != null && args.takeProfitPct > 0
          ? args.side === 'long'
            ? mark * (1 + args.takeProfitPct / 100)
            : mark * (1 - args.takeProfitPct / 100)
          : null
      const sl =
        args.stopLossPct != null && args.stopLossPct > 0
          ? args.side === 'long'
            ? mark * (1 - args.stopLossPct / 100)
            : mark * (1 + args.stopLossPct / 100)
          : null
      usePaperStore.getState().placeOrder({
        symbol: args.symbol,
        side: args.side,
        type: 'market',
        qty: args.qty,
        leverage: args.leverage,
        markPrice: mark,
        takeProfit: tp,
        stopLoss: sl,
      })
    },
    closeSide: (symbol: string, side: 'long' | 'short', price: number) => {
      usePaperStore.getState().closeSide(symbol, side, price)
    },
    markToMarket: (symbol: string, price: number) => {
      usePaperStore.getState().markToMarket(symbol, price)
    },
    checkExits: (symbol: string, price: number) => {
      usePaperStore.getState().checkExits(symbol, price)
    },
    getSentiment: () => sentimentRef.current,
  }
}

export function useBotRunner() {
  const sentiment = useMarketSentiment()
  const sentimentRef = useRef(sentiment)
  sentimentRef.current = sentiment

  const enabledBotIds = useBotStore((s) =>
    s.bots
      .filter((b) => b.enabled)
      .map((b) => b.id)
      .sort()
      .join(',')
  )

  const candleCloseTime = useMarketStore((s) => {
    const c = s.candles
    return c.length ? c[c.length - 1]!.time : 0
  })
  const lastPrice = useMarketStore((s) => {
    if (s.ticker?.last != null) return s.ticker.last
    const c = s.candles
    return c.length ? c[c.length - 1]!.close : null
  })

  const schedulerRef = useRef<BotScheduler | null>(null)

  useEffect(() => {
    if (!enabledBotIds) {
      schedulerRef.current?.stop()
      schedulerRef.current = null
      return
    }

    if (!schedulerRef.current) {
      schedulerRef.current = new BotScheduler(buildDeps(sentimentRef), {
        tickMs: 5_000,
        cooldownMs: BOT_HARD_COOLDOWN_MS,
      })
      schedulerRef.current.start()
    }
  }, [enabledBotIds])

  useEffect(() => {
    return () => {
      schedulerRef.current?.stop()
      schedulerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabledBotIds || !schedulerRef.current) return
    void schedulerRef.current.forceTick()
  }, [enabledBotIds, candleCloseTime, lastPrice])
}
