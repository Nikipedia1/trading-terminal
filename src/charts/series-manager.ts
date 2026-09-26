/**
 * Series Manager – owns candlestick + volume series lifecycle.
 * All data updates go through this class so the coordinate bridge stays in sync.
 * Compatible with lightweight-charts v4.x (addCandlestickSeries / addHistogramSeries).
 */

import {
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from 'lightweight-charts'
import type { Candle } from '@/types'

export class SeriesManager {
  private chart: IChartApi | null = null
  private candleSeries: ISeriesApi<'Candlestick'> | null = null
  private volumeSeries: ISeriesApi<'Histogram'> | null = null

  attach(chart: IChartApi) {
    this.chart = chart

    this.candleSeries = chart.addCandlestickSeries({
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderUpColor: '#0ecb81',
      borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
    })

    this.volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    // Volume on a separate scale at the bottom
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
  }

  getCandleSeries() {
    return this.candleSeries
  }

  /** Full replace – used after historical load */
  setCandles(candles: Candle[]) {
    if (!this.candleSeries || !this.volumeSeries) return

    const candleData: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    const volumeData: HistogramData[] = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)',
    }))

    this.candleSeries.setData(candleData)
    this.volumeSeries.setData(volumeData)
  }

  /** Incremental update – used on live WebSocket candle */
  updateCandle(candle: Candle) {
    if (!this.candleSeries || !this.volumeSeries) return

    this.candleSeries.update({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })

    this.volumeSeries.update({
      time: candle.time as Time,
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)',
    })
  }
}
