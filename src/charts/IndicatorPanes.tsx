/**
 * Oscillator panes BELOW the main price chart (TradingView-style).
 * Time scale: main → pane only (no reverse sync = no zoom feedback loop).
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import {
  createChart,
  type IChartApi,
  type Time,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts'
import type { Candle } from '@/types'
import {
  INDICATOR_CATALOG,
  type IndicatorId,
  type IndicatorParamsMap,
  type LinePoint,
  computeRsi,
  computeMacd,
  computeStoch,
  computeAtr,
  computeCci,
  computeWillR,
  computeMomentum,
  computeRoc,
  computeObv,
  computeMfi,
  computeAdx,
  computeVolSma,
  computeAo,
  computeTrix,
  computePpo,
  computeAroon,
  computeDpo,
  computeCmf,
  computeAdl,
  computeForce,
  computeElderRay,
  computeUo,
  computeCmo,
  computeRvi,
  computeStdDev,
  levelLine,
} from '@/indicators'
import { useChartStyleStore } from '@/stores/chartStyleStore'

const PANE_H = 120
const PANE_H_EXPANDED = 240

function toLine(pts: LinePoint[]) {
  const sorted = pts
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time)
  const out: { time: Time; value: number }[] = []
  let last = -Infinity
  for (const p of sorted) {
    if (p.time <= last) continue
    out.push({ time: p.time as Time, value: p.value })
    last = p.time
  }
  return out
}

function toHist(pts: LinePoint[], up: string, down: string) {
  return toLine(pts).map((p) => ({
    ...p,
    color: p.value >= 0 ? up : down,
  }))
}

function drawPane(
  chart: IChartApi,
  id: IndicatorId,
  candles: Candle[],
  params: IndicatorParamsMap,
  seriesBag: unknown[]
) {
  const p = params[id]
  if (!p?.visible) return

  const track = <T,>(s: T): T => {
    seriesBag.push(s)
    return s
  }

  const addLine = (
    pts: LinePoint[],
    color: string,
    title: string,
    width = 2,
    showVal = true
  ) => {
    const s = track(
      chart.addLineSeries({
        color,
        lineWidth: Math.min(4, Math.max(1, width)) as 1 | 2 | 3 | 4,
        title,
        lastValueVisible: showVal,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      })
    )
    s.setData(toLine(pts))
  }
  const addHist = (pts: LinePoint[], up: string, down: string, title: string) => {
    const s = track(
      chart.addHistogramSeries({
        base: 0,
        title,
        lastValueVisible: true,
        priceLineVisible: false,
      })
    )
    s.setData(toHist(pts, up, down))
  }

  try {
    switch (id) {
      case 'rsi': {
        addLine(
          computeRsi(candles, Math.max(2, p.period), p.source),
          p.color,
          `RSI(${p.period})`,
          p.lineWidth,
          p.showValue
        )
        if (p.show2) {
          addLine(levelLine(candles, p.levelHigh), p.color2, String(p.levelHigh), 1, false)
          addLine(levelLine(candles, p.levelLow), p.color2, String(p.levelLow), 1, false)
        }
        break
      }
      case 'macd': {
        let fast = Math.max(2, p.period)
        let slow = Math.max(3, p.period2)
        if (fast >= slow) slow = fast + 1
        const m = computeMacd(candles, fast, slow, Math.max(2, p.period3), p.source)
        if (p.show1) addLine(m.macd, p.color, 'MACD', p.lineWidth, p.showValue)
        if (p.show2) addLine(m.signal, p.color2, 'Signal', p.lineWidth2, p.showValue)
        if (p.show3)
          addHist(m.hist, 'rgba(14,203,129,0.55)', 'rgba(246,70,93,0.55)', 'Hist')
        break
      }
      case 'stoch': {
        const s = computeStoch(
          candles,
          Math.max(2, p.period),
          Math.max(1, p.period2),
          Math.max(1, p.period3)
        )
        if (p.show1) addLine(s.k, p.color, '%K', p.lineWidth, p.showValue)
        if (p.show2) addLine(s.d, p.color2, '%D', p.lineWidth2, p.showValue)
        if (p.show3) {
          addLine(levelLine(candles, p.levelHigh), p.color3, '', 1, false)
          addLine(levelLine(candles, p.levelLow), p.color3, '', 1, false)
        }
        break
      }
      case 'cci':
        addLine(computeCci(candles, Math.max(2, p.period)), p.color, 'CCI', p.lineWidth, p.showValue)
        if (p.show2) {
          addLine(levelLine(candles, p.levelHigh), p.color2, '', 1, false)
          addLine(levelLine(candles, p.levelLow), p.color2, '', 1, false)
        }
        break
      case 'willr':
        addLine(computeWillR(candles, Math.max(2, p.period)), p.color, '%R', p.lineWidth, p.showValue)
        break
      case 'momentum':
        addLine(
          computeMomentum(candles, Math.max(1, p.period), p.source),
          p.color,
          'Mom',
          p.lineWidth,
          p.showValue
        )
        break
      case 'roc':
        addLine(
          computeRoc(candles, Math.max(1, p.period), p.source),
          p.color,
          'ROC',
          p.lineWidth,
          p.showValue
        )
        break
      case 'atr':
        addLine(computeAtr(candles, Math.max(2, p.period)), p.color, 'ATR', p.lineWidth, p.showValue)
        break
      case 'adx': {
        const a = computeAdx(candles, Math.max(2, p.period))
        if (p.show1) addLine(a.adx, p.color, 'ADX', p.lineWidth, p.showValue)
        if (p.show2) addLine(a.plusDI, p.color2, '+DI', 1, p.showValue)
        if (p.show3) addLine(a.minusDI, p.color3, '-DI', 1, p.showValue)
        break
      }
      case 'obv':
        addLine(computeObv(candles), p.color, 'OBV', p.lineWidth, p.showValue)
        break
      case 'mfi':
        addLine(computeMfi(candles, Math.max(2, p.period)), p.color, 'MFI', p.lineWidth, p.showValue)
        break
      case 'volsma': {
        const v = computeVolSma(candles, Math.max(1, p.period))
        if (p.show1) addHist(v.volume, p.color, p.color, 'Vol')
        if (p.show2) addLine(v.sma, p.color2, 'VolSMA', 2, p.showValue)
        break
      }
      case 'ao':
        addHist(
          computeAo(candles, Math.max(2, p.period), Math.max(3, p.period2)),
          'rgba(14,203,129,0.7)',
          'rgba(246,70,93,0.7)',
          'AO'
        )
        break
      case 'trix':
        addLine(
          computeTrix(candles, Math.max(2, p.period), p.source),
          p.color,
          'TRIX',
          p.lineWidth,
          p.showValue
        )
        break
      case 'ppo': {
        let f = Math.max(2, p.period)
        let s = Math.max(3, p.period2)
        if (f >= s) s = f + 1
        const pp = computePpo(candles, f, s, Math.max(2, p.period3), p.source)
        addLine(pp.ppo, p.color, 'PPO', p.lineWidth, p.showValue)
        addLine(pp.signal, p.color2, 'Sig', 1, p.showValue)
        break
      }
      case 'aroon': {
        const a = computeAroon(candles, Math.max(2, p.period))
        addLine(a.up, p.color, 'Aroon↑', p.lineWidth, p.showValue)
        addLine(a.down, p.color2, 'Aroon↓', 1, p.showValue)
        break
      }
      case 'dpo':
        addLine(
          computeDpo(candles, Math.max(2, p.period), p.source),
          p.color,
          'DPO',
          p.lineWidth,
          p.showValue
        )
        break
      case 'cmf':
        addLine(computeCmf(candles, Math.max(2, p.period)), p.color, 'CMF', p.lineWidth, p.showValue)
        break
      case 'adl':
        addLine(computeAdl(candles), p.color, 'ADL', p.lineWidth, p.showValue)
        break
      case 'force':
        addLine(
          computeForce(candles, Math.max(2, p.period)),
          p.color,
          'FI',
          p.lineWidth,
          p.showValue
        )
        break
      case 'elderray': {
        const er = computeElderRay(candles, Math.max(2, p.period))
        addHist(er.bull, p.color, p.color, 'Bull')
        addHist(er.bear, p.color2, p.color2, 'Bear')
        break
      }
      case 'uo':
        addLine(
          computeUo(
            candles,
            Math.max(2, p.period),
            Math.max(2, p.period2),
            Math.max(2, p.period3)
          ),
          p.color,
          'UO',
          p.lineWidth,
          p.showValue
        )
        break
      case 'cmo':
        addLine(
          computeCmo(candles, Math.max(2, p.period), p.source),
          p.color,
          'CMO',
          p.lineWidth,
          p.showValue
        )
        break
      case 'rvi': {
        const r = computeRvi(candles, Math.max(2, p.period), Math.max(1, p.period2))
        addLine(r.rvi, p.color, 'RVI', p.lineWidth, p.showValue)
        addLine(r.signal, p.color2, 'Sig', 1, p.showValue)
        break
      }
      case 'stddev':
        addLine(
          computeStdDev(candles, Math.max(2, p.period), p.source),
          p.color,
          'σ',
          p.lineWidth,
          p.showValue
        )
        break
      default:
        break
    }
  } catch (e) {
    console.warn('[IndicatorPanes] draw', id, e)
  }
}

function PaneRow({
  id,
  label,
  candles,
  params,
  mainChart,
  expanded,
  onToggleExpand,
  showTimeAxis,
}: {
  id: IndicatorId
  label: string
  candles: Candle[]
  params: IndicatorParamsMap
  mainChart: IChartApi | null
  expanded: boolean
  onToggleExpand: () => void
  showTimeAxis: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesBag = useRef<unknown[]>([])
  const style = useChartStyleStore((s) => s.style)
  const h = expanded ? PANE_H_EXPANDED : PANE_H

  // Create chart once; only rebuild if height changes a lot
  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    let chart: IChartApi | null = null
    let ro: ResizeObserver | null = null
    let cancelled = false

    const mount = () => {
      if (cancelled || !hostRef.current) return
      const w = hostRef.current.clientWidth
      if (w < 8) {
        requestAnimationFrame(mount)
        return
      }
      const canvas = useChartStyleStore.getState().style.canvas
      chart = createChart(hostRef.current, {
        width: w,
        height: h,
        layout: {
          background: { type: ColorType.Solid, color: canvas.background },
          textColor: canvas.text,
        },
        grid: {
          vertLines: { color: canvas.grid },
          horzLines: { color: canvas.grid },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: canvas.border,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: canvas.border,
          timeVisible: showTimeAxis,
          secondsVisible: false,
          rightOffset: 8,
          visible: showTimeAxis,
        },
        // Pane follows main – no independent zoom that fights the price chart
        handleScroll: false,
        handleScale: false,
      })
      chartRef.current = chart

      ro = new ResizeObserver((entries) => {
        const { width } = entries[0].contentRect
        if (width > 8 && chart) chart.applyOptions({ width, height: h })
      })
      ro.observe(hostRef.current)
    }

    mount()

    return () => {
      cancelled = true
      ro?.disconnect()
      chart?.remove()
      chartRef.current = null
      seriesBag.current = []
    }
  }, [h, showTimeAxis])

  // Theme
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const c = style.canvas
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: c.background },
        textColor: c.text,
      },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    })
  }, [style.canvas])

  // Draw / redraw series
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || candles.length === 0) return

    for (const s of seriesBag.current) {
      try {
        chart.removeSeries(s as never)
      } catch {
        /* */
      }
    }
    seriesBag.current = []
    drawPane(chart, id, candles, params, seriesBag.current)

    // Align to main range after data is set
    if (mainChart) {
      const range = mainChart.timeScale().getVisibleRange()
      if (range) {
        try {
          chart.timeScale().setVisibleRange(range)
        } catch {
          /* */
        }
      }
    }
  }, [candles, params, id, mainChart, h])

  // One-way sync: main → pane only
  useEffect(() => {
    if (!mainChart || !chartRef.current) return
    const pane = chartRef.current

    const onMain = () => {
      const range = mainChart.timeScale().getVisibleRange()
      if (!range) return
      try {
        pane.timeScale().setVisibleRange(range)
      } catch {
        /* out of data */
      }
    }

    mainChart.timeScale().subscribeVisibleTimeRangeChange(onMain)
    onMain()
    return () => {
      mainChart.timeScale().unsubscribeVisibleTimeRangeChange(onMain)
    }
  }, [mainChart, h])

  return (
    <div
      className="relative border-t border-terminal-border shrink-0 w-full overflow-hidden"
      style={{ height: h }}
    >
      <div className="absolute top-0.5 left-1 z-10 flex items-center gap-1 pointer-events-auto">
        <span className="text-[10px] text-terminal-muted bg-terminal-panel/90 px-1 rounded">
          {label}
        </span>
        <button
          type="button"
          className="text-[9px] text-terminal-muted hover:text-terminal-text bg-terminal-panel/90 px-1 rounded border border-terminal-border"
          title={expanded ? 'Riduci' : 'Espandi'}
          onClick={onToggleExpand}
        >
          {expanded ? '▾' : '▴'}
        </button>
      </div>
      <div ref={hostRef} className="absolute inset-0 w-full h-full" />
    </div>
  )
}

export function IndicatorPanes({
  mainChart,
  candles,
  params,
}: {
  mainChart: IChartApi | null
  candles: Candle[]
  params: IndicatorParamsMap
}) {
  const active = useMemo(
    () => INDICATOR_CATALOG.filter((m) => m.pane === 'pane' && params[m.id]?.visible),
    [params]
  )
  const [expandedId, setExpandedId] = useState<IndicatorId | null>(null)

  if (active.length === 0) return null

  return (
    <div className="flex flex-col shrink-0 w-full max-w-full overflow-hidden bg-terminal-bg">
      {active.map((m, i) => (
        <PaneRow
          key={m.id}
          id={m.id}
          label={m.short}
          candles={candles}
          params={params}
          mainChart={mainChart}
          expanded={expandedId === m.id}
          showTimeAxis={i === active.length - 1}
          onToggleExpand={() => setExpandedId((cur) => (cur === m.id ? null : m.id))}
        />
      ))}
    </div>
  )
}
