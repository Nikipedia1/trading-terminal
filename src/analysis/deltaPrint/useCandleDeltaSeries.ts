/**
 * Delta histogram + optional CVD line + divergence + absorption markers.
 * All values from shared trade buffer (real ticks only).
 */

import { useEffect, useRef } from 'react'
import type { SeriesManager } from '@/charts/series-manager'
import type { Candle, ExchangeId, Interval } from '@/types'
import { retainTradeBuffer } from '@/analysis/deepPrint/tradeBuffer'
import { computeCandleDeltas } from '@/analysis/deepPrint/aggregate'
import { detectDivergences } from './divergence'
import { detectAbsorptionAggression } from './absorption'
import type { DeltaPrintConfig } from './types'
import { DEFAULT_DELTA_CONFIG } from './types'

export function useCandleDeltaSeries(
  enabled: boolean,
  seriesMgr: SeriesManager | null,
  exchange: ExchangeId,
  symbol: string,
  interval: Interval,
  candles: Candle[],
  config: DeltaPrintConfig = DEFAULT_DELTA_CONFIG
) {
  const timesKeyRef = useRef('')

  useEffect(() => {
    if (!enabled) {
      seriesMgr?.clearDelta()
      seriesMgr?.clearCvd()
      seriesMgr?.clearCandleMarkers()
      return
    }
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol, seriesMgr])

  useEffect(() => {
    if (!enabled || !seriesMgr || candles.length === 0) return

    const refresh = () => {
      const slice = candles.slice(-120)
      const times = slice.map((c) => c.time)
      const bars = computeCandleDeltas(exchange, symbol, times, interval)

      const maxAbs = Math.max(...bars.map((b) => Math.abs(b.delta)), 0.0001)
      const thresh =
        config.minBarPct > 0 ? maxAbs * (config.minBarPct / 100) : 0
      const filtered =
        thresh > 0
          ? bars.map((b) =>
              Math.abs(b.delta) < thresh ? { ...b, delta: 0 } : b
            )
          : bars

      seriesMgr.setDeltaBars(filtered)

      if (config.cvd) {
        let acc = 0
        const cvd = bars.map((b) => {
          acc += b.delta
          return { time: b.time, value: acc }
        })
        seriesMgr.setCvdLine(cvd)
      } else {
        seriesMgr.clearCvd()
      }

      // Combined markers: absorption + divergence (SeriesManager merges)
      const absMarks = config.absorption
        ? detectAbsorptionAggression(slice, bars)
        : []
      const divMarks = config.divergence
        ? detectDivergences(slice, bars)
        : []
      seriesMgr.setCandleAnnotationMarkers(absMarks, divMarks)
    }

    const key = `${candles[0]?.time}|${candles.length}|${candles[candles.length - 1]?.time}|${config.cvd}|${config.divergence}|${config.absorption}|${config.minBarPct}`
    if (key !== timesKeyRef.current) {
      timesKeyRef.current = key
      refresh()
    }

    const id = window.setInterval(refresh, 1000)
    return () => window.clearInterval(id)
  }, [enabled, seriesMgr, exchange, symbol, interval, candles, config])
}
