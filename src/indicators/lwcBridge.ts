/**
 * Lightweight Charts apply helpers – pattern from official indicator-examples.
 * Pure: takes already-computed LinePoint[] (real OHLC only) → series.setData.
 * Does not invent values; empty input clears series.
 */

import type { ISeriesApi, LineData, Time } from 'lightweight-charts'
import type { LinePoint } from './types'

/** Convert internal LinePoint[] to LWC LineData[] */
export function toLineData(points: LinePoint[]): LineData[] {
  const out: LineData[] = []
  for (const p of points) {
    if (!Number.isFinite(p.time) || !Number.isFinite(p.value)) continue
    out.push({ time: p.time as Time, value: p.value })
  }
  return out
}

/**
 * Apply calculated indicator values to an existing line series.
 * Mirrors `calculateX → series.setData` from TV indicator-examples.
 */
export function applyLineIndicator(
  series: ISeriesApi<'Line'> | null | undefined,
  points: LinePoint[]
): void {
  if (!series) return
  series.setData(toLineData(points))
}

/**
 * Apply histogram-style values (MACD hist, AO, …) to a histogram series.
 */
export function applyHistogramIndicator(
  series: ISeriesApi<'Histogram'> | null | undefined,
  points: LinePoint[],
  colorFor?: (value: number) => string
): void {
  if (!series) return
  const data = points
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .map((p) => ({
      time: p.time as Time,
      value: p.value,
      color: colorFor ? colorFor(p.value) : undefined,
    }))
  series.setData(data)
}

/**
 * Safe multi-series update: only sets data when points non-empty;
 * otherwise clears to avoid stale overlays after symbol change.
 */
export function replaceLineData(
  series: ISeriesApi<'Line'> | null | undefined,
  points: LinePoint[]
): void {
  if (!series) return
  if (!points.length) {
    series.setData([])
    return
  }
  applyLineIndicator(series, points)
}
