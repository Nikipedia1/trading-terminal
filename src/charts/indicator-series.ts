/**
 * Manages Lightweight Charts series for technical indicators.
 * Overlay on right scale; oscillators on dedicated panes.
 */

import {
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type HistogramData,
  type Time,
} from 'lightweight-charts'
import type { Candle } from '@/types'
import {
  type IndicatorParamsMap,
  type LinePoint,
  computeSma,
  computeEma,
  computeBollinger,
  computeVwap,
  computeRsi,
  computeMacd,
  computeStoch,
  computeAtr,
} from '@/indicators'

function toLine(pts: LinePoint[]): LineData[] {
  return pts.map((p) => ({ time: p.time as Time, value: p.value }))
}

function toHist(pts: LinePoint[], colorUp: string, colorDown: string): HistogramData[] {
  return pts.map((p) => ({
    time: p.time as Time,
    value: p.value,
    color: p.value >= 0 ? colorUp : colorDown,
  }))
}

type LineSeries = ISeriesApi<'Line'>
type HistSeries = ISeriesApi<'Histogram'>

export class IndicatorSeriesManager {
  private chart: IChartApi | null = null
  private lines = new Map<string, LineSeries>()
  private hists = new Map<string, HistSeries>()

  attach(chart: IChartApi) {
    this.chart = chart
  }

  detach() {
    this.clearAllSeries()
    this.chart = null
  }

  private clearAllSeries() {
    if (!this.chart) {
      this.lines.clear()
      this.hists.clear()
      return
    }
    for (const s of this.lines.values()) {
      try {
        this.chart.removeSeries(s)
      } catch {
        /* already removed */
      }
    }
    for (const s of this.hists.values()) {
      try {
        this.chart.removeSeries(s)
      } catch {
        /* already removed */
      }
    }
    this.lines.clear()
    this.hists.clear()
  }

  private line(
    key: string,
    color: string,
    priceScaleId: string,
    opts?: { lineWidth?: number }
  ): LineSeries | null {
    if (!this.chart) return null
    let s = this.lines.get(key)
    if (!s) {
      s = this.chart.addLineSeries({
        color,
        lineWidth: (opts?.lineWidth ?? 2) as 1 | 2 | 3 | 4,
        priceScaleId,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      })
      this.lines.set(key, s)
    } else {
      s.applyOptions({ color, lineWidth: (opts?.lineWidth ?? 2) as 1 | 2 | 3 | 4 })
    }
    return s
  }

  private hist(key: string, priceScaleId: string): HistSeries | null {
    if (!this.chart) return null
    let s = this.hists.get(key)
    if (!s) {
      s = this.chart.addHistogramSeries({
        priceScaleId,
        base: 0,
        lastValueVisible: false,
        priceLineVisible: false,
      })
      this.hists.set(key, s)
    }
    return s
  }

  private ensurePane(scaleId: string, margins: { top: number; bottom: number }) {
    this.chart?.priceScale(scaleId).applyOptions({
      scaleMargins: margins,
      visible: false,
    })
  }

  /** Recompute all visible indicators from candles + params. */
  apply(candles: Candle[], params: IndicatorParamsMap) {
    if (!this.chart) return
    if (candles.length === 0) {
      this.clearAllSeries()
      return
    }

    const activeKeys = new Set<string>()

    const keepLine = (key: string, color: string, scale: string, pts: LinePoint[], width?: number) => {
      activeKeys.add(key)
      const s = this.line(key, color, scale, { lineWidth: width })
      s?.setData(toLine(pts))
    }
    const keepHist = (key: string, scale: string, pts: LinePoint[], up: string, down: string) => {
      activeKeys.add(`h:${key}`)
      const s = this.hist(key, scale)
      s?.setData(toHist(pts, up, down))
    }

    // Overlays share main right scale
    if (params.sma.visible) {
      const p = params.sma
      if (p.period > 0) keepLine('sma1', p.color, 'right', computeSma(candles, p.period))
      if (p.period2 > 0) keepLine('sma2', p.color2, 'right', computeSma(candles, p.period2))
      if (p.period3 > 0) keepLine('sma3', p.color3, 'right', computeSma(candles, p.period3), 1)
    }

    if (params.ema.visible) {
      const p = params.ema
      if (p.period > 0) keepLine('ema1', p.color, 'right', computeEma(candles, p.period))
      if (p.period2 > 0) keepLine('ema2', p.color2, 'right', computeEma(candles, p.period2))
      if (p.period3 > 0) keepLine('ema3', p.color3, 'right', computeEma(candles, p.period3), 1)
    }

    if (params.bb.visible) {
      const p = params.bb
      const bb = computeBollinger(candles, Math.max(2, p.period), Math.max(0.1, p.mult))
      keepLine('bb-mid', p.color2, 'right', bb.mid, 1)
      keepLine('bb-up', p.color, 'right', bb.upper, 1)
      keepLine('bb-lo', p.color3, 'right', bb.lower, 1)
    }

    if (params.vwap.visible) {
      keepLine('vwap', params.vwap.color, 'right', computeVwap(candles), 2)
    }

    // Panes – stack toward bottom (volume already uses lower area)
    if (params.rsi.visible) {
      this.ensurePane('ind-rsi', { top: 0.82, bottom: 0 })
      const p = params.rsi
      keepLine('rsi', p.color, 'ind-rsi', computeRsi(candles, Math.max(2, p.period)), 2)
    }

    if (params.macd.visible) {
      this.ensurePane('ind-macd', { top: 0.78, bottom: 0 })
      const p = params.macd
      const m = computeMacd(
        candles,
        Math.max(2, p.period),
        Math.max(3, p.period2),
        Math.max(2, p.period3)
      )
      keepLine('macd', p.color, 'ind-macd', m.macd, 2)
      keepLine('macd-sig', p.color2, 'ind-macd', m.signal, 1)
      keepHist('macd-hist', 'ind-macd', m.hist, 'rgba(14,203,129,0.5)', 'rgba(246,70,93,0.5)')
    }

    if (params.stoch.visible) {
      this.ensurePane('ind-stoch', { top: 0.82, bottom: 0 })
      const p = params.stoch
      const s = computeStoch(
        candles,
        Math.max(2, p.period),
        Math.max(1, p.period2),
        Math.max(1, p.period3)
      )
      keepLine('stoch-k', p.color, 'ind-stoch', s.k, 2)
      keepLine('stoch-d', p.color2, 'ind-stoch', s.d, 1)
    }

    if (params.atr.visible) {
      this.ensurePane('ind-atr', { top: 0.85, bottom: 0 })
      const p = params.atr
      keepLine('atr', p.color, 'ind-atr', computeAtr(candles, Math.max(2, p.period)), 2)
    }

    // Remove series no longer active
    for (const [key, s] of [...this.lines.entries()]) {
      if (!activeKeys.has(key)) {
        try {
          this.chart.removeSeries(s)
        } catch {
          /* */
        }
        this.lines.delete(key)
      }
    }
    for (const [key, s] of [...this.hists.entries()]) {
      if (!activeKeys.has(`h:${key}`)) {
        try {
          this.chart.removeSeries(s)
        } catch {
          /* */
        }
        this.hists.delete(key)
      }
    }
  }
}
