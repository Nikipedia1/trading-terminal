/**
 * Coordinate Bridge – anti-pellicola foundation.
 *
 * EVERY conversion between price/time ↔ pixel MUST go through the
 * official Lightweight Charts API (timeScale / priceScale).
 * Never store absolute pixel positions for drawings or indicators.
 *
 * One instance per ChartContainer – no shared singleton.
 */

import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'

export interface Point {
  time: Time
  price: number
}

export interface PixelPoint {
  x: number
  y: number
}

export class CoordinateBridge {
  private chart: IChartApi | null = null
  private series: ISeriesApi<SeriesType> | null = null

  attach(chart: IChartApi, series: ISeriesApi<SeriesType>) {
    this.chart = chart
    this.series = series
  }

  detach() {
    this.chart = null
    this.series = null
  }

  getChart() {
    return this.chart
  }

  /** time (unix seconds) → x pixel */
  timeToCoordinate(time: Time): number | null {
    if (!this.chart) return null
    return this.chart.timeScale().timeToCoordinate(time)
  }

  /** x pixel → time */
  coordinateToTime(x: number): Time | null {
    if (!this.chart) return null
    return this.chart.timeScale().coordinateToTime(x)
  }

  /** price → y pixel */
  priceToCoordinate(price: number): number | null {
    if (!this.series) return null
    return this.series.priceToCoordinate(price)
  }

  /** y pixel → price */
  coordinateToPrice(y: number): number | null {
    if (!this.series) return null
    return this.series.coordinateToPrice(y)
  }

  /** logical point → pixel */
  toPixel(point: Point): PixelPoint | null {
    const x = this.timeToCoordinate(point.time)
    const y = this.priceToCoordinate(point.price)
    if (x === null || y === null) return null
    return { x, y }
  }

  /** pixel → logical point */
  fromPixel(pixel: PixelPoint): Point | null {
    const time = this.coordinateToTime(pixel.x)
    const price = this.coordinateToPrice(pixel.y)
    if (time === null || price === null) return null
    return { time, price }
  }

  /** Subscribe to any visual change that requires redraw of overlays */
  onVisibleRangeChange(callback: () => void): () => void {
    if (!this.chart) return () => {}
    const ts = this.chart.timeScale()
    ts.subscribeVisibleTimeRangeChange(callback)
    return () => {
      ts.unsubscribeVisibleTimeRangeChange(callback)
    }
  }
}
