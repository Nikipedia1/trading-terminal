import { describe, it, expect } from 'vitest'
import {
  makeSignalId,
  realizedDayPnlFromFills,
  BOT_HARD_COOLDOWN_MS,
} from '../scheduler'

describe('makeSignalId', () => {
  it('is stable for same bot/action/bar', () => {
    expect(makeSignalId('b1', 'open_long', 1700000000)).toBe(
      'b1:open_long:1700000000'
    )
  })
  it('differs across bars', () => {
    expect(makeSignalId('b1', 'open_long', 1)).not.toBe(
      makeSignalId('b1', 'open_long', 2)
    )
  })
})

describe('BOT_HARD_COOLDOWN_MS', () => {
  it('is at least 10s', () => {
    expect(BOT_HARD_COOLDOWN_MS).toBeGreaterThanOrEqual(10_000)
  })
})

describe('realizedDayPnlFromFills', () => {
  it('aggregates UTC-day realized pnl', () => {
    const today = Date.now()
    const fills = [
      { time: today, realizedPnl: -10, symbol: 'BTCUSDT' },
      { time: today, realizedPnl: 5, symbol: 'BTCUSDT' },
      { time: today - 86_400_000 * 2, realizedPnl: 999, symbol: 'BTCUSDT' },
    ]
    expect(realizedDayPnlFromFills(fills, 'BTCUSDT')).toBeCloseTo(-5)
  })
})
