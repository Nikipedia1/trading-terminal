import { describe, it, expect } from 'vitest'
import { evaluateRisk, sizeFromRisk, ensureDayRuntime } from '../risk'
import type { BotInstance, BotBaseConfig } from '../types'
import { defaultConfig, defaultParams, defaultRiskConfig } from '../types'

function makeBot(
  configPatch: Partial<BotBaseConfig> = {},
  runtime?: BotInstance['runtime']
): BotInstance {
  const base = defaultConfig('BTCUSDT')
  const config: BotBaseConfig = {
    ...base,
    ...configPatch,
    risk: { ...defaultRiskConfig(), ...base.risk, ...configPatch.risk },
  }
  return {
    id: 'b1',
    name: 'test',
    kind: 'rsi',
    status: 'idle',
    enabled: true,
    config,
    params: defaultParams('rsi'),
    createdAt: Date.now(),
    lastTickAt: null,
    lastSignal: null,
    lastError: null,
    stats: { trades: 0, wins: 0, losses: 0, realizedPnl: 0 },
    runtime,
  }
}

describe('sizeFromRisk', () => {
  it('sizes from equity and stop', () => {
    expect(sizeFromRisk(10_000, 100, 1, 2, 5)).toBe(50)
  })
  it('returns 0 on bad inputs', () => {
    expect(sizeFromRisk(0, 100, 1, 2, 1)).toBe(0)
  })
})

describe('evaluateRisk', () => {
  it('blocks when stop required and missing', () => {
    const b = makeBot({
      stopLossPct: null,
      risk: { ...defaultRiskConfig(), requireStopLoss: true },
    })
    const d = evaluateRisk(
      b,
      { equity: 10_000, balance: 10_000, openMargin: 0, openPositions: 0, dayPnl: 0, markPrice: 100 },
      'long',
      null
    )
    expect(d.ok).toBe(false)
  })

  it('blocks on daily loss circuit breaker', () => {
    const dayKey = new Date().toISOString().slice(0, 10)
    const b = makeBot(
      { stopLossPct: 2, risk: { ...defaultRiskConfig(), maxDailyLossPct: 3, requireStopLoss: false } },
      { dayKey, dayPnl: -400, dayTrades: 2 }
    )
    const d = evaluateRisk(
      b,
      { equity: 10_000, balance: 10_000, openMargin: 0, openPositions: 0, dayPnl: -400, markPrice: 100 },
      'long',
      null
    )
    expect(d.ok).toBe(false)
  })
})

describe('ensureDayRuntime', () => {
  it('resets dayPnl on new day', () => {
    const b = makeBot({}, { dayKey: '2000-01-01', dayPnl: -99, dayTrades: 5 })
    const r = ensureDayRuntime(b)
    expect(r.dayPnl).toBe(0)
  })
})
