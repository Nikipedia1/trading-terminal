import { describe, it, expect } from 'vitest'
import type { Candle } from '@/types'
import { computeSma, computeEma, computeRsi, computeVwap } from '../compute'

function candles(n: number, start = 100): Candle[] {
  const out: Candle[] = []
  let price = start
  for (let i = 0; i < n; i++) {
    price += (i % 3) - 1
    out.push({
      time: 1_700_000_000 + i * 60,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 10 + i,
    })
  }
  return out
}

describe('indicator compute', () => {
  it('SMA length and first defined index', () => {
    const c = candles(30)
    const s = computeSma(c, 10)
    expect(s.length).toBeGreaterThan(0)
    expect(s[0].time).toBe(c[9].time)
  })

  it('EMA produces finite values', () => {
    const s = computeEma(candles(40), 9)
    expect(s.every((p) => Number.isFinite(p.value))).toBe(true)
  })

  it('RSI stays in 0–100', () => {
    const s = computeRsi(candles(50), 14)
    for (const p of s) {
      expect(p.value).toBeGreaterThanOrEqual(0)
      expect(p.value).toBeLessThanOrEqual(100)
    }
  })

  it('VWAP defined for positive volume', () => {
    const s = computeVwap(candles(20))
    expect(s.length).toBe(20)
  })
})
