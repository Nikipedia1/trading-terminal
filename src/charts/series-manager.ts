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
      color: 'rgba(240, 185, 11, 0.9)',
      shape: 'circle',
      text: 'ABS',
    }))
    // Merge with existing is not tracked; caller should combine if needed
    this.candleSeries.setMarkers(seriesMarkers)
  }

  clearCandleMarkers() {
    this.candleSeries?.setMarkers([])
  }

  clearDivergenceMarkers() {
    this.clearCandleMarkers()
  }
}
