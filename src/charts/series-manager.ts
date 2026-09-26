/**
 * Series Manager – owns candlestick + volume series lifecycle.
 * Style applied via applyStyle() from chartStyleStore.
 */

import {
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from 'lightweight-charts'
import type { Candle } from '@/types'
import type { CandleStyle } from '@/stores/chartStyleStore'
import { DEFAULT_CHART_STYLE, hexToRgba } from '@/stores/chartStyleStore'

export class SeriesManager {
  private chart: IChartApi | null = null
  private candleSeries: ISeriesApi<'Candlestick'> | null = null
  private volumeSeries: ISeriesApi<'Histogram'> | null = null
  private candleStyle: CandleStyle = { ...DEFAULT_CHART_STYLE.candle }
  /** Cached candles so volume colors can be rebuilt on style change */
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

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.25 },
    })
  }

  detach() {
    this.candleSeries = null
    this.volumeSeries = null
    this.chart = null
    this.lastCandles = []
  }

  getCandleSeries() {
    return this.candleSeries
  }

  /** Live update of body / border / wick colors */
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
    // Rebuild volume colors from cache
    if (this.lastCandles.length > 0) {
      this.setCandles(this.lastCandles)
    }
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

    // Keep cache in sync for style rebuilds
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
}
