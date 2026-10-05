/**
 * ChartContainer – price chart on top; oscillator panes stacked below.
 */

import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts'
import type { Candle, Interval, ExchangeId, ConnectionStatus, MarketError } from '@/types'
import { SeriesManager } from './series-manager'
import { createCoordinateBridge, type CoordinateBridge } from './coordinate-bridge'
import { IndicatorPanes } from './IndicatorPanes'
import { ChartViewportBridge } from './ChartViewportBridge'
import { useChartStyleStore } from '@/stores/chartStyleStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { publishSync, subscribeSyncGroup } from '@/stores/layoutStore'
import {
  GammaOverlay,
  type GammaConfig,
  DEFAULT_GAMMA_CONFIG,
} from '@/analysis/gamma'
import { DeepPrintOverlay } from '@/analysis/deepPrint'
import {
  DeepTradesOverlay,
  type DeepTradesConfig,
  DEFAULT_DEEP_TRADES_CONFIG,
} from '@/analysis/deepTrades'
import {
  VolumeProfileOverlay,
  type ProfileConfig,
  DEFAULT_PROFILE_CONFIG,
} from '@/analysis/volumeProfile'
import {
  DeepDomOverlay,
  DomLadder,
  type DeepDomConfig,
  DEFAULT_DEEP_DOM_CONFIG,
} from '@/analysis/deepDom'
import {
  FootprintOverlay,
  type FootprintConfig,
  DEFAULT_FOOTPRINT_CONFIG,
} from '@/analysis/footprint'
import { CycleOverlay, type CycleConfig } from '@/analysis/cycles'
import { DrawingLayer } from '@/drawings/DrawingLayer'
import { PaperPositionLines } from '@/trading/paper/PaperPositionLines'
import { PaperEquitySeries } from '@/trading/paper/PaperEquitySeries'
import { MacroEventLines } from '@/macro/MacroEventLines'
import { ReplayBar } from '@/analysis/replay'
import { NativeLwcLines } from './NativeLwcLines'
import { DeltaPrintOverlay } from '@/analysis/deltaPrint/DeltaPrintOverlay'
import type { DeltaPrintConfig } from '@/analysis/deltaPrint'

interface ChartContainerProps {
  panelId: string
  symbol: string
  exchange: ExchangeId
  interval: Interval
  candles: Candle[]
  status: ConnectionStatus
  lastError: MarketError | null
  syncGroup?: string | null
  deepPrintEnabled?: boolean
  deltaEnabled?: boolean
  deltaConfig?: DeltaPrintConfig
  profileEnabled?: boolean
  profileConfig?: ProfileConfig
  deepTradesEnabled?: boolean
  deepTradesConfig?: DeepTradesConfig
  deepDomEnabled?: boolean
  deepDomConfig?: DeepDomConfig
  footprintEnabled?: boolean
  footprintConfig?: FootprintConfig
  gammaEnabled?: boolean
  gammaConfig?: GammaConfig
  replayEnabled?: boolean
  cycleEnabled?: boolean
  cycleConfig?: CycleConfig
  isPrimary?: boolean
  onLoadMoreHistory?: () => void
  hasMoreHistory?: boolean
  loadingMore?: boolean
}

export function ChartContainer({
  panelId,
  symbol,
  exchange,
  interval,
  candles,
  status,
  lastError,
  syncGroup,
  deepPrintEnabled = false,
  deltaEnabled = false,
  deltaConfig,
  profileEnabled = false,
  profileConfig = DEFAULT_PROFILE_CONFIG,
  deepTradesEnabled = false,
  deepTradesConfig = DEFAULT_DEEP_TRADES_CONFIG,
  deepDomEnabled = false,
  deepDomConfig = DEFAULT_DEEP_DOM_CONFIG,
  footprintEnabled = false,
  footprintConfig = DEFAULT_FOOTPRINT_CONFIG,
  gammaEnabled = false,
  gammaConfig = DEFAULT_GAMMA_CONFIG,
  replayEnabled = false,
  cycleEnabled = false,
  cycleConfig,
  isPrimary = false,
  onLoadMoreHistory,
  hasMoreHistory = false,
  loadingMore = false,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const seriesMgrRef = useRef<SeriesManager | null>(null)
  const bridgeRef = useRef<CoordinateBridge | null>(null)
  const [bridge, setBridge] = useState<CoordinateBridge | null>(null)
  const [mainChart, setMainChart] = useState<IChartApi | null>(null)
  const [candleSeries, setCandleSeries] = useState<ISeriesApi<'Candlestick'> | null>(null)
  const style = useChartStyleStore((s) => s)
  const indicatorParams = useIndicatorStore((s) => s.params)
  const applyingRemote = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: style.bg || '#0b0e11' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: '#1e2329' },
        horzLines: { color: '#1e2329' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2b3139' },
      timeScale: { borderColor: '#2b3139', timeVisible: true, secondsVisible: false },
      width: el.clientWidth,
      height: el.clientHeight,
    })

    const series = chart.addCandlestickSeries({
      upColor: style.upColor || '#0ecb81',
      downColor: style.downColor || '#f6465d',
      borderVisible: false,
      wickUpColor: style.upColor || '#0ecb81',
      wickDownColor: style.downColor || '#f6465d',
    })

    chartRef.current = chart
    seriesRef.current = series
    setMainChart(chart)
    setCandleSeries(series)

    const mgr = new SeriesManager()
    mgr.attach(chart, series)
    seriesMgrRef.current = mgr

    const br = createCoordinateBridge(chart, series)
    bridgeRef.current = br
    setBridge(br)

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      mgr.destroy()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      seriesMgrRef.current = null
      bridgeRef.current = null
      setBridge(null)
      setMainChart(null)
      setCandleSeries(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: style.bg || '#0b0e11' },
        textColor: '#848e9c',
      },
    })
    series.applyOptions({
      upColor: style.upColor || '#0ecb81',
      downColor: style.downColor || '#f6465d',
      wickUpColor: style.upColor || '#0ecb81',
      wickDownColor: style.downColor || '#f6465d',
    })
  }, [style.bg, style.upColor, style.downColor])

  useEffect(() => {
    const mgr = seriesMgrRef.current
    if (!mgr) return
    const data: CandlestickData[] = (candles ?? []).map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    mgr.setCandles(data)
  }, [candles])

  useEffect(() => {
    if (!syncGroup || !chartRef.current) return
    const chart = chartRef.current
    const unsub = subscribeSyncGroup(
      syncGroup,
      (payload, sourceId) => {
        if (sourceId === panelId) return
        applyingRemote.current = true
        try {
          if (payload.logicalRange) {
            chart.timeScale().setVisibleLogicalRange(payload.logicalRange as any)
          } else if (payload.timeRange) {
            chart.timeScale().setVisibleRange(payload.timeRange as any)
          }
        } catch {
          /* range may be invalid during load */
        }
        applyingRemote.current = false
      },
      panelId
    )
    const onRange = () => {
      if (applyingRemote.current) return
      try {
        const logicalRange = chart.timeScale().getVisibleLogicalRange()
        if (logicalRange) {
          publishSync(syncGroup, panelId, { logicalRange: logicalRange as any })
        }
      } catch {
        /* */
      }
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)
    return () => {
      unsub()
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
      } catch {
        /* */
      }
    }
  }, [syncGroup, panelId])

  return (
    <div className="h-full w-full flex flex-col min-h-0 relative">
      <div className="flex-1 min-h-0 relative" ref={containerRef}>
        {isPrimary && mainChart && (
          <ChartViewportBridge chart={mainChart} panelId={panelId} symbol={symbol} interval={interval} />
        )}
        <DeepPrintOverlay
          enabled={deepPrintEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          interval={interval}
          candles={candles}
        />
        <DeltaPrintOverlay
          enabled={deltaEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          interval={interval}
          candles={candles}
          config={deltaConfig}
        />
        <GammaOverlay
          enabled={gammaEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          config={gammaConfig}
        />
        <VolumeProfileOverlay
          enabled={profileEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          config={profileConfig}
        />
        <DeepTradesOverlay
          enabled={deepTradesEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          config={deepTradesConfig}
        />
        <DeepDomOverlay
          enabled={deepDomEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          config={deepDomConfig}
        />
        <FootprintOverlay
          enabled={footprintEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          interval={interval}
          candles={candles}
          config={footprintConfig}
        />
        <DrawingLayer
          panelId={panelId}
          symbol={symbol}
          bridge={bridge}
          containerRef={containerRef}
          passThrough={deepPrintEnabled}
        />
        <PaperPositionLines
          enabled={false}
          bridge={bridge}
          containerRef={containerRef}
          symbol={symbol}
        />
        <MacroEventLines enabled bridge={bridge} containerRef={containerRef} />
        <DomLadder enabled={deepDomEnabled} exchange={exchange} symbol={symbol} />
        <ReplayBar enabled={replayEnabled} exchange={exchange} symbol={symbol} />
        <PaperEquitySeries chart={mainChart} symbol={symbol} enabled />
        <NativeLwcLines
          series={candleSeries}
          symbol={symbol}
          exchange={exchange}
          enabled
        />
        {cycleEnabled && cycleConfig && (
          <CycleOverlay
            enabled={cycleEnabled}
            bridge={bridge}
            containerRef={containerRef}
            candles={candles}
            config={cycleConfig}
          />
        )}
        {status === 'connecting' && (candles?.length ?? 0) === 0 && !lastError && (
          <div className="absolute inset-0 flex items-center justify-center text-[#848e9c] text-xs pointer-events-none">
            Connecting…
          </div>
        )}
        {loadingMore && (
          <div className="absolute bottom-2 left-2 text-[10px] text-[#5e6673] pointer-events-none">
            Loading older bars… · {(candles?.length ?? 0).toLocaleString()} loaded
          </div>
        )}
        {!hasMoreHistory && (candles?.length ?? 0) > 500 && !loadingMore && (
          <div className="absolute bottom-2 left-2 text-[10px] text-[#5e6673] pointer-events-none">
            History limit · {(candles?.length ?? 0).toLocaleString()} bars
          </div>
        )}
        {lastError && (
          <div className="absolute top-2 left-2 right-2 text-[10px] text-[#f6465d] bg-[#1a0b0d]/90 border border-[#f6465d]/30 rounded px-2 py-1">
            {lastError.message || String(lastError)}
          </div>
        )}
      </div>
      <IndicatorPanes mainChart={mainChart} candles={candles} params={indicatorParams} />
    </div>
  )
}
