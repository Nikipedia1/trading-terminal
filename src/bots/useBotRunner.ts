/**
 * React adapter – wires store deps into BotScheduler (non-React engine).
 */

import { useEffect, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { usePaperStore, positionUnrealizedPnl } from '@/trading/paper'
import { BotScheduler, realizedDayPnlFromFills } from './scheduler'
import { computeSentiment, fetchFearGreed, type SentimentSnapshot } from './sentiment'
import { useBotStore } from './botStore'

export { realizedDayPnlFromFills }

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
  const sentiment = useMarketSentiment()
  const sentimentRef = useRef(sentiment)
  sentimentRef.current = sentiment

  const hasEnabled = useBotStore((s) => s.bots.some((b) => b.enabled))

  useEffect(() => {
    if (!hasEnabled) return

    const scheduler = new BotScheduler({
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
      placeOrder: (args) => {
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
      closeSide: (symbol, side, price) => {
        usePaperStore.getState().closeSide(symbol, side, price)
      },
      markToMarket: (symbol, price) => {
        usePaperStore.getState().markToMarket(symbol, price)
      },
      checkExits: (symbol, price) => {
        usePaperStore.getState().checkExits(symbol, price)
      },
      getSentiment: () => sentimentRef.current,
    })

    scheduler.start()
    return () => scheduler.stop()
  }, [hasEnabled])
}
