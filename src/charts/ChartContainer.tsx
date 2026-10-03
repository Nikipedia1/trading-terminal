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
import { CycleOverlay, DEFAULT_CYCLE_CONFIG, type CycleConfig } from '@/analysis/cycles'
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
import { PaperPositionLines } from '@/trading/paper'
import { LOAD_MORE_THRESHOLD } from '@/data/klines/history'

function buildChartOptions(canvas: {
  background: string
  text: string
  grid: string
  border: string
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
      vertLine: {
        color: canvas.text,
        width: 1 as const,
        style: 2,
        labelBackgroundColor: canvas.border,
      },
      horzLine: {
        color: canvas.text,
        width: 1 as const,
        style: 2,
        labelBackgroundColor: canvas.border,
      },
    },
    rightPriceScale: {
      borderColor: canvas.border,
      scaleMargins: { top: 0.05, bottom: 0.28 },
      autoScale: true,
      entireTextOnly: false,
      ticksVisible: true,
      borderVisible: true,
      minimumWidth: 72,
    },
    timeScale: {
      borderColor: canvas.border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 12,
      shiftVisibleRangeOnNewBar: true,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
    handleScale: {
      axisPressedMouseMove: { time: true, price: true },
      axisDoubleClickReset: { time: true, price: true },
      mouseWheel: true,
      pinch: true,
    },
  }
}

export interface ChartContainerProps {
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
  onLoadMoreHistory?: () => Promise<number> | number | void
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
  syncGroup = null,
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
  hasMoreHistory = false,
  loadingMore = false,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [mainChart, setMainChart] = useState<IChartApi | null>(null)
  const seriesMgrRef = useRef<SeriesManager | null>(null)
  const indicatorMgrRef = useRef<IndicatorSeriesManager | null>(null)
  const [seriesMgr, setSeriesMgr] = useState<SeriesManager | null>(null)
  const bridgeRef = useRef<CoordinateBridge | null>(null)
  const [bridge, setBridge] = useState<CoordinateBridge | null>(null)
  const [candleSeries, setCandleSeries] = useState<ISeriesApi<'Candlestick'> | null>(null)
  const [logScale, setLogScale] = useState(false)
  const [printPinTime, setPrintPinTime] = useState<number | null>(null)
  const candlesSigRef = useRef<{ len: number; first: number | null; last: number | null }>({
    len: 0,
    first: null,
    last: null,
  })
  const loadMoreBusyRef = useRef(false)
  const onLoadMoreRef = useRef(onLoadMoreHistory)
  onLoadMoreRef.current = onLoadMoreHistory
  const hasMoreRef = useRef(hasMoreHistory)
  hasMoreRef.current = hasMoreHistory
  const loadingMoreRef = useRef(loadingMore)
  loadingMoreRef.current = loadingMore

  const chartStyle = useChartStyleStore((s) => s.style)
  const focusRequest = useChartFocusStore((s) => s.request)
  const indicatorByPanel = useIndicatorStore((s) => s.byPanel)
  const getIndicatorParams = useIndicatorStore((s) => s.getParams)
  const indicatorParams = getIndicatorParams(panelId)
  const activeTool = useDrawingStore((s) => s.activeTool)
  void indicatorByPanel
  void activeTool
  void seriesMgr
  void deltaConfig

  useEffect(() => {
    if (!containerRef.current) return
    const initial = useChartStyleStore.getState().style
    const chart = createChart(containerRef.current, {
      ...buildChartOptions(initial.canvas),
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })
    const mgr = new SeriesManager()
    mgr.attach(chart, initial.candle)
    const indMgr = new IndicatorSeriesManager()
    indMgr.attach(chart)
    const bridgeInstance = new CoordinateBridge()
    const cs = mgr.getCandleSeries()
    if (cs) {
      bridgeInstance.attach(chart, cs)
      setCandleSeries(cs as ISeriesApi<'Candlestick'>)
    }
    chartRef.current = chart
    setMainChart(chart)
    seriesMgrRef.current = mgr
    indicatorMgrRef.current = indMgr
    setSeriesMgr(mgr)
    bridgeRef.current = bridgeInstance
    setBridge(bridgeInstance)
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) chart.applyOptions({ width, height })
    })
    ro.observe(containerRef.current)
    return () => {
      ro.disconnect()
      bridgeInstance.detach()
      indMgr.detach()
      mgr.detach()
      chart.remove()
      chartRef.current = null
      setMainChart(null)
      seriesMgrRef.current = null
      indicatorMgrRef.current = null
      setSeriesMgr(null)
      bridgeRef.current = null
      setBridge(null)
      setCandleSeries(null)
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesMgrRef.current?.getCandleSeries() as ISeriesApi<'Candlestick'> | null | undefined
    const el = containerRef.current
    if (!chart || !series || !el) return
    return attachFreePan(chart, series, el)
  }, [mainChart, candleSeries])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    unlockPriceScale(chart)
  }, [mainChart])

  useEffect(() => {
    const chart = chartRef.current
    const mgr = seriesMgrRef.current
    if (!chart || !mgr) return
    const opts = buildChartOptions(chartStyle.canvas)
    chart.applyOptions({
      layout: opts.layout,
      grid: opts.grid,
      crosshair: opts.crosshair,
      rightPriceScale: { borderColor: chartStyle.canvas.border, autoScale: true },
      timeScale: { borderColor: chartStyle.canvas.border },
    })
    mgr.applyStyle(chartStyle.candle)
  }, [chartStyle])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.priceScale('right').applyOptions({
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    })
  }, [logScale])

  useEffect(() => {
    const mgr = seriesMgrRef.current
    if (!mgr) return
    const prev = candlesSigRef.current
    const len = candles.length
    const first = len ? candles[0].time : null
    const last = len ? candles[len - 1].time : null
    const prepended =
      prev.len > 0 &&
      len > prev.len &&
      first != null &&
      prev.first != null &&
      first < prev.first &&
      last === prev.last
    if (prepended && chartRef.current) {
      const ts = chartRef.current.timeScale()
      const lr = ts.getVisibleLogicalRange()
      mgr.setData(candles)
      if (lr) {
        const added = len - prev.len
        ts.setVisibleLogicalRange({ from: lr.from + added, to: lr.to + added })
      }
    } else {
      mgr.setData(candles)
    }
    candlesSigRef.current = { len, first, last }
    const times = candles.map((c) => c.time)
    bridgeRef.current?.setDataTimes(times)
  }, [candles])

  useEffect(() => {
    const ind = indicatorMgrRef.current
    if (!ind) return
    ind.apply(candles, indicatorParams)
  }, [candles, panelId, indicatorParams])

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

  useEffect(() => {
    if (!isPrimary || !focusRequest || !chartRef.current) return
    const chart = chartRef.current
    const ts = chart.timeScale()
    if (focusRequest.logicalRange) ts.setVisibleLogicalRange(focusRequest.logicalRange)
  }, [focusRequest, isPrimary])

  useEffect(() => {
    if (!chartRef.current || !onLoadMoreHistory) return
    const chart = chartRef.current
    const handler = () => {
      if (loadMoreBusyRef.current || !hasMoreRef.current || loadingMoreRef.current) return
      const lr = chart.timeScale().getVisibleLogicalRange()
      if (!lr) return
      if (lr.from < LOAD_MORE_THRESHOLD) {
        loadMoreBusyRef.current = true
        Promise.resolve(onLoadMoreRef.current?.()).finally(() => {
          loadMoreBusyRef.current = false
        })
      }
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler)
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler)
  }, [onLoadMoreHistory, mainChart])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesMgrRef.current?.getCandleSeries()
    if (!chart || !series || !deepPrintEnabled) {
      setPrintPinTime(null)
      return
    }
    const handler = (param: { time?: Time }) => {
      if (param.time != null && typeof param.time === 'number') setPrintPinTime(param.time)
    }
    chart.subscribeClick(handler)
    return () => {
      try {
        chart.unsubscribeClick(handler)
      } catch {
        /* */
      }
    }
  }, [deepPrintEnabled, mainChart, candleSeries])

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ backgroundColor: chartStyle.canvas.background }}
    >
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />

        <IndicatorValuesHud candles={candles} params={indicatorParams} />
        <LivePriceBadge bridge={bridge} containerRef={containerRef} candles={candles} />

        <RangeDiscoveryBadge
          enabled={profileEnabled || deltaEnabled}
          exchange={exchange}
          symbol={symbol}
          interval={interval}
          candles={candles}
          profileWindow={
            profileConfig.developing === 'visible' ? 'session' : profileConfig.developing
          }
        />

        <VolumeProfileOverlay
          enabled={profileEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          config={profileConfig}
          series={candleSeries}
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

        <DeepDomOverlay
          enabled={deepDomEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          config={deepDomConfig}
        />

        <DeepTradesOverlay
          enabled={deepTradesEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          config={deepTradesConfig}
          candles={candles}
          interval={interval}
          syncGroup={syncGroup}
        />

        <DeepPrintOverlay
          enabled={deepPrintEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          interval={interval}
          candles={candles}
          forcePinTime={printPinTime}
        />

        <CycleOverlay
          enabled={cycleEnabled}
          bridge={bridge}
          containerRef={containerRef}
          candles={candles}
          config={cycleConfig}
        />

        <GammaOverlay
          enabled={gammaEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          config={gammaConfig}
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

        <DomLadder enabled={deepDomEnabled} exchange={exchange} symbol={symbol} />
        <ReplayBar enabled={replayEnabled} exchange={exchange} symbol={symbol} />

        <PaperEquitySeries chart={mainChart} symbol={symbol} enabled />

        <NativeLwcLines
          series={candleSeries}
          symbol={symbol}
          exchange={exchange}
          enabled
        />

        <button
          type="button"
          className={`absolute bottom-2 right-14 z-20 text-[10px] px-1.5 py-0.5 rounded border ${
            logScale
              ? 'bg-[#1e2329] text-[#f0b90b] border-[#f0b90b]/50'
              : 'bg-[#0b0e11]/80 text-[#848e9c] border-[#2b3139]'
          }`}
          title="Toggle logarithmic price scale"
          onClick={() => setLogScale((v) => !v)}
        >
          {logScale ? 'LOG' : 'LIN'}
        </button>

        <ChartStylePanel />

        {lastError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="bg-terminal-red/10 border border-terminal-red/50 text-terminal-red px-6 py-4 rounded text-sm max-w-md text-center">
              <div className="font-semibold mb-1">[{lastError.code}] Data Error</div>
              <div className="text-xs opacity-90">{lastError.message}</div>
            </div>
          </div>
        )}

        {status === 'connecting' && candles.length === 0 && !lastError && (
          <div className="absolute inset-0 flex items-center justify-center text-terminal-muted text-sm z-10">
            Loading {symbol}…
          </div>
        )}

        {loadingMore && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="px-2.5 py-1 rounded bg-[#0b0e11]/90 border border-[#f0b90b]/40 text-[11px] text-[#f0b90b] font-medium shadow">
              Loading older bars… · {candles.length.toLocaleString()} loaded
            </div>
          </div>
        )}

        {!hasMoreHistory && candles.length > 500 && !loadingMore && (
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <div className="px-1.5 py-0.5 rounded bg-[#0b0e11]/80 border border-[#2b3139] text-[10px] text-[#5e6673]">
              History limit · {candles.length.toLocaleString()} bars
            </div>
          </div>
        )}
      </div>

      <IndicatorPanes mainChart={mainChart} candles={candles} params={indicatorParams} />
    </div>
  )
}
