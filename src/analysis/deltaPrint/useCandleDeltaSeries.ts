/**
 * Delta histogram + optional CVD line + divergence + absorption markers.
 * All values from shared trade buffer (real ticks only).
 */

import { useEffect, useRef } from 'react'
import type { SeriesMarker, Time } from 'lightweight-charts'
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
  const cfg = { ...DEFAULT_DELTA_CONFIG, ...config }

  useEffect(() => {
    if (!enabled) {
      try {
        seriesMgr?.clearDelta()
        seriesMgr?.clearCvd()
        seriesMgr?.clearCandleMarkers()
      } catch {
        /* */
      }
      return
    }
    return retainTradeBuffer(exchange, symbol)
  }, [enabled, exchange, symbol, seriesMgr])

  useEffect(() => {
    if (!enabled || !seriesMgr || candles.length === 0) return

    const refresh = () => {
      try {
        const slice = candles.slice(-120)
        const times = slice.map((c) => c.time)
        const bars = computeCandleDeltas(exchange, symbol, times, interval)

        const maxAbs = Math.max(...bars.map((b) => Math.abs(b.delta)), 0.0001)
        const thresh =
          cfg.minBarPct > 0 ? maxAbs * (cfg.minBarPct / 100) : 0
        const filtered =
          thresh > 0
            ? bars.map((b) =>
                Math.abs(b.delta) < thresh ? { ...b, delta: 0 } : b
              )
            : bars

        seriesMgr.setDeltaBars(filtered)

        if (cfg.cvd) {
          let acc = 0
          const cvd = bars.map((b) => {
            acc += b.delta
            return { time: b.time, value: acc }
          })
          seriesMgr.setCvd(cvd)
        } else {
          seriesMgr.clearCvd()
        }

        const markers: SeriesMarker<Time>[] = []

        if (cfg.absorption) {
          for (const m of detectAbsorptionAggression(slice, bars)) {
            const bull =
              m.kind === 'aggression_buy' || m.kind === 'absorption_buy'
            markers.push({
              time: m.time as Time,
              position: bull ? 'belowBar' : 'aboveBar',
              color: bull ? '#0ecb81' : '#f6465d',
              shape: m.kind.startsWith('absorption') ? 'square' : 'circle',
              text:
                m.kind === 'aggression_buy'
                  ? 'Agg↑'
                  : m.kind === 'aggression_sell'
                    ? 'Agg↓'
                    : m.kind === 'absorption_buy'
                      ? 'Abs↑'
                      : 'Abs↓',
            })
          }
        }

        if (cfg.divergence) {
          for (const m of detectDivergences(slice, bars)) {
            markers.push({
              time: m.time as Time,
              position: m.kind === 'bearish' ? 'aboveBar' : 'belowBar',
              color: m.kind === 'bearish' ? '#f6465d' : '#0ecb81',
              shape: m.kind === 'bearish' ? 'arrowDown' : 'arrowUp',
              text: m.kind === 'bearish' ? 'Δ↓' : 'Δ↑',
            })
          }
        }

        seriesMgr.setCandleMarkers(markers)
      } catch (e) {
        console.warn('[deltaPrint] refresh failed', e)
      }
    }

    const key = `${candles[0]?.time}|${candles.length}|${candles[candles.length - 1]?.time}|${cfg.cvd}|${cfg.divergence}|${cfg.absorption}|${cfg.minBarPct}`
    if (key !== timesKeyRef.current) {
      timesKeyRef.current = key
      refresh()
    }

    const id = window.setInterval(refresh, 1000)
    return () => window.clearInterval(id)
  }, [
    enabled,
    seriesMgr,
    exchange,
    symbol,
    interval,
    candles,
    cfg.cvd,
    cfg.divergence,
    cfg.absorption,
    cfg.minBarPct,
  ])
}
