/**
 * Series Manager – candles, volume, delta histogram, optional CVD line + markers.
 */

import {
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  type SeriesMarker,
} from 'lightweight-charts'
import type { Candle } from '@/types'
import type { CandleStyle } from '@/stores/chartStyleStore'
import { DEFAULT_CHART_STYLE, hexToRgba } from '@/stores/chartStyleStore'
import type { CandleDeltaBar } from '@/analysis/deepPrint/types'
import type { DivergenceMarker } from '@/analysis/deltaPrint/divergence'
import type { AbsorptionMarker } from '@/analysis/deltaPrint/absorption'

const DELTA_UP = 'rgba(14, 203, 129, 0.85)'
const DELTA_DOWN = 'rgba(246, 70, 93, 0.85)'
const CVD_COLOR = 'rgba(240, 185, 11, 0.9)'

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
    })
  }

  detach() {
    this.candleSeries = null
    this.volumeSeries = null
    this.deltaSeries = null
    this.cvdSeries = null
    this.chart = null
    this.lastCandles = []
  }

  getCandleSeries() {
    return this.candleSeries
  }

  applyStyle(style: CandleStyle) {
    this.candleStyle = { ...style }
    if (!this.candleSeries) return
    this.candleSeries.applyOptions({
      upColor: style.upBody,
      downColor: style.downBody,
      borderUpColor: style.upBorder,
      borderDownColor: style.downBorder,
      wickUpColor: style.upWick,
      wickDownColor: style.downWick,
    })
    if (this.lastCandles.length > 0) this.setCandles(this.lastCandles)
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

  setCvdLine(points: { time: number; value: number }[]) {
    if (!this.cvdSeries) return
    const data: LineData[] = points.map((p) => ({
      time: p.time as Time,
      value: p.value,
    }))
    this.cvdSeries.setData(data)
  }

  clearCvd() {
    this.cvdSeries?.setData([])
  }

  /**
   * Merge absorption + divergence into a single setMarkers call
   * (Lightweight Charts allows one marker list per series).
   */
  setCandleAnnotationMarkers(
    absorption: AbsorptionMarker[],
    divergences: DivergenceMarker[]
  ) {
    if (!this.candleSeries) return
    const markers: SeriesMarker<Time>[] = []

    for (const m of absorption) {
      switch (m.kind) {
        case 'aggression_buy':
          markers.push({
            time: m.time as Time,
            position: 'belowBar',
            color: '#0ecb81',
            shape: 'arrowUp',
            text: 'Agg',
          })
          break
        case 'aggression_sell':
          markers.push({
            time: m.time as Time,
            position: 'aboveBar',
            color: '#a855f7',
            shape: 'arrowDown',
            text: 'Agg',
          })
          break
        case 'absorption_buy':
          markers.push({
            time: m.time as Time,
            position: 'belowBar',
            color: '#f0b90b',
            shape: 'circle',
            text: 'Abs',
          })
          break
        case 'absorption_sell':
          markers.push({
            time: m.time as Time,
            position: 'aboveBar',
            color: '#f0b90b',
            shape: 'circle',
            text: 'Abs',
          })
          break
      }
    }

    for (const m of divergences) {
      if (m.kind === 'bearish') {
        markers.push({
          time: m.time as Time,
          position: 'aboveBar',
          color: '#f6465d',
          shape: 'arrowDown',
          text: 'Δ div',
        })
      } else {
        markers.push({
          time: m.time as Time,
          position: 'belowBar',
          color: '#0ecb81',
          shape: 'arrowUp',
          text: 'Δ div',
        })
      }
    }

    // One marker per time (prefer absorption over div if collision)
    const byTime = new Map<number, SeriesMarker<Time>>()
    for (const mk of markers) {
      const t = mk.time as number
      if (!byTime.has(t)) byTime.set(t, mk)
    }
    this.candleSeries.setMarkers(Array.from(byTime.values()))
  }

  /** @deprecated use setCandleAnnotationMarkers */
  setDivergenceMarkers(marks: DivergenceMarker[]) {
    this.setCandleAnnotationMarkers([], marks)
  }

  clearCandleMarkers() {
    this.candleSeries?.setMarkers([])
  }

  clearDivergenceMarkers() {
    this.clearCandleMarkers()
  }
}
