/**
 * Coordinate Bridge – anti-pellicola foundation.
 *
 * EVERY conversion between price/time ↔ pixel MUST go through the
 * official Lightweight Charts API (timeScale / priceScale).
 * Never store absolute pixel positions for drawings or indicators.
 *
 * Beyond visible/data range: extrapolate via logical index so drawings
 * work to the right of the last candle (and left of the first).
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

  /**
   * Extrapolate time from logical coordinate using visible range.
   * Used when coordinateToTime returns null (x past last / before first bar).
   */
  private extrapolateTimeFromX(x: number): number | null {
    if (!this.chart) return null
    const ts = this.chart.timeScale()
    const logical = ts.coordinateToLogical(x)
    if (logical === null) return null

    const visLogical = ts.getVisibleLogicalRange()
    const visTime = ts.getVisibleRange()
    if (!visLogical || !visTime) return null
    if (typeof visTime.from !== 'number' || typeof visTime.to !== 'number') return null

    const logicalSpan = visLogical.to - visLogical.from
    if (Math.abs(logicalSpan) < 1e-12) return null
    const timeSpan = visTime.to - visTime.from
    return visTime.from + ((logical - visLogical.from) / logicalSpan) * timeSpan
  }

  /**
   * Extrapolate x pixel from time outside data range.
   */
  private extrapolateXFromTime(time: number): number | null {
    if (!this.chart) return null
    const ts = this.chart.timeScale()
    const visLogical = ts.getVisibleLogicalRange()
    const visTime = ts.getVisibleRange()
    if (!visLogical || !visTime) return null
    if (typeof visTime.from !== 'number' || typeof visTime.to !== 'number') return null

    const timeSpan = visTime.to - visTime.from
    if (Math.abs(timeSpan) < 1e-12) return null
    const logicalSpan = visLogical.to - visLogical.from
    const logical = visLogical.from + ((time - visTime.from) / timeSpan) * logicalSpan
    const x = ts.logicalToCoordinate(logical as any)
    return x
  }

  /** time (unix seconds) → x pixel (extrapolates beyond data) */
  timeToCoordinate(time: Time): number | null {
    if (!this.chart) return null
    const x = this.chart.timeScale().timeToCoordinate(time)
    if (x !== null) return x
    if (typeof time === 'number') return this.extrapolateXFromTime(time)
    return null
  }

  /** x pixel → time (extrapolates beyond data) */
  coordinateToTime(x: number): Time | null {
    if (!this.chart) return null
    const t = this.chart.timeScale().coordinateToTime(x)
    if (t !== null) return t
    return this.extrapolateTimeFromX(x)
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

  /** pixel → logical point (works past last candle) */
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
