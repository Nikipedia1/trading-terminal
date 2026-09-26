/**
 * Overlay indicators on the MAIN price chart only.
 * Pane oscillators (RSI, MACD, …) are rendered below in IndicatorPanes.
 */

import {
  type IChartApi,
  type ISeriesApi,
  type LineData,
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
  computeVwma,
  computeAlma,
  computeEnvelope,
  computePivots,
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
    out.push({ time: p.time as Time, value: p.value, color: d >= 0 ? bull : bear })
    lastT = p.time
  }
  return out
}

type LineSeries = ISeriesApi<'Line'>

export class IndicatorSeriesManager {
  private chart: IChartApi | null = null
  private lines = new Map<string, LineSeries>()

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
      return
    }
    for (const s of this.lines.values()) {
      try {
        this.chart.removeSeries(s)
      } catch {
        /* */
      }
    }
    this.lines.clear()
  }

  private line(
    key: string,
    color: string,
    lineWidth = 2,
    opts?: { title?: string; showValue?: boolean }
  ): LineSeries | null {
    if (!this.chart) return null
    let s = this.lines.get(key)
    const w = Math.min(4, Math.max(1, lineWidth | 0)) as 1 | 2 | 3 | 4
    const showValue = opts?.showValue !== false
    const title = opts?.title ?? ''
    if (!s) {
      try {
        s = this.chart.addLineSeries({
          color,
          lineWidth: w,
          priceScaleId: 'right',
          title,
          lastValueVisible: showValue,
          priceLineVisible: false,
          crosshairMarkerVisible: true,
        })
        this.lines.set(key, s)
      } catch (e) {
        console.warn('[IndicatorSeries] addLine', key, e)
        return null
      }
    } else {
      try {
        s.applyOptions({ color, lineWidth: w, title, lastValueVisible: showValue })
      } catch {
        /* */
      }
    }
    return s
  }

  private safeSet(s: LineSeries | null, data: LineData[]) {
    if (!s) return
    try {
      s.setData(data)
    } catch {
      try {
        s.setData([])
      } catch {
        /* */
      }
    }
  }

  /** Overlay-only (SMA, BB, VWAP, …). Pane oscillators handled by IndicatorPanes. */
  apply(candles: Candle[], params: IndicatorParamsMap) {
    if (!this.chart) return
    try {
      this.applyOverlay(candles, params)
    } catch (e) {
      console.error('[IndicatorSeries] apply failed', e)
    }
  }

  private applyOverlay(candles: Candle[], params: IndicatorParamsMap) {
    if (!this.chart) return
    if (candles.length === 0) {
      this.clearAllSeries()
      return
    }

    const active = new Set<string>()
    const keep = (
      key: string,
      color: string,
      pts: LinePoint[],
      width = 2,
      title = '',
      showValue = true
    ) => {
      active.add(key)
      this.safeSet(this.line(key, color, width, { title, showValue }), toLine(pts))
    }
    const keepData = (key: string, color: string, data: LineData[], width = 2, title = '') => {
      active.add(key)
      this.safeSet(this.line(key, color, width, { title, showValue: true }), data)
    }

    const p = params

    if (p.sma.visible) {
      const x = p.sma
      if (x.show1 && x.period > 0)
        keep('sma1', x.color, computeSma(candles, x.period, x.source), x.lineWidth, `SMA${x.period}`, x.showValue)
      if (x.show2 && x.period2 > 0)
        keep('sma2', x.color2, computeSma(candles, x.period2, x.source), x.lineWidth2, `SMA${x.period2}`, x.showValue)
      if (x.show3 && x.period3 > 0)
        keep('sma3', x.color3, computeSma(candles, x.period3, x.source), x.lineWidth3, `SMA${x.period3}`, x.showValue)
    }
    if (p.ema.visible) {
      const x = p.ema
      if (x.show1 && x.period > 0)
        keep('ema1', x.color, computeEma(candles, x.period, x.source), x.lineWidth, `EMA${x.period}`, x.showValue)
      if (x.show2 && x.period2 > 0)
        keep('ema2', x.color2, computeEma(candles, x.period2, x.source), x.lineWidth2, `EMA${x.period2}`, x.showValue)
      if (x.show3 && x.period3 > 0)
        keep('ema3', x.color3, computeEma(candles, x.period3, x.source), x.lineWidth3, `EMA${x.period3}`, x.showValue)
    }
    if (p.wma.visible)
      keep('wma', p.wma.color, computeWma(candles, Math.max(2, p.wma.period), p.wma.source), p.wma.lineWidth, 'WMA', p.wma.showValue)
    if (p.vwma?.visible)
      keep('vwma', p.vwma.color, computeVwma(candles, Math.max(2, p.vwma.period), p.vwma.source), p.vwma.lineWidth, 'VWMA', p.vwma.showValue)
    if (p.alma?.visible)
      keep('alma', p.alma.color, computeAlma(candles, Math.max(2, p.alma.period), p.alma.mult || 0.85, p.alma.mult2 || 6, p.alma.source), p.alma.lineWidth, 'ALMA', p.alma.showValue)
    if (p.hull.visible)
      keep('hull', p.hull.color, computeHull(candles, Math.max(2, p.hull.period), p.hull.source), p.hull.lineWidth, 'HMA', p.hull.showValue)
    if (p.dema.visible)
      keep('dema', p.dema.color, computeDema(candles, Math.max(2, p.dema.period), p.dema.source), p.dema.lineWidth, 'DEMA', p.dema.showValue)
    if (p.tema.visible)
      keep('tema', p.tema.color, computeTema(candles, Math.max(2, p.tema.period), p.tema.source), p.tema.lineWidth, 'TEMA', p.tema.showValue)

    if (p.bb.visible) {
      const x = p.bb
      const bb = computeBollinger(candles, Math.max(2, x.period), Math.max(0.1, x.mult), x.source)
      if (x.show2) keep('bb-mid', x.color2, bb.mid, x.lineWidth, 'BB mid', x.showValue)
      if (x.show1) keep('bb-up', x.color, bb.upper, x.lineWidth, 'BB up', false)
      if (x.show3) keep('bb-lo', x.color3, bb.lower, x.lineWidth, 'BB lo', false)
    }
    if (p.donchian.visible) {
      const x = p.donchian
      const d = computeDonchian(candles, Math.max(2, x.period))
      if (x.show2) keep('dc-mid', x.color2, d.mid, x.lineWidth, 'DC mid', x.showValue)
      if (x.show1) keep('dc-up', x.color, d.upper, x.lineWidth, 'DC up', false)
      if (x.show3) keep('dc-lo', x.color3, d.lower, x.lineWidth, 'DC lo', false)
    }
    if (p.keltner.visible) {
      const x = p.keltner
      const k = computeKeltner(candles, Math.max(2, x.period), Math.max(1, x.period2 || 10), Math.max(0.1, x.mult), x.source)
      if (x.show2) keep('kc-mid', x.color2, k.mid, x.lineWidth, 'KC mid', x.showValue)
      if (x.show1) keep('kc-up', x.color, k.upper, x.lineWidth, 'KC up', false)
      if (x.show3) keep('kc-lo', x.color3, k.lower, x.lineWidth, 'KC lo', false)
    }
    if (p.envelope?.visible) {
      const x = p.envelope
      const e = computeEnvelope(candles, Math.max(2, x.period), Math.max(0.1, x.mult), x.source)
      if (x.show2) keep('env-mid', x.color2, e.mid, x.lineWidth, 'Env', x.showValue)
      if (x.show1) keep('env-up', x.color, e.upper, x.lineWidth, 'Env+', false)
      if (x.show3) keep('env-lo', x.color3, e.lower, x.lineWidth, 'Env-', false)
    }

    if (p.supertrend.visible) {
      const x = p.supertrend
      const st = computeSupertrend(candles, Math.max(2, x.period), Math.max(0.5, x.mult))
      const dir = new Map(st.dir.map((d) => [d.time, d.value]))
      keepData('st', x.color, toLineColored(st.line, dir, x.color, x.color2), x.lineWidth, 'ST')
    }
    if (p.sar.visible)
      keep('sar', p.sar.color, computeSar(candles, Math.max(0.001, p.sar.mult), Math.max(0.01, p.sar.mult2)), 1, 'SAR', p.sar.showValue)
    if (p.ichimoku.visible) {
      const x = p.ichimoku
      const ich = computeIchimoku(candles, Math.max(2, x.period), Math.max(2, x.period2), Math.max(2, x.period3))
      if (x.show1) keep('ichi-ten', x.color, ich.conversion, x.lineWidth, 'Tenkan', x.showValue)
      if (x.show2) keep('ichi-kij', x.color2, ich.base, x.lineWidth, 'Kijun', x.showValue)
      if (x.show3) {
        keep('ichi-spa', x.color3, ich.spanA, 1, 'SpanA', false)
        keep('ichi-spb', '#64748b', ich.spanB, 1, 'SpanB', false)
      }
    }
    if (p.pivots?.visible) {
      const pv = computePivots(candles)
      keep('piv-p', p.pivots.color, pv.p, 1, 'P', p.pivots.showValue)
      if (p.pivots.show1) {
        keep('piv-r1', p.pivots.color2, pv.r1, 1, 'R1', false)
        keep('piv-r2', p.pivots.color2, pv.r2, 1, 'R2', false)
      }
      if (p.pivots.show3) {
        keep('piv-s1', p.pivots.color3, pv.s1, 1, 'S1', false)
        keep('piv-s2', p.pivots.color3, pv.s2, 1, 'S2', false)
      }
    }
    if (p.vwap.visible)
      keep('vwap', p.vwap.color, computeVwap(candles), p.vwap.lineWidth, 'VWAP', p.vwap.showValue)

    for (const [key, s] of [...this.lines.entries()]) {
      if (!active.has(key)) {
        try {
          this.chart.removeSeries(s)
        } catch {
          /* */
        }
        this.lines.delete(key)
      }
    }
  }
}
