/**
 * Lightweight Charts series for technical indicators.
 * Defensive: sanitize times, try/catch – never crash React.
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
  computeWma,
  computeHull,
  computeDema,
  computeTema,
  computeBollinger,
  computeDonchian,
  computeKeltner,
  computeSupertrend,
  computeSar,
  computeIchimoku,
  computeVwap,
  computeVolSma,
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
  levelLine,
} from '@/indicators'

function toLine(pts: LinePoint[]): LineData[] {
  const sorted = pts
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time)
  const out: LineData[] = []
  let lastT = -Infinity
  for (const p of sorted) {
    if (p.time <= lastT) continue
    out.push({ time: p.time as Time, value: p.value })
    lastT = p.time
  }
  return out
}

function toHist(pts: LinePoint[], colorUp: string, colorDown: string): HistogramData[] {
  const sorted = pts
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time)
  const out: HistogramData[] = []
  let lastT = -Infinity
  for (const p of sorted) {
    if (p.time <= lastT) continue
    out.push({
      time: p.time as Time,
      value: p.value,
      color: p.value >= 0 ? colorUp : colorDown,
    })
    lastT = p.time
  }
  return out
}

/** Color each segment by supertrend direction map */
function toLineColored(
  pts: LinePoint[],
  dir: Map<number, number>,
  bull: string,
  bear: string
): LineData[] {
  const sorted = pts
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time)
  const out: LineData[] = []
  let lastT = -Infinity
  for (const p of sorted) {
    if (p.time <= lastT) continue
    const d = dir.get(p.time) ?? 1
    out.push({
      time: p.time as Time,
      value: p.value,
      color: d >= 0 ? bull : bear,
    })
    lastT = p.time
  }
  return out
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
        /* */
      }
    }
    for (const s of this.hists.values()) {
      try {
        this.chart.removeSeries(s)
      } catch {
        /* */
      }
    }
    this.lines.clear()
    this.hists.clear()
  }

  private line(
    key: string,
    color: string,
    priceScaleId: string,
    lineWidth = 2
  ): LineSeries | null {
    if (!this.chart) return null
    let s = this.lines.get(key)
    const w = Math.min(4, Math.max(1, lineWidth | 0)) as 1 | 2 | 3 | 4
    if (!s) {
      try {
        s = this.chart.addLineSeries({
          color,
          lineWidth: w,
          priceScaleId,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        })
        this.lines.set(key, s)
      } catch (e) {
        console.warn('[IndicatorSeries] addLine', key, e)
        return null
      }
    } else {
      try {
        s.applyOptions({ color, lineWidth: w })
      } catch {
        /* */
      }
    }
    return s
  }

  private hist(key: string, priceScaleId: string): HistSeries | null {
    if (!this.chart) return null
    let s = this.hists.get(key)
    if (!s) {
      try {
        s = this.chart.addHistogramSeries({
          priceScaleId,
          base: 0,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        this.hists.set(key, s)
      } catch (e) {
        console.warn('[IndicatorSeries] addHist', key, e)
        return null
      }
    }
    return s
  }

  private ensurePane(scaleId: string, margins: { top: number; bottom: number }) {
    try {
      this.chart?.priceScale(scaleId).applyOptions({
        scaleMargins: margins,
        visible: false,
      })
    } catch {
      /* */
    }
  }

  private safeSetLine(s: LineSeries | null, data: LineData[]) {
    if (!s) return
    try {
      s.setData(data)
    } catch (e) {
      console.warn('[IndicatorSeries] setData line', e)
      try {
        s.setData([])
      } catch {
        /* */
      }
    }
  }

  private safeSetHist(s: HistSeries | null, data: HistogramData[]) {
    if (!s) return
    try {
      s.setData(data)
    } catch (e) {
      console.warn('[IndicatorSeries] setData hist', e)
      try {
        s.setData([])
      } catch {
        /* */
      }
    }
  }

  apply(candles: Candle[], params: IndicatorParamsMap) {
    if (!this.chart) return
    try {
      this.applyInner(candles, params)
    } catch (e) {
      console.error('[IndicatorSeries] apply failed', e)
    }
  }

  private applyInner(candles: Candle[], params: IndicatorParamsMap) {
    if (!this.chart) return
    if (candles.length === 0) {
      this.clearAllSeries()
      return
    }

    const activeKeys = new Set<string>()

    const keepLine = (
      key: string,
      color: string,
      scale: string,
      pts: LinePoint[],
      width = 2
    ) => {
      activeKeys.add(key)
      const s = this.line(key, color, scale, width)
      this.safeSetLine(s, toLine(pts))
    }

    const keepLineData = (
      key: string,
      color: string,
      scale: string,
      data: LineData[],
      width = 2
    ) => {
      activeKeys.add(key)
      const s = this.line(key, color, scale, width)
      this.safeSetLine(s, data)
    }

    const keepHist = (
      key: string,
      scale: string,
      pts: LinePoint[],
      up: string,
      down: string
    ) => {
      activeKeys.add(`h:${key}`)
      const s = this.hist(key, scale)
      this.safeSetHist(s, toHist(pts, up, down))
    }

    // ── MA ──────────────────────────────────────────────
    if (params.sma.visible) {
      const p = params.sma
      if (p.show1 && p.period > 0)
        keepLine('sma1', p.color, 'right', computeSma(candles, p.period, p.source), p.lineWidth)
      if (p.show2 && p.period2 > 0)
        keepLine('sma2', p.color2, 'right', computeSma(candles, p.period2, p.source), p.lineWidth2)
      if (p.show3 && p.period3 > 0)
        keepLine('sma3', p.color3, 'right', computeSma(candles, p.period3, p.source), p.lineWidth3)
    }
    if (params.ema.visible) {
      const p = params.ema
      if (p.show1 && p.period > 0)
        keepLine('ema1', p.color, 'right', computeEma(candles, p.period, p.source), p.lineWidth)
      if (p.show2 && p.period2 > 0)
        keepLine('ema2', p.color2, 'right', computeEma(candles, p.period2, p.source), p.lineWidth2)
      if (p.show3 && p.period3 > 0)
        keepLine('ema3', p.color3, 'right', computeEma(candles, p.period3, p.source), p.lineWidth3)
    }
    if (params.wma.visible) {
      const p = params.wma
      keepLine('wma', p.color, 'right', computeWma(candles, Math.max(2, p.period), p.source), p.lineWidth)
    }
    if (params.hull.visible) {
      const p = params.hull
      keepLine('hull', p.color, 'right', computeHull(candles, Math.max(2, p.period), p.source), p.lineWidth)
    }
    if (params.dema.visible) {
      const p = params.dema
      keepLine('dema', p.color, 'right', computeDema(candles, Math.max(2, p.period), p.source), p.lineWidth)
    }
    if (params.tema.visible) {
      const p = params.tema
      keepLine('tema', p.color, 'right', computeTema(candles, Math.max(2, p.period), p.source), p.lineWidth)
    }

    // ── Bands ───────────────────────────────────────────
    if (params.bb.visible) {
      const p = params.bb
      const bb = computeBollinger(candles, Math.max(2, p.period), Math.max(0.1, p.mult), p.source)
      if (p.show2) keepLine('bb-mid', p.color2, 'right', bb.mid, p.lineWidth)
      if (p.show1) keepLine('bb-up', p.color, 'right', bb.upper, p.lineWidth)
      if (p.show3) keepLine('bb-lo', p.color3, 'right', bb.lower, p.lineWidth)
    }
    if (params.donchian.visible) {
      const p = params.donchian
      const d = computeDonchian(candles, Math.max(2, p.period))
      if (p.show2) keepLine('dc-mid', p.color2, 'right', d.mid, p.lineWidth)
      if (p.show1) keepLine('dc-up', p.color, 'right', d.upper, p.lineWidth)
      if (p.show3) keepLine('dc-lo', p.color3, 'right', d.lower, p.lineWidth)
    }
    if (params.keltner.visible) {
      const p = params.keltner
      const k = computeKeltner(
        candles,
        Math.max(2, p.period),
        Math.max(1, p.period2 || 10),
        Math.max(0.1, p.mult),
        p.source
      )
      if (p.show2) keepLine('kc-mid', p.color2, 'right', k.mid, p.lineWidth)
      if (p.show1) keepLine('kc-up', p.color, 'right', k.upper, p.lineWidth)
      if (p.show3) keepLine('kc-lo', p.color3, 'right', k.lower, p.lineWidth)
    }

    // ── Trend ───────────────────────────────────────────
    if (params.supertrend.visible) {
      const p = params.supertrend
      const st = computeSupertrend(candles, Math.max(2, p.period), Math.max(0.5, p.mult))
      const dir = new Map(st.dir.map((d) => [d.time, d.value]))
      keepLineData(
        'st',
        p.color,
        'right',
        toLineColored(st.line, dir, p.color, p.color2),
        p.lineWidth
      )
    }
    if (params.sar.visible) {
      const p = params.sar
      keepLine(
        'sar',
        p.color,
        'right',
        computeSar(candles, Math.max(0.001, p.mult), Math.max(0.01, p.mult2)),
        1
      )
    }
    if (params.ichimoku.visible) {
      const p = params.ichimoku
      const ich = computeIchimoku(
        candles,
        Math.max(2, p.period),
        Math.max(2, p.period2),
        Math.max(2, p.period3)
      )
      if (p.show1) keepLine('ichi-ten', p.color, 'right', ich.conversion, p.lineWidth)
      if (p.show2) keepLine('ichi-kij', p.color2, 'right', ich.base, p.lineWidth)
      if (p.show3) {
        keepLine('ichi-spa', p.color3, 'right', ich.spanA, 1)
        keepLine('ichi-spb', '#64748b', 'right', ich.spanB, 1)
      }
    }

    if (params.vwap.visible) {
      const p = params.vwap
      keepLine('vwap', p.color, 'right', computeVwap(candles), p.lineWidth)
    }

    // ── Pane oscillators ────────────────────────────────
    if (params.volsma.visible) {
      this.ensurePane('ind-vol', { top: 0.8, bottom: 0 })
      const p = params.volsma
      const v = computeVolSma(candles, Math.max(1, p.period))
      if (p.show1) keepHist('vol-raw', 'ind-vol', v.volume, p.color, p.color)
      if (p.show2) keepLine('vol-sma', p.color2, 'ind-vol', v.sma, 2)
    }

    if (params.rsi.visible) {
      this.ensurePane('ind-rsi', { top: 0.82, bottom: 0 })
      const p = params.rsi
      keepLine('rsi', p.color, 'ind-rsi', computeRsi(candles, Math.max(2, p.period), p.source), p.lineWidth)
      if (p.show2) {
        keepLine('rsi-hi', p.color2, 'ind-rsi', levelLine(candles, p.levelHigh), 1)
        keepLine('rsi-lo', p.color2, 'ind-rsi', levelLine(candles, p.levelLow), 1)
      }
    }

    if (params.macd.visible) {
      this.ensurePane('ind-macd', { top: 0.78, bottom: 0 })
      const p = params.macd
      let fast = Math.max(2, p.period | 0)
      let slow = Math.max(3, p.period2 | 0)
      const signal = Math.max(2, p.period3 | 0)
      if (fast >= slow) slow = fast + 1
      const m = computeMacd(candles, fast, slow, signal, p.source)
      if (p.show1) keepLine('macd', p.color, 'ind-macd', m.macd, p.lineWidth)
      if (p.show2) keepLine('macd-sig', p.color2, 'ind-macd', m.signal, p.lineWidth2)
      if (p.show3)
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
      if (p.show1) keepLine('stoch-k', p.color, 'ind-stoch', s.k, p.lineWidth)
      if (p.show2) keepLine('stoch-d', p.color2, 'ind-stoch', s.d, p.lineWidth2)
      if (p.show3) {
        keepLine('stoch-hi', p.color3, 'ind-stoch', levelLine(candles, p.levelHigh), 1)
        keepLine('stoch-lo', p.color3, 'ind-stoch', levelLine(candles, p.levelLow), 1)
      }
    }

    if (params.cci.visible) {
      this.ensurePane('ind-cci', { top: 0.82, bottom: 0 })
      const p = params.cci
      keepLine('cci', p.color, 'ind-cci', computeCci(candles, Math.max(2, p.period)), p.lineWidth)
      if (p.show2) {
        keepLine('cci-hi', p.color2, 'ind-cci', levelLine(candles, p.levelHigh), 1)
        keepLine('cci-lo', p.color2, 'ind-cci', levelLine(candles, p.levelLow), 1)
      }
    }

    if (params.willr.visible) {
      this.ensurePane('ind-willr', { top: 0.82, bottom: 0 })
      const p = params.willr
      keepLine('willr', p.color, 'ind-willr', computeWillR(candles, Math.max(2, p.period)), p.lineWidth)
      if (p.show2) {
        keepLine('willr-hi', p.color2, 'ind-willr', levelLine(candles, p.levelHigh), 1)
        keepLine('willr-lo', p.color2, 'ind-willr', levelLine(candles, p.levelLow), 1)
      }
    }

    if (params.momentum.visible) {
      this.ensurePane('ind-mom', { top: 0.82, bottom: 0 })
      const p = params.momentum
      keepLine(
        'mom',
        p.color,
        'ind-mom',
        computeMomentum(candles, Math.max(1, p.period), p.source),
        p.lineWidth
      )
    }

    if (params.roc.visible) {
      this.ensurePane('ind-roc', { top: 0.82, bottom: 0 })
      const p = params.roc
      keepLine('roc', p.color, 'ind-roc', computeRoc(candles, Math.max(1, p.period), p.source), p.lineWidth)
    }

    if (params.atr.visible) {
      this.ensurePane('ind-atr', { top: 0.85, bottom: 0 })
      const p = params.atr
      keepLine('atr', p.color, 'ind-atr', computeAtr(candles, Math.max(2, p.period)), p.lineWidth)
    }

    if (params.adx.visible) {
      this.ensurePane('ind-adx', { top: 0.8, bottom: 0 })
      const p = params.adx
      const a = computeAdx(candles, Math.max(2, p.period))
      if (p.show1) keepLine('adx', p.color, 'ind-adx', a.adx, p.lineWidth)
      if (p.show2) keepLine('adx-pdi', p.color2, 'ind-adx', a.plusDI, 1)
      if (p.show3) keepLine('adx-mdi', p.color3, 'ind-adx', a.minusDI, 1)
    }

    if (params.obv.visible) {
      this.ensurePane('ind-obv', { top: 0.82, bottom: 0 })
      const p = params.obv
      keepLine('obv', p.color, 'ind-obv', computeObv(candles), p.lineWidth)
    }

    if (params.mfi.visible) {
      this.ensurePane('ind-mfi', { top: 0.82, bottom: 0 })
      const p = params.mfi
      keepLine('mfi', p.color, 'ind-mfi', computeMfi(candles, Math.max(2, p.period)), p.lineWidth)
      if (p.show2) {
        keepLine('mfi-hi', p.color2, 'ind-mfi', levelLine(candles, p.levelHigh), 1)
        keepLine('mfi-lo', p.color2, 'ind-mfi', levelLine(candles, p.levelLow), 1)
      }
    }

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
