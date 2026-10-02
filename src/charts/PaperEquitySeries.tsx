/**
 * Paper equity as Area series from real paper fills (realized PnL) + initial balance.
 */

import { useEffect, useRef } from 'react'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { usePaperStore } from '@/trading/paper/paperStore'

export function PaperEquitySeries({
  chart,
  symbol,
  enabled = true,
}: {
  chart: IChartApi | null
  symbol: string
  enabled?: boolean
}) {
  void symbol
  const fills = usePaperStore((s) => s.fills)
  const account = usePaperStore((s) => s.account)
  const areaRef = useRef<ISeriesApi<'Area'> | null>(null)

  useEffect(() => {
    if (!chart || !enabled) {
      if (areaRef.current) {
        try {
          chart?.removeSeries(areaRef.current)
        } catch {
          /* */
        }
        areaRef.current = null
      }
      return
    }

    if (!areaRef.current) {
      areaRef.current = chart.addAreaSeries({
        lineColor: 'rgba(240, 185, 11, 0.9)',
        topColor: 'rgba(240, 185, 11, 0.25)',
        bottomColor: 'rgba(240, 185, 11, 0.02)',
        lineWidth: 2,
        priceScaleId: 'equity',
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      })
      chart.priceScale('equity').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0.02 },
        visible: false,
      })
    }

    const initial = account.initialBalance ?? 10_000
    const ordered = [...fills].sort((a, b) => a.time - b.time)
    let eq = initial
    const points: { time: Time; value: number }[] = []
    if (ordered.length > 0) {
      points.push({
        time: (Math.floor(ordered[0].time / 1000) - 60) as Time,
        value: initial,
      })
    }
    for (const f of ordered) {
      eq += f.realizedPnl - (f.fee ?? 0)
      points.push({
        time: Math.floor(f.time / 1000) as Time,
        value: eq,
      })
    }
    if (points.length === 0) {
      areaRef.current.setData([])
    } else {
      const map = new Map<number, number>()
      for (const pt of points) map.set(pt.time as number, pt.value)
      areaRef.current.setData(
        [...map.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([time, value]) => ({ time: time as Time, value }))
      )
    }
  }, [chart, fills, account.initialBalance, enabled])

  useEffect(() => {
    return () => {
      if (chart && areaRef.current) {
        try {
          chart.removeSeries(areaRef.current)
        } catch {
          /* */
        }
      }
      areaRef.current = null
    }
  }, [chart])

  return null
}
