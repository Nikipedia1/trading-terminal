/**
 * Keeps a Lightweight Charts histogram series in sync with candle-level delta.
 * Delta = sum(buy qty − sell qty) from shared trade buffer (real ticks only).
 */

import { useEffect, useRef } from 'react'
import type { SeriesManager } from '@/charts/series-manager'
import type { Candle, ExchangeId, Interval } from '@/types'
import { retainTradeBuffer } from '@/analysis/deepPrint/tradeBuffer'
import { computeCandleDeltas } from '@/analysis/deepPrint/aggregate'

export function useCandleDeltaSeries(
  enabled: boolean,
  seriesMgr: SeriesManager | null,
  exchange: ExchangeId,
  symbol: string,
  interval: Interval,
  candles: Candle[]
) {
  const timesKeyRef = useRef('')

  useEffect(() => {
    if (!enabled) {
      seriesMgr?.clearDelta()
      return
    }
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol, seriesMgr])

  useEffect(() => {
    if (!enabled || !seriesMgr || candles.length === 0) return

    const refresh = () => {
      // Focus on recent bars for performance (buffer is live-only)
      const slice = candles.slice(-120)
      const times = slice.map((c) => c.time)
      const bars = computeCandleDeltas(exchange, symbol, times, interval)
      seriesMgr.setDeltaBars(bars)
    }

    const key = `${candles[0]?.time}|${candles.length}|${candles[candles.length - 1]?.time}`
    if (key !== timesKeyRef.current) {
      timesKeyRef.current = key
      refresh()
    }

    const id = window.setInterval(refresh, 1000)
    return () => window.clearInterval(id)
  }, [enabled, seriesMgr, exchange, symbol, interval, candles])
}
