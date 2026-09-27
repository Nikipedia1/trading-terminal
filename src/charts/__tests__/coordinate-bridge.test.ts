/**
 * CoordinateBridge pure-logic tests (no DOM / chart mock required for logical math).
 * We exercise setDataTimes + private logic via public time/price APIs with a minimal fake.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CoordinateBridge } from '../coordinate-bridge'

/** Minimal timeScale + series stubs for unit tests */
function makeFakeChart(times: number[]) {
  const n = times.length
  const duration = n >= 2 ? times[n - 1] - times[n - 2] : 60

  const timeScale = {
    timeToCoordinate: (t: number) => {
      // linear map: first bar → 0, last → 100*(n-1)
      if (n === 0) return null
      if (t < times[0] || t > times[n - 1]) return null // force extrapolation path
      const idx = times.findIndex((x) => x === t)
      if (idx >= 0) return idx * 10
      return null
    },
    coordinateToTime: (x: number) => {
      const logical = x / 10
      if (logical < 0 || logical > n - 1) return null
      const i0 = Math.floor(logical)
      const i1 = Math.min(i0 + 1, n - 1)
      const frac = logical - i0
      return times[i0] + frac * (times[i1] - times[i0])
    },
    coordinateToLogical: (x: number) => x / 10,
    logicalToCoordinate: (logical: number) => logical * 10,
    subscribeVisibleTimeRangeChange: () => {},
    unsubscribeVisibleTimeRangeChange: () => {},
  }

  const series = {
    priceToCoordinate: (p: number) => 1000 - p, // simple invert
    coordinateToPrice: (y: number) => 1000 - y,
  }

  return {
    chart: { timeScale: () => timeScale } as any,
    series: series as any,
    duration,
  }
}

describe('CoordinateBridge', () => {
  let bridge: CoordinateBridge
  const times = [1_700_000_000, 1_700_000_060, 1_700_000_120, 1_700_000_180]

  beforeEach(() => {
    bridge = new CoordinateBridge()
    const { chart, series } = makeFakeChart(times)
    bridge.attach(chart, series)
    bridge.setDataTimes(times, 60)
  })

  it('maps known bar times to coordinates', () => {
    const x = bridge.timeToCoordinate(times[1] as any)
    expect(x).toBe(10)
  })

  it('extrapolates past last bar', () => {
    // last index 3 → x=30; +1 bar → x=40
    const x = bridge.timeToCoordinate((times[3] + 60) as any)
    expect(x).toBeCloseTo(40, 5)
  })

  it('extrapolates before first bar', () => {
    const x = bridge.timeToCoordinate((times[0] - 60) as any)
    expect(x).toBeCloseTo(-10, 5)
  })

  it('round-trips price', () => {
    const y = bridge.priceToCoordinate(100)
    expect(y).toBe(900)
    const p = bridge.coordinateToPrice(900)
    expect(p).toBe(100)
  })

  it('toPixel / fromPixel round-trip inside data', () => {
    const px = bridge.toPixel({ time: times[2] as any, price: 50 })
    expect(px).not.toBeNull()
    expect(px!.x).toBe(20)
    expect(px!.y).toBe(950)

    const back = bridge.fromPixel(px!)
    expect(back).not.toBeNull()
    expect(back!.time).toBe(times[2])
    expect(back!.price).toBe(50)
  })

  it('handles empty data without throw', () => {
    bridge.setDataTimes([])
    expect(bridge.timeToCoordinate(1_700_000_000 as any)).toBeNull()
  })

  it('uses barDurationSec fallback with single candle', () => {
    bridge.setDataTimes([1_700_000_000], 60)
    // beyond data → extrapolation
    const x = bridge.timeToCoordinate((1_700_000_000 + 120) as any)
    // logical 2 → x = 20
    expect(x).toBeCloseTo(20, 5)
  })
})
