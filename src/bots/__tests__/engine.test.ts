import { describe, it, expect } from 'vitest'
import { evaluateBot, type CandleLike } from '../engine'
import type { BotInstance } from '../types'
import { defaultConfig, defaultParams } from '../types'

function candles(closes: number[]): CandleLike[] {
  return closes.map((c, i) => ({
    open: c,
    high: c * 1.01,
    low: c * 0.99,
    close: c,
    volume: 100,
    time: 1_700_000_000 + i * 60,
  }))
}

function bot(kind: BotInstance['kind'], patch?: Partial<BotInstance>): BotInstance {
  return {
    id: 't1',
    name: 't',
    kind,
    status: 'idle',
    enabled: true,
    config: defaultConfig('BTCUSDT'),
    params: defaultParams(kind),
    createdAt: 0,
    lastTickAt: null,
    lastSignal: null,
    lastError: null,
    stats: { trades: 0, wins: 0, losses: 0, realizedPnl: 0 },
    ...patch,
  }
}

describe('evaluateBot pure', () => {
  it('returns null on empty candles', () => {
    expect(evaluateBot(bot('rsi'), [], 100)).toBeNull()
  })

  it('DCA signals long after interval', () => {
    const b = bot('dca', {
      params: { kind: 'dca', dca: { intervalMin: 0, maxOrders: 5 } },
      runtime: { lastOrderAt: 0, dcaCount: 0 },
    })
    const s = evaluateBot(b, candles([100, 101, 102]), 102)
    expect(s?.side).toBe('long')
  })

  it('DCA flat when max orders reached', () => {
    const b = bot('dca', {
      params: { kind: 'dca', dca: { intervalMin: 0, maxOrders: 2 } },
      runtime: { dcaCount: 2, lastOrderAt: 0 },
    })
    const s = evaluateBot(b, candles([100]), 100)
    expect(s?.side).toBe('flat')
  })

  it('RSI needs enough bars (no throw)', () => {
    const s = evaluateBot(bot('rsi'), candles([100, 101, 99, 98, 97]), 97)
    expect(s === null || typeof s.side === 'string').toBe(true)
  })
})
