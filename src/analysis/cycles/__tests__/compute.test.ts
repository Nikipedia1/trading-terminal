import { describe, it, expect } from 'vitest'
import type { Candle } from '@/types'
import { dominantPeriod, computeCycleModel, schaffTrendCycle, weekdaySeasonality } from '../compute'

function synth(n: number, period: number): Candle[] {
  const out: Candle[] = []
  const t0 = 1_700_000_000
  for (let i = 0; i < n; i++) {
    const wave = Math.sin((2 * Math.PI * i) / period)
    const close = 100 + wave * 5
    out.push({
      time: t0 + i * 3600,
      open: close,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 1000,
    })
  }
  return out
}

describe('dominantPeriod', () => {
  it('finds synthetic sine period approximately', () => {
    const candles = synth(200, 20)
    const closes = candles.map((c) => c.close)
    const { period, strength } = dominantPeriod(closes, 8, 40)
    expect(period).toBeGreaterThanOrEqual(16)
    expect(period).toBeLessThanOrEqual(24)
    expect(strength).toBeGreaterThan(0.1)
  })
})

describe('computeCycleModel', () => {
  it('returns ready model on enough bars', () => {
    const m = computeCycleModel(synth(120, 16))
    expect(m.ready).toBe(true)
    expect(m.period).toBeGreaterThan(0)
    expect(m.wave.length).toBeGreaterThan(10)
  })

  it('empty on few bars', () => {
    const m = computeCycleModel(synth(10, 5))
    expect(m.ready).toBe(false)
  })
})

describe('schaffTrendCycle', () => {
  it('produces values in range on long series', () => {
    const closes = synth(150, 20).map((c) => c.close)
    const stc = schaffTrendCycle(closes)
    const vals = stc.filter((v) => v != null) as number[]
    expect(vals.length).toBeGreaterThan(10)
    for (const v of vals) {
      expect(v).toBeGreaterThanOrEqual(-5)
      expect(v).toBeLessThanOrEqual(105)
    }
  })
})

describe('weekdaySeasonality', () => {
  it('returns 7 buckets', () => {
    const s = weekdaySeasonality(synth(100, 10))
    expect(s).toHaveLength(7)
  })
})
