/**
 * Lightweight Charts series for technical indicators.
 * lastValueVisible + title so numeric values (RSI, MACD…) are readable.
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
  computeVwma,
  computeAlma,
  computeEnvelope,
  computeStdDev,
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
          priceScaleId,
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
        s.applyOptions({
          color,
          lineWidth: w,
          title,
          lastValueVisible: showValue,
          crosshairMarkerVisible: true,
        })
      } catch {
        /* */
      }
    }
    return s
  }

  private hist(key: string, priceScaleId: string, title = ''): HistSeries | null {
    if (!this.chart) return null
    let s = this.hists.get(key)
    if (!s) {
      try {
        s = this.chart.addHistogramSeries({
          priceScaleId,
          base: 0,
          title,
          lastValueVisible: true,
          priceLineVisible: false,
        })
        this.hists.set(key, s)
      } catch (e) {
        console.warn('[IndicatorSeries] addHist', key, e)
        return null
      }
    } else {
      try {
        s.applyOptions({ title, lastValueVisible: true })
      } catch {
        /* */
      }
    }
    return s
  }

  private ensurePane(scaleId: string, margins: { top: number; bottom: number }) {
    try {
      this.chart?.priceScale(scaleId).applyOptions({
        scaleMargins: margins,
        visible: true,
        borderVisible: false,
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
      width = 2,
      title = '',
      showValue = true
    ) => {
      activeKeys.add(key)
      const s = this.line(key, color, scale, width, { title, showValue })
      this.safeSetLine(s, toLine(pts))
    }

    const keepLineData = (
      key: string,
      color: string,
      scale: string,
      data: LineData[],
      width = 2,
      title = ''
    ) => {
      activeKeys.add(key)
      const s = this.line(key, color, scale, width, { title, showValue: true })
      this.safeSetLine(s, data)
    }

    const keepHist = (
      key: string,
      scale: string,
      pts: LinePoint[],
      up: string,
      down: string,
      title = ''
    ) => {
      activeKeys.add(`h:${key}`)
      const s = this.hist(key, scale, title)
      this.safeSetHist(s, toHist(pts, up, down))
    }

    const p = params

    if (p.sma.visible) {
      const x = p.sma
      if (x.show1 && x.period > 0)
        keepLine('sma1', x.color, 'right', computeSma(candles, x.period, x.source), x.lineWidth, `SMA${x.period}`, x.showValue)
      if (x.show2 && x.period2 > 0)
        keepLine('sma2', x.color2, 'right', computeSma(candles, x.period2, x.source), x.lineWidth2, `SMA${x.period2}`, x.showValue)
      if (x.show3 && x.period3 > 0)
        keepLine('sma3', x.color3, 'right', computeSma(candles, x.period3, x.source), x.lineWidth3, `SMA${x.period3}`, x.showValue)
    }
    if (p.ema.visible) {
      const x = p.ema
      if (x.show1 && x.period > 0)
        keepLine('ema1', x.color, 'right', computeEma(candles, x.period, x.source), x.lineWidth, `EMA${x.period}`, x.showValue)
      if (x.show2 && x.period2 > 0)
        keepLine('ema2', x.color2, 'right', computeEma(candles, x.period2, x.source), x.lineWidth2, `EMA${x.period2}`, x.showValue)
      if (x.show3 && x.period3 > 0)
        keepLine('ema3', x.color3, 'right', computeEma(candles, x.period3, x.source), x.lineWidth3, `EMA${x.period3}`, x.showValue)
    }
    if (p.wma.visible)
      keepLine('wma', p.wma.color, 'right', computeWma(candles, Math.max(2, p.wma.period), p.wma.source), p.wma.lineWidth, 'WMA', p.wma.showValue)
    if (p.vwma?.visible)
      keepLine('vwma', p.vwma.color, 'right', computeVwma(candles, Math.max(2, p.vwma.period), p.vwma.source), p.vwma.lineWidth, 'VWMA', p.vwma.showValue)
    if (p.alma?.visible)
      keepLine('alma', p.alma.color, 'right', computeAlma(candles, Math.max(2, p.alma.period), p.alma.mult || 0.85, p.alma.mult2 || 6, p.alma.source), p.alma.lineWidth, 'ALMA', p.alma.showValue)
    if (p.hull.visible)
      keepLine('hull', p.hull.color, 'right', computeHull(candles, Math.max(2, p.hull.period), p.hull.source), p.hull.lineWidth, 'HMA', p.hull.showValue)
    if (p.dema.visible)
      keepLine('dema', p.dema.color, 'right', computeDema(candles, Math.max(2, p.dema.period), p.dema.source), p.dema.lineWidth, 'DEMA', p.dema.showValue)
    if (p.tema.visible)
      keepLine('tema', p.tema.color, 'right', computeTema(candles, Math.max(2, p.tema.period), p.tema.source), p.tema.lineWidth, 'TEMA', p.tema.showValue)

    if (p.bb.visible) {
      const x = p.bb
      const bb = computeBollinger(candles, Math.max(2, x.period), Math.max(0.1, x.mult), x.source)
      if (x.show2) keepLine('bb-mid', x.color2, 'right', bb.mid, x.lineWidth, 'BB mid', x.showValue)
      if (x.show1) keepLine('bb-up', x.color, 'right', bb.upper, x.lineWidth, 'BB up', false)
      if (x.show3) keepLine('bb-lo', x.color3, 'right', bb.lower, x.lineWidth, 'BB lo', false)
    }
    if (p.donchian.visible) {
      const x = p.donchian
      const d = computeDonchian(candles, Math.max(2, x.period))
      if (x.show2) keepLine('dc-mid', x.color2, 'right', d.mid, x.lineWidth, 'DC mid', x.showValue)
      if (x.show1) keepLine('dc-up', x.color, 'right', d.upper, x.lineWidth, 'DC up', false)
      if (x.show3) keepLine('dc-lo', x.color3, 'right', d.lower, x.lineWidth, 'DC lo', false)
    }
    if (p.keltner.visible) {
      const x = p.keltner
      const k = computeKeltner(candles, Math.max(2, x.period), Math.max(1, x.period2 || 10), Math.max(0.1, x.mult), x.source)
      if (x.show2) keepLine('kc-mid', x.color2, 'right', k.mid, x.lineWidth, 'KC mid', x.showValue)
      if (x.show1) keepLine('kc-up', x.color, 'right', k.upper, x.lineWidth, 'KC up', false)
      if (x.show3) keepLine('kc-lo', x.color3, 'right', k.lower, x.lineWidth, 'KC lo', false)
    }
    if (p.envelope?.visible) {
      const x = p.envelope
      const e = computeEnvelope(candles, Math.max(2, x.period), Math.max(0.1, x.mult), x.source)
      if (x.show2) keepLine('env-mid', x.color2, 'right', e.mid, x.lineWidth, 'Env', x.showValue)
      if (x.show1) keepLine('env-up', x.color, 'right', e.upper, x.lineWidth, 'Env+', false)
      if (x.show3) keepLine('env-lo', x.color3, 'right', e.lower, x.lineWidth, 'Env-', false)
    }

    if (p.supertrend.visible) {
      const x = p.supertrend
      const st = computeSupertrend(candles, Math.max(2, x.period), Math.max(0.5, x.mult))
      const dir = new Map(st.dir.map((d) => [d.time, d.value]))
      keepLineData('st', x.color, 'right', toLineColored(st.line, dir, x.color, x.color2), x.lineWidth, 'ST')
    }
    if (p.sar.visible)
      keepLine('sar', p.sar.color, 'right', computeSar(candles, Math.max(0.001, p.sar.mult), Math.max(0.01, p.sar.mult2)), 1, 'SAR', p.sar.showValue)
    if (p.ichimoku.visible) {
      const x = p.ichimoku
      const ich = computeIchimoku(candles, Math.max(2, x.period), Math.max(2, x.period2), Math.max(2, x.period3))
      if (x.show1) keepLine('ichi-ten', x.color, 'right', ich.conversion, x.lineWidth, 'Tenkan', x.showValue)
      if (x.show2) keepLine('ichi-kij', x.color2, 'right', ich.base, x.lineWidth, 'Kijun', x.showValue)
      if (x.show3) {
        keepLine('ichi-spa', x.color3, 'right', ich.spanA, 1, 'SpanA', false)
        keepLine('ichi-spb', '#64748b', 'right', ich.spanB, 1, 'SpanB', false)
      }
    }
    if (p.pivots?.visible) {
      const pv = computePivots(candles)
      keepLine('piv-p', p.pivots.color, 'right', pv.p, 1, 'P', p.pivots.showValue)
      if (p.pivots.show1) {
        keepLine('piv-r1', p.pivots.color2, 'right', pv.r1, 1, 'R1', false)
        keepLine('piv-r2', p.pivots.color2, 'right', pv.r2, 1, 'R2', false)
      }
      if (p.pivots.show3) {
        keepLine('piv-s1', p.pivots.color3, 'right', pv.s1, 1, 'S1', false)
        keepLine('piv-s2', p.pivots.color3, 'right', pv.s2, 1, 'S2', false)
      }
    }
    if (p.vwap.visible)
      keepLine('vwap', p.vwap.color, 'right', computeVwap(candles), p.vwap.lineWidth, 'VWAP', p.vwap.showValue)

    // Panes
    if (p.volsma.visible) {
      this.ensurePane('ind-vol', { top: 0.8, bottom: 0 })
      const x = p.volsma
      const v = computeVolSma(candles, Math.max(1, x.period))
      if (x.show1) keepHist('vol-raw', 'ind-vol', v.volume, x.color, x.color, 'Vol')
      if (x.show2) keepLine('vol-sma', x.color2, 'ind-vol', v.sma, 2, 'VolSMA', x.showValue)
    }
    if (p.rsi.visible) {
      this.ensurePane('ind-rsi', { top: 0.78, bottom: 0 })
      const x = p.rsi
      keepLine('rsi', x.color, 'ind-rsi', computeRsi(candles, Math.max(2, x.period), x.source), x.lineWidth, `RSI(${x.period})`, x.showValue)
      if (x.show2) {
        keepLine('rsi-hi', x.color2, 'ind-rsi', levelLine(candles, x.levelHigh), 1, String(x.levelHigh), false)
        keepLine('rsi-lo', x.color2, 'ind-rsi', levelLine(candles, x.levelLow), 1, String(x.levelLow), false)
      }
    }
    if (p.macd.visible) {
      this.ensurePane('ind-macd', { top: 0.75, bottom: 0 })
      const x = p.macd
      let fast = Math.max(2, x.period | 0)
      let slow = Math.max(3, x.period2 | 0)
      const signal = Math.max(2, x.period3 | 0)
      if (fast >= slow) slow = fast + 1
      const m = computeMacd(candles, fast, slow, signal, x.source)
      if (x.show1) keepLine('macd', x.color, 'ind-macd', m.macd, x.lineWidth, 'MACD', x.showValue)
      if (x.show2) keepLine('macd-sig', x.color2, 'ind-macd', m.signal, x.lineWidth2, 'Signal', x.showValue)
      if (x.show3) keepHist('macd-hist', 'ind-macd', m.hist, 'rgba(14,203,129,0.5)', 'rgba(246,70,93,0.5)', 'Hist')
    }
    if (p.stoch.visible) {
      this.ensurePane('ind-stoch', { top: 0.78, bottom: 0 })
      const x = p.stoch
      const s = computeStoch(candles, Math.max(2, x.period), Math.max(1, x.period2), Math.max(1, x.period3))
      if (x.show1) keepLine('stoch-k', x.color, 'ind-stoch', s.k, x.lineWidth, '%K', x.showValue)
      if (x.show2) keepLine('stoch-d', x.color2, 'ind-stoch', s.d, x.lineWidth2, '%D', x.showValue)
      if (x.show3) {
        keepLine('stoch-hi', x.color3, 'ind-stoch', levelLine(candles, x.levelHigh), 1, '', false)
        keepLine('stoch-lo', x.color3, 'ind-stoch', levelLine(candles, x.levelLow), 1, '', false)
      }
    }
    if (p.cci.visible) {
      this.ensurePane('ind-cci', { top: 0.78, bottom: 0 })
      const x = p.cci
      keepLine('cci', x.color, 'ind-cci', computeCci(candles, Math.max(2, x.period)), x.lineWidth, 'CCI', x.showValue)
      if (x.show2) {
        keepLine('cci-hi', x.color2, 'ind-cci', levelLine(candles, x.levelHigh), 1, '', false)
        keepLine('cci-lo', x.color2, 'ind-cci', levelLine(candles, x.levelLow), 1, '', false)
      }
    }
    if (p.willr.visible) {
      this.ensurePane('ind-willr', { top: 0.78, bottom: 0 })
      const x = p.willr
      keepLine('willr', x.color, 'ind-willr', computeWillR(candles, Math.max(2, x.period)), x.lineWidth, '%R', x.showValue)
      if (x.show2) {
        keepLine('willr-hi', x.color2, 'ind-willr', levelLine(candles, x.levelHigh), 1, '', false)
        keepLine('willr-lo', x.color2, 'ind-willr', levelLine(candles, x.levelLow), 1, '', false)
      }
    }
    if (p.momentum.visible) {
      this.ensurePane('ind-mom', { top: 0.78, bottom: 0 })
      keepLine('mom', p.momentum.color, 'ind-mom', computeMomentum(candles, Math.max(1, p.momentum.period), p.momentum.source), p.momentum.lineWidth, 'Mom', p.momentum.showValue)
    }
    if (p.roc.visible) {
      this.ensurePane('ind-roc', { top: 0.78, bottom: 0 })
      keepLine('roc', p.roc.color, 'ind-roc', computeRoc(candles, Math.max(1, p.roc.period), p.roc.source), p.roc.lineWidth, 'ROC', p.roc.showValue)
    }
    if (p.atr.visible) {
      this.ensurePane('ind-atr', { top: 0.82, bottom: 0 })
      keepLine('atr', p.atr.color, 'ind-atr', computeAtr(candles, Math.max(2, p.atr.period)), p.atr.lineWidth, 'ATR', p.atr.showValue)
    }
    if (p.adx.visible) {
      this.ensurePane('ind-adx', { top: 0.76, bottom: 0 })
      const a = computeAdx(candles, Math.max(2, p.adx.period))
      if (p.adx.show1) keepLine('adx', p.adx.color, 'ind-adx', a.adx, p.adx.lineWidth, 'ADX', p.adx.showValue)
      if (p.adx.show2) keepLine('adx-pdi', p.adx.color2, 'ind-adx', a.plusDI, 1, '+DI', p.adx.showValue)
      if (p.adx.show3) keepLine('adx-mdi', p.adx.color3, 'ind-adx', a.minusDI, 1, '-DI', p.adx.showValue)
    }
    if (p.obv.visible) {
      this.ensurePane('ind-obv', { top: 0.78, bottom: 0 })
      keepLine('obv', p.obv.color, 'ind-obv', computeObv(candles), p.obv.lineWidth, 'OBV', p.obv.showValue)
    }
    if (p.mfi.visible) {
      this.ensurePane('ind-mfi', { top: 0.78, bottom: 0 })
      keepLine('mfi', p.mfi.color, 'ind-mfi', computeMfi(candles, Math.max(2, p.mfi.period)), p.mfi.lineWidth, 'MFI', p.mfi.showValue)
      if (p.mfi.show2) {
        keepLine('mfi-hi', p.mfi.color2, 'ind-mfi', levelLine(candles, p.mfi.levelHigh), 1, '', false)
        keepLine('mfi-lo', p.mfi.color2, 'ind-mfi', levelLine(candles, p.mfi.levelLow), 1, '', false)
      }
    }
    if (p.ao?.visible) {
      this.ensurePane('ind-ao', { top: 0.78, bottom: 0 })
      keepHist('ao', 'ind-ao', computeAo(candles, Math.max(2, p.ao.period), Math.max(3, p.ao.period2)), 'rgba(14,203,129,0.7)', 'rgba(246,70,93,0.7)', 'AO')
    }
    if (p.trix?.visible) {
      this.ensurePane('ind-trix', { top: 0.78, bottom: 0 })
      keepLine('trix', p.trix.color, 'ind-trix', computeTrix(candles, Math.max(2, p.trix.period), p.trix.source), p.trix.lineWidth, 'TRIX', p.trix.showValue)
    }
    if (p.ppo?.visible) {
      this.ensurePane('ind-ppo', { top: 0.76, bottom: 0 })
      let f = Math.max(2, p.ppo.period)
      let s = Math.max(3, p.ppo.period2)
      if (f >= s) s = f + 1
      const pp = computePpo(candles, f, s, Math.max(2, p.ppo.period3), p.ppo.source)
      keepLine('ppo', p.ppo.color, 'ind-ppo', pp.ppo, p.ppo.lineWidth, 'PPO', p.ppo.showValue)
      keepLine('ppo-sig', p.ppo.color2, 'ind-ppo', pp.signal, 1, 'Sig', p.ppo.showValue)
    }
    if (p.aroon?.visible) {
      this.ensurePane('ind-aroon', { top: 0.78, bottom: 0 })
      const a = computeAroon(candles, Math.max(2, p.aroon.period))
      keepLine('aroon-up', p.aroon.color, 'ind-aroon', a.up, p.aroon.lineWidth, 'Aroon↑', p.aroon.showValue)
      keepLine('aroon-dn', p.aroon.color2, 'ind-aroon', a.down, 1, 'Aroon↓', p.aroon.showValue)
    }
    if (p.dpo?.visible) {
      this.ensurePane('ind-dpo', { top: 0.78, bottom: 0 })
      keepLine('dpo', p.dpo.color, 'ind-dpo', computeDpo(candles, Math.max(2, p.dpo.period), p.dpo.source), p.dpo.lineWidth, 'DPO', p.dpo.showValue)
    }
    if (p.cmf?.visible) {
      this.ensurePane('ind-cmf', { top: 0.78, bottom: 0 })
      keepLine('cmf', p.cmf.color, 'ind-cmf', computeCmf(candles, Math.max(2, p.cmf.period)), p.cmf.lineWidth, 'CMF', p.cmf.showValue)
    }
    if (p.adl?.visible) {
      this.ensurePane('ind-adl', { top: 0.78, bottom: 0 })
      keepLine('adl', p.adl.color, 'ind-adl', computeAdl(candles), p.adl.lineWidth, 'ADL', p.adl.showValue)
    }
    if (p.force?.visible) {
      this.ensurePane('ind-fi', { top: 0.78, bottom: 0 })
      keepLine('fi', p.force.color, 'ind-fi', computeForce(candles, Math.max(2, p.force.period)), p.force.lineWidth, 'FI', p.force.showValue)
    }
    if (p.elderray?.visible) {
      this.ensurePane('ind-elder', { top: 0.76, bottom: 0 })
      const er = computeElderRay(candles, Math.max(2, p.elderray.period))
      keepHist('elder-bull', 'ind-elder', er.bull, p.elderray.color, p.elderray.color, 'Bull')
      keepHist('elder-bear', 'ind-elder', er.bear, p.elderray.color2, p.elderray.color2, 'Bear')
    }
    if (p.uo?.visible) {
      this.ensurePane('ind-uo', { top: 0.78, bottom: 0 })
      keepLine('uo', p.uo.color, 'ind-uo', computeUo(candles, Math.max(2, p.uo.period), Math.max(2, p.uo.period2), Math.max(2, p.uo.period3)), p.uo.lineWidth, 'UO', p.uo.showValue)
    }
    if (p.cmo?.visible) {
      this.ensurePane('ind-cmo', { top: 0.78, bottom: 0 })
      keepLine('cmo', p.cmo.color, 'ind-cmo', computeCmo(candles, Math.max(2, p.cmo.period), p.cmo.source), p.cmo.lineWidth, 'CMO', p.cmo.showValue)
    }
    if (p.rvi?.visible) {
      this.ensurePane('ind-rvi', { top: 0.78, bottom: 0 })
      const r = computeRvi(candles, Math.max(2, p.rvi.period), Math.max(1, p.rvi.period2))
      keepLine('rvi', p.rvi.color, 'ind-rvi', r.rvi, p.rvi.lineWidth, 'RVI', p.rvi.showValue)
      keepLine('rvi-sig', p.rvi.color2, 'ind-rvi', r.signal, 1, 'Sig', p.rvi.showValue)
    }
    if (p.stddev?.visible) {
      this.ensurePane('ind-std', { top: 0.82, bottom: 0 })
      keepLine('std', p.stddev.color, 'ind-std', computeStdDev(candles, Math.max(2, p.stddev.period), p.stddev.source), p.stddev.lineWidth, 'σ', p.stddev.showValue)
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
