/**
 * Coordinate Bridge – anti-pellicola foundation.
 *
 * Beyond data range (empty space after last candle / before first):
 * extrapolate using logical indices + known candle times.
 * Visible-range-only extrapolation fails when the user scrolls into
 * whitespace where getVisibleRange() still clamps to last bar time.
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
  /** Sorted unix-seconds of candle opens currently on the series */
  private dataTimes: number[] = []
  /** Fallback bar duration (seconds) when fewer than 2 candles */
  private barDurationSec = 60

  attach(chart: IChartApi, series: ISeriesApi<SeriesType>) {
    this.chart = chart
    this.series = series
  }

  detach() {
    this.chart = null
    this.series = null
    this.dataTimes = []
  }

  getChart() {
    return this.chart
  }

  /**
   * Call whenever candles are (re)loaded or updated so extrapolation
   * past the last bar uses real spacing.
   */
  setDataTimes(times: number[], barDurationSec?: number) {
    this.dataTimes = times.length ? [...times].sort((a, b) => a - b) : []
    if (barDurationSec && barDurationSec > 0) {
      this.barDurationSec = barDurationSec
    } else if (this.dataTimes.length >= 2) {
      const n = this.dataTimes.length
      this.barDurationSec = Math.max(
        1,
        this.dataTimes[n - 1] - this.dataTimes[n - 2]
      )
    }
  }

  private duration(): number {
    if (this.dataTimes.length >= 2) {
      const n = this.dataTimes.length
      return Math.max(1, this.dataTimes[n - 1] - this.dataTimes[n - 2])
    }
    return Math.max(1, this.barDurationSec)
  }

  /**
   * Map logical index → unix time using series times.
   * Logical 0..n-1 ≈ data bars; outside that range we extrapolate.
   */
  private logicalToTime(logical: number): number | null {
    const times = this.dataTimes
    const n = times.length
    if (n === 0) return null
    if (n === 1) {
      return times[0] + (logical - 0) * this.duration()
    }

    if (logical >= 0 && logical <= n - 1) {
      const i0 = Math.floor(logical)
      const i1 = Math.min(i0 + 1, n - 1)
      const frac = logical - i0
      return times[i0] + frac * (times[i1] - times[i0])
    }

    if (logical > n - 1) {
      const dt = this.duration()
      return times[n - 1] + (logical - (n - 1)) * dt
    }

    // logical < 0
    const dt = Math.max(1, times[1] - times[0])
    return times[0] + logical * dt
  }

  /** Map unix time → approximate logical index */
  private timeToLogical(time: number): number | null {
    const times = this.dataTimes
    const n = times.length
    if (n === 0) return null
    if (n === 1) {
      return (time - times[0]) / this.duration()
    }

    if (time >= times[n - 1]) {
      const dt = this.duration()
      return n - 1 + (time - times[n - 1]) / dt
    }
    if (time <= times[0]) {
      const dt = Math.max(1, times[1] - times[0])
      return (time - times[0]) / dt
    }

    // Binary search between bars
    let lo = 0
    let hi = n - 1
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1
      if (times[mid] <= time) lo = mid
      else hi = mid
    }
    const span = times[hi] - times[lo]
    if (span <= 0) return lo
    return lo + (time - times[lo]) / span
  }

  private extrapolateTimeFromX(x: number): number | null {
    if (!this.chart) return null
    const ts = this.chart.timeScale()
    const logical = ts.coordinateToLogical(x)
    if (logical === null) return null
    return this.logicalToTime(logical)
  }

  private extrapolateXFromTime(time: number): number | null {
    if (!this.chart) return null
    const logical = this.timeToLogical(time)
    if (logical === null) return null
    const x = this.chart.timeScale().logicalToCoordinate(logical as any)
    return x
  }

  /** time (unix seconds) → x pixel (extrapolates beyond data) */
  timeToCoordinate(time: Time): number | null {
    if (!this.chart) return null
    try {
      const x = this.chart.timeScale().timeToCoordinate(time)
      if (x !== null && Number.isFinite(x)) return x
    } catch {
      /* business day etc */
    }
    if (typeof time === 'number') {
      const x = this.extrapolateXFromTime(time)
      if (x !== null && Number.isFinite(x)) return x
    }
    return null
  }

  /** x pixel → time (extrapolates beyond data / whitespace) */
  coordinateToTime(x: number): Time | null {
    if (!this.chart) return null
    try {
      const t = this.chart.timeScale().coordinateToTime(x)
      if (t !== null) {
        if (typeof t === 'number') return t
        // BusinessDay – ignore, fall through to extrapolation
      }
    } catch {
      /* */
    }
    return this.extrapolateTimeFromX(x)
  }

  priceToCoordinate(price: number): number | null {
    if (!this.series) return null
    try {
      const y = this.series.priceToCoordinate(price)
      return y !== null && Number.isFinite(y) ? y : null
    } catch {
      return null
    }
  }

  coordinateToPrice(y: number): number | null {
    if (!this.series) return null
    try {
      const p = this.series.coordinateToPrice(y)
      return p !== null && Number.isFinite(p) ? p : null
    } catch {
      return null
    }
  }

  toPixel(point: Point): PixelPoint | null {
    const x = this.timeToCoordinate(point.time)
    const y = this.priceToCoordinate(point.price)
    if (x === null || y === null) return null
    return { x, y }
  }

  fromPixel(pixel: PixelPoint): Point | null {
    const time = this.coordinateToTime(pixel.x)
    const price = this.coordinateToPrice(pixel.y)
    if (time === null || price === null) return null
    const t = typeof time === 'number' ? time : null
    if (t === null) return null
    return { time: t, price }
  }

  onVisibleRangeChange(callback: () => void): () => void {
    if (!this.chart) return () => {}
    const ts = this.chart.timeScale()
    ts.subscribeVisibleTimeRangeChange(callback)
    return () => {
      ts.unsubscribeVisibleTimeRangeChange(callback)
    }
  }
}
