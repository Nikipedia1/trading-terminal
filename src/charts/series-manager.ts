/**
 * Candlestick + volume + delta/CVD series management.
 * Right price scale is driven ONLY by candle OHLC (never volume/delta/cvd).
 */

import { LastPriceAnimationMode } from 'lightweight-charts'
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  Time,
  SeriesMarker,
} from 'lightweight-charts'
import type { Candle } from '@/types'
import type { CandleStyle } from '@/stores/chartStyleStore'
import { DEFAULT_CHART_STYLE } from '@/stores/chartStyleStore'
import type { CandleDeltaBar } from '@/analysis/deepPrint/types'
import type { DivergenceMarker, AbsorptionMarker } from '@/analysis/deltaPrint'

const CVD_COLOR = '#f0b90b'
const DELTA_UP = 'rgba(14, 203, 129, 0.85)'
const DELTA_DOWN = 'rgba(246, 70, 93, 0.85)'

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

/** Adaptive price scale format for any instrument (BTC, SOL, SHIB, …). */
export function inferPriceFormat(refPrice: number): {
  type: 'price'
  precision: number
  minMove: number
} {
  const p = Math.abs(refPrice)
  if (!Number.isFinite(p) || p === 0) {
    return { type: 'price', precision: 2, minMove: 0.01 }
  }
  if (p >= 1000) return { type: 'price', precision: 2, minMove: 0.01 }
  if (p >= 100) return { type: 'price', precision: 2, minMove: 0.01 }
  if (p >= 10) return { type: 'price', precision: 3, minMove: 0.001 }
  if (p >= 1) return { type: 'price', precision: 4, minMove: 0.0001 }
  if (p >= 0.1) return { type: 'price', precision: 5, minMove: 0.00001 }
  if (p >= 0.01) return { type: 'price', precision: 6, minMove: 0.000001 }
  if (p >= 0.0001) return { type: 'price', precision: 8, minMove: 0.00000001 }
  return { type: 'price', precision: 10, minMove: 0.0000000001 }
}

function candlePriceRange(candles: Candle[]): { min: number; max: number } | null {
  let min = Infinity
  let max = -Infinity
  for (const c of candles) {
    if (!Number.isFinite(c.low) || !Number.isFinite(c.high)) continue
    if (c.low <= 0 && c.high <= 0) continue
    if (c.low < min) min = c.low
    if (c.high > max) max = c.high
  }
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return null
  const pad = Math.max((max - min) * 0.02, Math.abs(max) * 0.001)
  return { min: min - pad, max: max + pad }
}

export class SeriesManager {
  private chart: IChartApi | null = null
  private candleSeries: ISeriesApi<'Candlestick'> | null = null
  private volumeSeries: ISeriesApi<'Histogram'> | null = null
  private deltaSeries: ISeriesApi<'Histogram'> | null = null
  private cvdSeries: ISeriesApi<'Line'> | null = null
  private candleStyle: CandleStyle = DEFAULT_CHART_STYLE.candle
  private lastCandles: Candle[] = []

  attach(chart: IChartApi, style?: CandleStyle) {
    this.chart = chart
    if (style) this.candleStyle = { ...style }

    this.candleSeries = chart.addCandlestickSeries({
      upColor: this.candleStyle.upBody,
      downColor: this.candleStyle.downBody,
      borderUpColor: this.candleStyle.upBorder,
      borderDownColor: this.candleStyle.downBorder,
      wickUpColor: this.candleStyle.upWick,
      wickDownColor: this.candleStyle.downWick,
      priceLineVisible: true,
      lastValueVisible: true,
    })

    this.volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    })

    this.deltaSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'delta',
      lastValueVisible: false,
      priceLineVisible: false,
    })

    this.cvdSeries = chart.addLineSeries({
      color: CVD_COLOR,
      lineWidth: 2,
      priceScaleId: 'cvd',
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false,
      autoScale: true,
    })
    chart.priceScale('delta').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
      visible: false,
      autoScale: true,
    })
    chart.priceScale('cvd').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.3 },
      visible: false,
      autoScale: true,
    })
    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.06, bottom: 0.22 },
      autoScale: true,
    })
  }

  detach() {
    this.chart = null
    this.candleSeries = null
    this.volumeSeries = null
    this.deltaSeries = null
    this.cvdSeries = null
    this.lastCandles = []
  }

  getCandleSeries() {
    return this.candleSeries
  }

  applyStyle(style: CandleStyle) {
    this.candleStyle = { ...style }
    this.candleSeries?.applyOptions({
      upColor: this.candleStyle.upBody,
      downColor: this.candleStyle.downBody,
      borderUpColor: this.candleStyle.upBorder,
      borderDownColor: this.candleStyle.downBorder,
      wickUpColor: this.candleStyle.upWick,
      wickDownColor: this.candleStyle.downWick,
    })
    if (this.lastCandles.length > 0) this.setCandles(this.lastCandles)
  }

  /** Call only on symbol/interval change — resets price scale to candles. */
  resetViewForSymbolChange() {
    this.applyCandleOnlyAutoscale(this.lastCandles)
    this.chart?.priceScale('right').applyOptions({ autoScale: true })
    try {
      this.chart?.timeScale().fitContent()
    } catch {
      /* */
    }
  }

  clearCandles() {
    this.lastCandles = []
    this.candleSeries?.setData([])
    this.volumeSeries?.setData([])
    this.clearDelta()
    this.clearCvd()
    this.clearCandleMarkers()
    this.resetPriceScale()
  }

  resetPriceScale() {
    this.applyCandleOnlyAutoscale(this.lastCandles)
    this.chart?.priceScale('right').applyOptions({
      autoScale: true,
    })
  }

  /** Lock right scale to candle OHLC only — ignores volume/delta/cvd/equity. */
  private applyCandleOnlyAutoscale(candles: Candle[]) {
    const range = candlePriceRange(candles)
    if (!range || !this.candleSeries) {
      this.candleSeries?.applyOptions({ autoscaleInfoProvider: undefined })
      return
    }
    const { min, max } = range
    this.candleSeries.applyOptions({
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: min, maxValue: max },
      }),
    })
  }

  applyPriceFormatFor(refPrice: number) {
    const fmt = inferPriceFormat(refPrice)
    this.candleSeries?.applyOptions({ priceFormat: fmt })
  }

  setCandles(candles: Candle[]) {
    if (!this.candleSeries || !this.volumeSeries) return
    this.lastCandles = candles

    const candleData: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    const upVol = hexToRgba(this.candleStyle.upBody, 0.4)
    const downVol = hexToRgba(this.candleStyle.downBody, 0.4)

    const volumeData: HistogramData[] = candles.map((c) => ({
      time: c.time as Time,
      value: Number.isFinite(c.volume) ? c.volume : 0,
      color: c.close >= c.open ? upVol : downVol,
    }))

    this.candleSeries.setData(candleData)
    this.volumeSeries.setData(volumeData)
    if (candles.length > 0) {
      const last = candles[candles.length - 1]
      const bull = last.close >= last.open
      this.applyPriceFormatFor(last.close)
      this.candleSeries.applyOptions({
        priceLineColor: bull ? this.candleStyle.upBody : this.candleStyle.downBody,
      })
    }
    // Do NOT force autoScale / full-range autoscale here — that resets user pan/zoom.
  }

  updateCandle(candle: Candle) {
    if (!this.candleSeries || !this.volumeSeries) return

    if (this.lastCandles.length > 0) {
      const last = this.lastCandles[this.lastCandles.length - 1]
      if (last && last.time === candle.time) {
        this.lastCandles[this.lastCandles.length - 1] = candle
      } else if (!last || candle.time > last.time) {
        this.lastCandles.push(candle)
        if (this.lastCandles.length > 500) this.lastCandles.shift()
      }
    } else {
      this.lastCandles = [candle]
    }

    this.candleSeries.update({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })

    const bull = candle.close >= candle.open
    this.candleSeries.applyOptions({
      priceLineColor: bull ? this.candleStyle.upBody : this.candleStyle.downBody,
    })

    const upVol = hexToRgba(this.candleStyle.upBody, 0.4)
    const downVol = hexToRgba(this.candleStyle.downBody, 0.4)
    this.volumeSeries.update({
      time: candle.time as Time,
      value: Number.isFinite(candle.volume) ? candle.volume : 0,
      color: candle.close >= candle.open ? upVol : downVol,
    })
    // Live ticks must not reset price scale or visible time range.
  }

  setDeltaBars(bars: CandleDeltaBar[]) {
    if (!this.deltaSeries) return
    const data: HistogramData[] = bars.map((b) => ({
      time: b.time as Time,
      value: b.delta,
      color: b.delta >= 0 ? DELTA_UP : DELTA_DOWN,
    }))
    this.deltaSeries.setData(data)
  }

  clearDelta() {
    this.deltaSeries?.setData([])
  }

  setCvd(points: { time: number; value: number }[]) {
    if (!this.cvdSeries) return
    const data: LineData[] = points.map((p) => ({
      time: p.time as Time,
      value: p.value,
    }))
    this.cvdSeries.setData(data)
    this.chart?.priceScale('cvd').applyOptions({ visible: false })
  }

  clearCvd() {
    this.cvdSeries?.setData([])
    this.chart?.priceScale('cvd').applyOptions({ visible: false })
  }

  setCandleMarkers(markers: SeriesMarker<Time>[]) {
    this.candleSeries?.setMarkers(markers)
  }

  clearCandleMarkers() {
    this.candleSeries?.setMarkers([])
  }

  setDivergenceMarkers(markers: DivergenceMarker[]) {
    if (!this.candleSeries) return
    const seriesMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
      time: m.time as Time,
      position: m.kind === 'bearish' ? 'aboveBar' : 'belowBar',
      color: m.kind === 'bearish' ? DELTA_DOWN : DELTA_UP,
      shape: m.kind === 'bearish' ? 'arrowDown' : 'arrowUp',
      text: m.kind === 'bearish' ? 'Δ↓' : 'Δ↑',
    }))
    this.candleSeries.setMarkers(seriesMarkers)
  }

  setAbsorptionMarkers(markers: AbsorptionMarker[]) {
    if (!this.candleSeries) return
    const seriesMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
      time: m.time as Time,
      position: 'inBar',
      color: m.kind.startsWith('absorption') ? '#f0b90b' : '#848e9c',
      shape: 'circle',
      text: m.kind.startsWith('absorption') ? 'Abs' : 'Agg',
    }))
    this.candleSeries.setMarkers(seriesMarkers)
  }
}
