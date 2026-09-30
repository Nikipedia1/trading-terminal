import { describe, it, expect } from 'vitest'
import { realizedDayPnlFromFills } from '../scheduler'

describe('realizedDayPnlFromFills', () => {
  it('sums only today fills', () => {
    const today = Date.now()
    const yesterday = today - 48 * 3600_000
    const fills = [
      { time: yesterday, realizedPnl: 100, symbol: 'BTCUSDT' },
      { time: today, realizedPnl: -25, symbol: 'BTCUSDT' },
      { time: today, realizedPnl: 10, symbol: 'ETHUSDT' },
    ]
    expect(realizedDayPnlFromFills(fills)).toBeCloseTo(-15)
    expect(realizedDayPnlFromFills(fills, 'BTCUSDT')).toBeCloseTo(-25)
  })
})
