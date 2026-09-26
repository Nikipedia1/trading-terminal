/**
 * ChartContainer – single chart pane with real exchange data.
 * Owns its CoordinateBridge instance (anti-pellicola).
 * ResizeObserver → chart.applyOptions → all coordinate APIs stay valid.
 * Optional syncGroup for crosshair + visible time range.
 * Hosts DrawingLayer overlay (logical coords only).
 */

import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts'
import type { Candle, ConnectionStatus, MarketError } from '@/types'
import { SeriesManager } from './series-manager'
import { CoordinateBridge } from './coordinate-bridge'
import { publishSync, subscribeSyncGroup, type SyncPayload } from '@/stores/layoutStore'
import { DrawingLayer } from '@/drawings/DrawingLayer'

const CHART_OPTIONS = {
  layout: {
    background: { type: ColorType.Solid, color: '#12161c' },
    textColor: '#848e9c',
  },
  grid: {
    vertLines: { color: '#1e2329' },
    horzLines: { color: '#1e2329' },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: '#848e9c', width: 1 as const, style: 2, labelBackgroundColor: '#1e2329' },
    horzLine: { color: '#848e9c', width: 1 as const, style: 2, labelBackgroundColor: '#1e2329' },
  },
  rightPriceScale: {
    borderColor: '#1e2329',
    scaleMargins: { top: 0.05, bottom: 0.25 },
  },
  timeScale: {
    borderColor: '#1e2329',
    timeVisible: true,
    secondsVisible: false,
  },
  handleScroll: { vertTouchDrag: true },
}

export interface ChartContainerProps {
  panelId: string
  symbol: string
  candles: Candle[]
  status: ConnectionStatus
  lastError: MarketError | null
  /** When set, this panel joins the named sync group */
  syncGroup?: string | null
}

export function ChartContainer({
  panelId,
  symbol,
  candles,
  status,
  lastError,
  syncGroup = null,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesMgrRef = useRef<SeriesManager | null>(null)
  const bridgeRef = useRef<CoordinateBridge | null>(null)
  const [bridge, setBridge] = useState<CoordinateBridge | null>(null)
  const lastHistoryKeyRef = useRef<string>('')
  const applyingRemoteRef = useRef(false)

  // ── Create chart once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    const seriesMgr = new SeriesManager()
    seriesMgr.attach(chart)

    const bridgeInstance = new CoordinateBridge()
    const candleSeries = seriesMgr.getCandleSeries()
    if (candleSeries) {
      bridgeInstance.attach(chart, candleSeries)
    }

    chartRef.current = chart
    seriesMgrRef.current = seriesMgr
    bridgeRef.current = bridgeInstance
    setBridge(bridgeInstance)

    // Resize → applyOptions → Lightweight Charts recalculates all coordinates
    // DrawingLayer listens to the same resize and re-queries the bridge
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      bridgeInstance.detach()
      seriesMgr.detach()
      chart.remove()
      chartRef.current = null
      seriesMgrRef.current = null
      bridgeRef.current = null
      setBridge(null)
    }
  }, [])

  // ── Data sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesMgrRef.current || candles.length === 0) return

    const historyKey = `${candles[0].time}|${candles.length}|${candles[candles.length - 1]?.time}`
    if (historyKey !== lastHistoryKeyRef.current) {
      lastHistoryKeyRef.current = historyKey
      seriesMgrRef.current.setCandles(candles)
      chartRef.current?.timeScale().fitContent()
    } else {
      const last = candles[candles.length - 1]
      seriesMgrRef.current.updateCandle(last)
    }
  }, [candles])

  // ── Optional sync group: publish + subscribe time range & crosshair ─────
  useEffect(() => {
    if (!syncGroup || !chartRef.current) return

    const chart = chartRef.current
    const candleSeries = seriesMgrRef.current?.getCandleSeries() as
      | ISeriesApi<'Candlestick'>
      | null

    const onRange = () => {
      if (applyingRemoteRef.current) return
      const range = chart.timeScale().getVisibleRange()
      if (range && typeof range.from === 'number' && typeof range.to === 'number') {
        publishSync(syncGroup, panelId, {
          type: 'timeRange',
          from: range.from as number,
          to: range.to as number,
        })
      }
    }
    chart.timeScale().subscribeVisibleTimeRangeChange(onRange)

    const onCrosshair = (param: any) => {
      if (applyingRemoteRef.current) return
      if (!param || param.time === undefined) {
        publishSync(syncGroup, panelId, { type: 'crosshair', time: null, price: null })
        return
      }
      const time = typeof param.time === 'number' ? param.time : null
      let price: number | null = null
      if (candleSeries && param.seriesData) {
        const d = param.seriesData.get(candleSeries)
        if (d && 'close' in d) price = d.close as number
      }
      publishSync(syncGroup, panelId, { type: 'crosshair', time, price })
    }
    chart.subscribeCrosshairMove(onCrosshair)

    const unsub = subscribeSyncGroup(syncGroup, (sourceId, payload: SyncPayload) => {
      if (sourceId === panelId) return
      const c = chartRef.current
      if (!c) return

      applyingRemoteRef.current = true
      try {
        if (payload.type === 'timeRange') {
          c.timeScale().setVisibleRange({
            from: payload.from as Time,
            to: payload.to as Time,
          })
        }
      } catch {
        /* ignore invalid ranges */
      } finally {
        requestAnimationFrame(() => {
          applyingRemoteRef.current = false
        })
      }
    })

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRange)
      chart.unsubscribeCrosshairMove(onCrosshair)
      unsub()
    }
  }, [syncGroup, panelId])

  return (
    <div className="relative w-full h-full bg-terminal-panel">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Drawing overlay – logical coords only, redraws via bridge */}
      <DrawingLayer
        panelId={panelId}
        symbol={symbol}
        bridge={bridge}
        containerRef={containerRef}
      />

      {lastError && (
        <div className="absolute inset-0 flex items-center justify-center bg-terminal-bg/80 z-10">
          <div className="bg-terminal-red/10 border border-terminal-red/50 text-terminal-red px-6 py-4 rounded text-sm max-w-md text-center">
            <div className="font-semibold mb-1">[{lastError.code}] Data Error</div>
            <div className="text-xs opacity-90">{lastError.message}</div>
          </div>
        </div>
      )}

      {status === 'connecting' && candles.length === 0 && !lastError && (
        <div className="absolute inset-0 flex items-center justify-center text-terminal-muted text-sm z-10">
          Connecting…
        </div>
      )}
    </div>
  )
}
