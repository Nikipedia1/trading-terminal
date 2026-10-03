/**
 * Publishes primary chart visible range + crosshair to chartViewportStore.
 * Mounted only on the primary ChartContainer for live 3D Pro sync.
 */

import { useEffect } from 'react'
import type { IChartApi, Time } from 'lightweight-charts'
import type { Interval } from '@/types'
import { useChartViewportStore } from '@/stores/chartViewportStore'

interface Props {
  chart: IChartApi
  panelId: string
  symbol: string
  interval: Interval
}

export function ChartViewportBridge({ chart, panelId, symbol, interval }: Props) {
  useEffect(() => {
    const setViewport = useChartViewportStore.getState().setViewport
    const setCrosshair = useChartViewportStore.getState().setCrosshair
    const clearCrosshair = useChartViewportStore.getState().clearCrosshair

    setViewport({ panelId, symbol, interval })

    const publishRange = () => {
      try {
        const range = chart.timeScale().getVisibleRange()
        if (
          range &&
          typeof range.from === 'number' &&
          typeof range.to === 'number'
        ) {
          setViewport({
            panelId,
            symbol,
            interval,
            fromSec: range.from as number,
            toSec: range.to as number,
          })
        }
      } catch {
        /* chart may be disposing */
      }
    }

    publishRange()
    chart.timeScale().subscribeVisibleTimeRangeChange(publishRange)

    const onCross = (param: {
      time?: Time
      point?: { x: number; y: number } | undefined
      seriesData?: Map<unknown, unknown>
    }) => {
      if (!param || param.time == null || !param.point) {
        clearCrosshair()
        return
      }
      const t = typeof param.time === 'number' ? param.time : null
      let price: number | null = null
      try {
        const data = param.seriesData
        if (data) {
          for (const v of data.values()) {
            const row = v as { close?: number; value?: number } | undefined
            if (row && typeof row.close === 'number') {
              price = row.close
              break
            }
            if (row && typeof row.value === 'number') {
              price = row.value
              break
            }
          }
        }
      } catch {
        /* */
      }
      if (t != null) setCrosshair(t, price)
      else clearCrosshair()
    }

    chart.subscribeCrosshairMove(onCross)

    return () => {
      try {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(publishRange)
      } catch {
        /* */
      }
      try {
        chart.unsubscribeCrosshairMove(onCross)
      } catch {
        /* */
      }
    }
  }, [chart, panelId, symbol, interval])

  return null
}
