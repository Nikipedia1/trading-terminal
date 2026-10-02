/**
 * Candlestick + volume + delta/CVD series management.
 * Reactive price scale for every instrument (adaptive precision + autoScale).
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

export class SeriesManager {
  private chart: IChartApi | null = null
  private candleSeries: ISeriesApi<'Candlestick'> | null = null
  private volumeSeries: ISeriesApi<'Histogram'> | null = null
  private deltaSeries: ISeriesApi<'Histogram'> | null = null
  private cvdSeries: ISeriesApi<'Line'> | null = null
  private candleStyle: CandleStyle = { ...DEFAULT_CHART_STYLE.candle }
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
      lastValueVisible: true,
      lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineStyle: 2,
      priceLineColor: this.candleStyle.upBody,
      crosshairMarkerVisible: true,
    })

    this.volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    this.deltaSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'delta',
      base: 0,
    })

    this.cvdSeries = chart.addLineSeries({
      color: CVD_COLOR,
      lineWidth: 2,
      priceScaleId: 'cvd',
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.72, bottom: 0.16 },
    })
    chart.priceScale('delta').applyOptions({
      scaleMargins: { top: 0.88, bottom: 0 },
    })
    chart.priceScale('cvd').applyOptions({
      scaleMargins: { top: 0.55, bottom: 0.35 },
      visible: false,
    })
    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.32 },
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
    this.candleSeries?.applyOptions({
      autoscaleInfoProvider: undefined,
    })
    this.chart?.priceScale('right').applyOptions({
      autoScale: true,
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
      value: c.volume,
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
        autoscaleInfoProvider: undefined,
      })
    }
    this.resetPriceScale()
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
      value: candle.volume,
      color: candle.close >= candle.open ? upVol : downVol,
    })
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
    this.chart?.priceScale('cvd').applyOptions({ visible: points.length > 0 })
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
