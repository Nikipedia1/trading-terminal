/**
 * ChartContainer – price chart on top; oscillator panes stacked below.
 */

import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
} from 'lightweight-charts'
import type { Candle, ConnectionStatus, MarketError, ExchangeId, Interval } from '@/types'
import { SeriesManager } from './series-manager'
import { IndicatorSeriesManager } from './indicator-series'
import { IndicatorPanes } from './IndicatorPanes'
import { IndicatorValuesHud } from './IndicatorValuesHud'
import { CoordinateBridge } from './coordinate-bridge'
import { attachFreePan, unlockPriceScale } from './free-pan'
import {
  publishSync,
  subscribeSyncGroup,
  setSyncHighlight,
  type SyncPayload,
} from '@/stores/layoutStore'
import { useChartStyleStore } from '@/stores/chartStyleStore'
import { useChartFocusStore } from '@/stores/chartFocusStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useDrawingStore } from '@/drawings/drawingStore'
import { DrawingLayer } from '@/drawings/DrawingLayer'
import { ChartStylePanel } from './ChartStylePanel'
import { LivePriceBadge } from './LivePriceBadge'
import { NativeLwcLines } from './NativeLwcLines'
import { PaperEquitySeries } from './PaperEquitySeries'
import {
  GammaOverlay,
  DEFAULT_GAMMA_CONFIG,
  type GammaConfig,
} from '@/analysis/gamma'
import { DeepPrintOverlay } from '@/analysis/deepPrint'
import {
  useCandleDeltaSeries,
  type DeltaPrintConfig,
  DEFAULT_DELTA_CONFIG,
} from '@/analysis/deltaPrint'
import {
  VolumeProfileOverlay,
  RangeDiscoveryBadge,
  type ProfileConfig,
  DEFAULT_PROFILE_CONFIG,
} from '@/analysis/volumeProfile'
import {
  DeepTradesOverlay,
  type DeepTradesConfig,
  DEFAULT_DEEP_TRADES_CONFIG,
} from '@/analysis/deepTrades'
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
import { ReplayBar } from '@/analysis/replay'
import { CycleOverlay, DEFAULT_CYCLE_CONFIG, type CycleConfig } from '@/analysis/cycles'
import { PaperPositionLines } from '@/trading/paper'
import { LOAD_MORE_THRESHOLD } from '@/data/klines/history'

function intervalToSeconds(interval: Interval): number {
  const m: Record<string, number> = {
    '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
    '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800,
    '12h': 43200, '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
  }
  return m[interval] ?? 60
}

function buildChartOptions(canvas: {
  background: string; text: string; grid: string; border: string
}) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: canvas.background },
      textColor: canvas.text,
    },
    grid: {
      vertLines: { color: canvas.grid },
      horzLines: { color: canvas.grid },
    },
    crosshair: {
      mode: CrosshairMode.Magnet,
      vertLine: { color: canvas.text, width: 1 as const, style: 2, labelBackgroundColor: canvas.border },
      horzLine: { color: canvas.text, width: 1 as const, style: 2, labelBackgroundColor: canvas.border },
    },
    rightPriceScale: {
      borderColor: canvas.border,
      scaleMargins: { top: 0.1, bottom: 0.2 },
    },
    timeScale: {
      borderColor: canvas.border,
      timeVisible: true,
      secondsVisible: false,
    },
    handleScroll: { vertTouchDrag: true },
    handleScale: { axisPressedMouseMove: true },
  }
}

interface ChartContainerProps {
  panelId: string
  symbol: string
  exchange: ExchangeId
  interval: Interval
  candles: Candle[]
  status: ConnectionStatus
  lastError: MarketError | null
  syncGroup: string | null
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
  deltaConfig = DEFAULT_DELTA_CONFIG,
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
  cycleConfig = DEFAULT_CYCLE_CONFIG,
  isPrimary = false,
  onLoadMoreHistory,
  hasMoreHistory = true,
  loadingMore = false,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesMgrRef = useRef<SeriesManager | null>(null)
  const indMgrRef = useRef<IndicatorSeriesManager | null>(null)
  const bridgeRef = useRef<CoordinateBridge | null>(null)
  const [mainChart, setMainChart] = useState<IChartApi | null>(null)
  const [priceSeries, setPriceSeries] = useState<ISeriesApi<'Candlestick'> | null>(null)
  const style = useChartStyleStore((s) => s)
  const indicatorParams = useIndicatorStore((s) => s.params)
  const focused = useChartFocusStore((s) => s.focusedPanelId === panelId)

  useEffect(() => {
    if (!containerRef.current) return
    const canvas = {
      background: style.canvasBg,
      text: style.textColor,
      grid: style.gridColor,
      border: style.borderColor,
    }
    const chart = createChart(containerRef.current, buildChartOptions(canvas))
    chartRef.current = chart
    setMainChart(chart)

    const sm = new SeriesManager(chart)
    seriesMgrRef.current = sm
    const series = sm.createCandlestick(style)
    setPriceSeries(series)

    const im = new IndicatorSeriesManager(chart)
    indMgrRef.current = im

    const bridge = new CoordinateBridge(chart, series)
    bridgeRef.current = bridge

    attachFreePan(chart)
    unlockPriceScale(chart)

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesMgrRef.current = null
      indMgrRef.current = null
      bridgeRef.current = null
      setMainChart(null)
      setPriceSeries(null)
    }
  }, [])

  // Style updates
  useEffect(() => {
    if (!chartRef.current || !seriesMgrRef.current) return
    chartRef.current.applyOptions(
      buildChartOptions({
        background: style.canvasBg,
        text: style.textColor,
        grid: style.gridColor,
        border: style.borderColor,
      }),
    )
    seriesMgrRef.current.updateStyle(style)
  }, [style.canvasBg, style.textColor, style.gridColor, style.borderColor, style.upColor, style.downColor, style.borderUp, style.borderDown, style.wickUp, style.wickDown])

  // Candles
  useEffect(() => {
    if (!seriesMgrRef.current) return
    seriesMgrRef.current.setData(candles)
  }, [candles])

  // Indicators
  useEffect(() => {
    if (!indMgrRef.current || !candles.length) return
    indMgrRef.current.sync(candles, indicatorParams)
  }, [candles, indicatorParams])

  // Sync group
  useEffect(() => {
    if (!chartRef.current || !syncGroup) return
    const chart = chartRef.current
    const unsub = subscribeSyncGroup(syncGroup, panelId, (payload: SyncPayload) => {
      if (payload.sourceId === panelId) return
      const ts = chart.timeScale()
      if (payload.logicalRange) ts.setVisibleLogicalRange(payload.logicalRange)
    })
    const handler = () => {
      const lr = chart.timeScale().getVisibleLogicalRange()
      if (lr) publishSync(syncGroup, panelId, { logicalRange: lr })
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler)
    return () => {
      unsub()
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler)
    }
  }, [syncGroup, panelId])

  // Focus highlight
  useEffect(() => {
    setSyncHighlight(panelId, focused)
  }, [focused, panelId])

  // Load more on scroll left
  useEffect(() => {
    if (!chartRef.current || !onLoadMoreHistory) return
    const chart = chartRef.current
    const handler = () => {
      const lr = chart.timeScale().getVisibleLogicalRange()
      if (!lr || !hasMoreHistory || loadingMore) return
      if (lr.from < LOAD_MORE_THRESHOLD) onLoadMoreHistory()
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler)
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler)
  }, [onLoadMoreHistory, hasMoreHistory, loadingMore])

  const deltaSeries = useCandleDeltaSeries(candles, deltaEnabled ? deltaConfig : null)

  return (
    <div className="h-full w-full flex flex-col relative">
      <div className="flex-1 min-h-0 relative" ref={containerRef}>
        {mainChart && priceSeries && bridgeRef.current && (
          <>
            <DrawingLayer
              chart={mainChart}
              series={priceSeries}
              bridge={bridgeRef.current}
              panelId={panelId}
              symbol={symbol}
            />
            <NativeLwcLines chart={mainChart} series={priceSeries} panelId={panelId} />
            <PaperEquitySeries chart={mainChart} />
            <PaperPositionLines chart={mainChart} series={priceSeries} />
            <DeepPrintOverlay
              enabled={deepPrintEnabled}
              chart={mainChart}
              series={priceSeries}
              bridge={bridgeRef.current}
              symbol={symbol}
              exchange={exchange}
              interval={interval}
            />
            <VolumeProfileOverlay
              enabled={profileEnabled}
              chart={mainChart}
              series={priceSeries}
              bridge={bridgeRef.current}
              candles={candles}
              config={profileConfig}
            />
            <RangeDiscoveryBadge
              enabled={profileEnabled}
              chart={mainChart}
              series={priceSeries}
              candles={candles}
              config={profileConfig}
            />
            <DeepTradesOverlay
              enabled={deepTradesEnabled}
              chart={mainChart}
              series={priceSeries}
              bridge={bridgeRef.current}
              symbol={symbol}
              exchange={exchange}
              config={deepTradesConfig}
            />
            <DeepDomOverlay
              enabled={deepDomEnabled}
              chart={mainChart}
              series={priceSeries}
              bridge={bridgeRef.current}
              symbol={symbol}
              exchange={exchange}
              config={deepDomConfig}
            />
            <FootprintOverlay
              enabled={footprintEnabled}
              chart={mainChart}
              series={priceSeries}
              bridge={bridgeRef.current}
              candles={candles}
              config={footprintConfig}
            />
            <GammaOverlay
              enabled={gammaEnabled}
              chart={mainChart}
              series={priceSeries}
              bridge={bridgeRef.current}
              config={gammaConfig}
            />
            <CycleOverlay
              enabled={cycleEnabled}
              chart={mainChart}
              series={priceSeries}
              bridge={bridgeRef.current}
              candles={candles}
              config={cycleConfig}
            />
            {deltaEnabled && deltaSeries && (
              <IndicatorValuesHud
                chart={mainChart}
                series={priceSeries}
                values={deltaSeries}
                label="Δ"
              />
            )}
          </>
        )}
        <LivePriceBadge candles={candles} status={status} />
        {replayEnabled && <ReplayBar candles={candles} />}
        {deepDomEnabled && (
          <DomLadder
            symbol={symbol}
            exchange={exchange}
            config={deepDomConfig ?? DEFAULT_DEEP_DOM_CONFIG}
          />
        )}
        {style.panelOpen && <ChartStylePanel />}
        {status === 'error' && lastError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
            <div className="bg-[#1e2329] border border-terminal-red rounded px-4 py-3 text-sm text-terminal-red max-w-sm">
              {lastError.message}
            </div>
          </div>
        )}
        {loadingMore && (
          <div className="absolute top-2 left-2 z-40 px-2 py-0.5 rounded bg-[#0b0e11]/80 border border-[#2b3139] text-[10px] text-[#f0b90b]">
            Loading history…
          </div>
        )}
        {!hasMoreHistory && candles.length > 0 && (
          <div className="absolute top-2 left-2 z-40">
            <div className="px-2 py-0.5 rounded bg-[#0b0e11]/80 border border-[#2b3139] text-[10px] text-[#5e6673]">
              History limit · {candles.length.toLocaleString()} bars
            </div>
          </div>
        )}
      </div>

      <IndicatorPanes mainChart={mainChart} candles={candles} params={indicatorParams} />
    </div>
  )
}
