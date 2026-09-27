/**
 * ChartContainer – price chart on top; oscillator panes stacked below.
 * Layer stack: profile (L1) → footprint (L2) → bubbles (L3) → drawings (L5).
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
import type { Candle, ConnectionStatus, MarketError, ExchangeId, Interval } from '@/types'
import { SeriesManager } from './series-manager'
import { IndicatorSeriesManager } from './indicator-series'
import { IndicatorPanes } from './IndicatorPanes'
import { IndicatorValuesHud } from './IndicatorValuesHud'
import { CoordinateBridge } from './coordinate-bridge'
import { attachFreePan } from './free-pan'
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
import { PaperPositionLines } from '@/trading/paper'

function intervalToSeconds(interval: Interval): number {
  const m: Record<string, number> = {
    '1m': 60,
    '3m': 180,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '2h': 7200,
    '4h': 14400,
    '6h': 21600,
    '8h': 28800,
    '12h': 43200,
    '1d': 86400,
    '3d': 259200,
    '1w': 604800,
    '1M': 2592000,
  }
  return m[interval] ?? 60
}

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
      mode: CrosshairMode.Normal,
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
  replayEnabled?: boolean
  isPrimary?: boolean
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
  replayEnabled = false,
  isPrimary = false,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [mainChart, setMainChart] = useState<IChartApi | null>(null)
  const seriesMgrRef = useRef<SeriesManager | null>(null)
  const indicatorMgrRef = useRef<IndicatorSeriesManager | null>(null)
  const [seriesMgr, setSeriesMgr] = useState<SeriesManager | null>(null)
  const bridgeRef = useRef<CoordinateBridge | null>(null)
  const [bridge, setBridge] = useState<CoordinateBridge | null>(null)
  const lastHistoryKeyRef = useRef<string>('')
  const applyingRemoteRef = useRef(false)

  const chartStyle = useChartStyleStore((s) => s.style)
  const focusRequest = useChartFocusStore((s) => s.request)
  const indicatorByPanel = useIndicatorStore((s) => s.byPanel)
  const getIndicatorParams = useIndicatorStore((s) => s.getParams)
  const indicatorParams = getIndicatorParams(panelId)
  const activeTool = useDrawingStore((s) => s.activeTool)
  void indicatorByPanel

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
    const candleSeries = mgr.getCandleSeries()
    if (candleSeries) bridgeInstance.attach(chart, candleSeries)

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
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesMgrRef.current?.getCandleSeries() as
      | ISeriesApi<'Candlestick'>
      | null
      | undefined
    const el = containerRef.current
    if (!chart || !series || !el) return

    const detach = attachFreePan(
      { chart, series, container: el },
      () => useDrawingStore.getState().activeTool === 'pan'
    )
    return detach
  }, [mainChart, seriesMgr])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (activeTool === 'pan') el.style.cursor = 'grab'
    else if (el.style.cursor === 'grab' || el.style.cursor === 'grabbing') el.style.cursor = ''
  }, [activeTool])

  useEffect(() => {
    const chart = chartRef.current
    const mgr = seriesMgrRef.current
    if (!chart || !mgr) return
    const opts = buildChartOptions(chartStyle.canvas)
    chart.applyOptions({
      layout: opts.layout,
      grid: opts.grid,
      crosshair: opts.crosshair,
      rightPriceScale: { borderColor: chartStyle.canvas.border },
      timeScale: { borderColor: chartStyle.canvas.border },
    })
    mgr.applyStyle(chartStyle.candle)
  }, [chartStyle])

  useEffect(() => {
    if (!seriesMgrRef.current || candles.length === 0) return
    const historyKey = `${candles[0].time}|${candles.length}|${candles[candles.length - 1]?.time}`
    if (historyKey !== lastHistoryKeyRef.current) {
      lastHistoryKeyRef.current = historyKey
      seriesMgrRef.current.setCandles(candles)
      chartRef.current?.timeScale().fitContent()
    } else {
      seriesMgrRef.current.updateCandle(candles[candles.length - 1])
    }
    bridgeRef.current?.setDataTimes(
      candles.map((c) => c.time),
      intervalToSeconds(interval)
    )
  }, [candles, interval])

  useEffect(() => {
    const ind = indicatorMgrRef.current
    if (!ind) return
    ind.apply(candles, indicatorParams)
  }, [candles, panelId, indicatorParams])

  useEffect(() => {
    if (!isPrimary || !focusRequest || !chartRef.current) return
    const chart = chartRef.current
    const pad = focusRequest.padSec ?? 900
    try {
      chart.timeScale().setVisibleRange({
        from: (focusRequest.timeSec - pad) as Time,
        to: (focusRequest.timeSec + pad) as Time,
      })
    } catch {
      /* */
    }
  }, [focusRequest, isPrimary])

  useCandleDeltaSeries(
    deltaEnabled,
    seriesMgr,
    exchange,
    symbol,
    interval,
    candles,
    deltaConfig
  )

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
        publishSync(syncGroup, panelId, {
          type: 'crosshair',
          time: null,
          price: null,
          highlight: null,
        })
        setSyncHighlight(syncGroup, null)
        return
      }
      const time = typeof param.time === 'number' ? param.time : null
      let price: number | null = null
      if (candleSeries && param.seriesData) {
        const d = param.seriesData.get(candleSeries)
        if (d && 'close' in d) price = d.close as number
        else if (d && 'value' in d) price = d.value as number
      }
      // Orderflow highlight: nearest point under crosshair (time+price)
      const highlight =
        time != null && price != null
          ? { timeSec: time, price, aggressor: undefined as 'buy' | 'sell' | undefined }
          : null
      if (highlight) setSyncHighlight(syncGroup, highlight)
      else setSyncHighlight(syncGroup, null)

      publishSync(syncGroup, panelId, { type: 'crosshair', time, price, highlight })
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
        } else if (payload.type === 'crosshair') {
          const series = seriesMgrRef.current?.getCandleSeries()
          if (payload.time == null || payload.price == null || !series) {
            c.clearCrosshairPosition()
            setSyncHighlight(syncGroup, null)
          } else {
            try {
              c.setCrosshairPosition(payload.price, payload.time as Time, series)
            } catch {
              /* series may not have that time */
            }
            if (payload.highlight) setSyncHighlight(syncGroup, payload.highlight)
            else if (payload.time != null && payload.price != null) {
              setSyncHighlight(syncGroup, {
                timeSec: payload.time,
                price: payload.price,
              })
            } else {
              setSyncHighlight(syncGroup, null)
            }
          }
        }
      } catch {
        /* */
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
    <div
      className="w-full h-full flex flex-col"
      style={{ backgroundColor: chartStyle.canvas.background }}
    >
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />

        <IndicatorValuesHud candles={candles} params={indicatorParams} />

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

        {/* L1 static profile */}
        <VolumeProfileOverlay
          enabled={profileEnabled}
          bridge={bridge}
          containerRef={containerRef}
          exchange={exchange}
          symbol={symbol}
          config={profileConfig}
        />

        {/* L2 footprint */}
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

        {/* L3 live bubbles */}
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
        />

        {/* L5 drawings – topmost interactive data layer */}
        <DrawingLayer
          panelId={panelId}
          symbol={symbol}
          bridge={bridge}
          containerRef={containerRef}
          passThrough={deepPrintEnabled}
        />

        <PaperPositionLines
          enabled
          bridge={bridge}
          containerRef={containerRef}
          symbol={symbol}
        />

        <DomLadder enabled={deepDomEnabled} exchange={exchange} symbol={symbol} />

        <ReplayBar enabled={replayEnabled} exchange={exchange} symbol={symbol} />

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
            Connecting…
          </div>
        )}
      </div>

      <IndicatorPanes mainChart={mainChart} candles={candles} params={indicatorParams} />
    </div>
  )
}
