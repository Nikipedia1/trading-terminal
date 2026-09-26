/**
 * ChartContainer – single chart pane with real Binance data.
 * Handles create/destroy, ResizeObserver, data sync and coordinate-bridge attachment.
 */

import { useEffect, useRef } from 'react'
import { createChart, type IChartApi, ColorType } from 'lightweight-charts'
import { useMarketStore } from '@/stores/marketStore'
import { SeriesManager } from './series-manager'
import { coordinateBridge } from './coordinate-bridge'

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
    mode: 1, // Normal
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

export function ChartContainer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesMgrRef = useRef<SeriesManager | null>(null)

  const candles = useMarketStore((s) => s.candles)
  const status = useMarketStore((s) => s.status)
  const lastError = useMarketStore((s) => s.lastError)

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

    // Attach coordinate bridge to the primary series
    const candleSeries = seriesMgr.getCandleSeries()
    if (candleSeries) {
      coordinateBridge.attach(chart, candleSeries)
    }

    chartRef.current = chart
    seriesMgrRef.current = seriesMgr

    // ResizeObserver – keeps chart sized and forces coordinate recalculation
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      coordinateBridge.detach()
      seriesMgr.detach()
      chart.remove()
      chartRef.current = null
      seriesMgrRef.current = null
    }
  }, [])

  // ── Sync historical / full replace ──────────────────────────────────────
  useEffect(() => {
    if (!seriesMgrRef.current || candles.length === 0) return
    seriesMgrRef.current.setCandles(candles)
    // Fit content only on first meaningful load
    chartRef.current?.timeScale().fitContent()
  }, [candles.length > 0 && candles[0]?.time]) // trigger only when history is replaced

  // ── Live incremental update (last candle) ───────────────────────────────
  useEffect(() => {
    if (!seriesMgrRef.current || candles.length === 0) return
    const last = candles[candles.length - 1]
    seriesMgrRef.current.updateCandle(last)
  }, [candles])

  return (
    <div className="relative w-full h-full bg-terminal-panel">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Explicit error overlay – never show fake data */}
      {lastError && (
        <div className="absolute inset-0 flex items-center justify-center bg-terminal-bg/80 z-10">
          <div className="bg-terminal-red/10 border border-terminal-red/50 text-terminal-red px-6 py-4 rounded text-sm max-w-md text-center">
            <div className="font-semibold mb-1">[{lastError.code}] Data Error</div>
            <div className="text-xs opacity-90">{lastError.message}</div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {status === 'connecting' && candles.length === 0 && !lastError && (
        <div className="absolute inset-0 flex items-center justify-center text-terminal-muted text-sm z-10">
          Connecting to Binance…
        </div>
      )}
    </div>
  )
}
