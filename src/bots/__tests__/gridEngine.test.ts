import { describe, it, expect } from 'vitest'
import {
  buildGridLevels,
  needsRecenter,
  inventoryAllows,
  qtyAtLevel,
  planGridSync,
} from '../gridEngine'
import type { BotInstance } from '../types'
import { defaultConfig, defaultParams } from '../types'

describe('buildGridLevels', () => {
  it('builds buy below and sell above center', () => {
    const plan = buildGridLevels(100, {
      levels: 3,
      rangePct: 6,
      orderNotionalUsdt: 50,
      reCenterPct: 3,
      maxInventory: 0,
    })
    expect(plan.levels.length).toBe(6)
    const buys = plan.levels.filter((l) => l.side === 'long')
    const sells = plan.levels.filter((l) => l.side === 'short')
    expect(buys.length).toBeGreaterThan(0)
    expect(sells.length).toBeGreaterThan(0)
    expect(Math.max(...buys.map((b) => b.price))).toBeLessThan(100)
    expect(Math.min(...sells.map((s) => s.price))).toBeGreaterThan(100)
  })
})

describe('needsRecenter', () => {
  it('triggers outside threshold', () => {
    expect(needsRecenter(110, 100, 3)).toBe(true)
    expect(needsRecenter(101, 100, 3)).toBe(false)
  })
})

describe('inventoryAllows', () => {
  it('blocks excess long', () => {
    expect(inventoryAllows(0.9, 'long', 0.2, 1)).toBe(false)
    expect(inventoryAllows(0.5, 'long', 0.2, 1)).toBe(true)
  })
})

describe('qtyAtLevel', () => {
  it('computes base qty', () => {
    expect(qtyAtLevel(100, 50)).toBe(2)
  })
})

describe('planGridSync', () => {
  it('places limits on empty grid', () => {
    const bot: BotInstance = {
      id: 'g1',
      name: 'grid',
      kind: 'grid',
      status: 'running',
      enabled: true,
      config: defaultConfig('BTCUSDT'),
      params: defaultParams('grid'),
      createdAt: 0,
      lastTickAt: null,
      lastSignal: null,
      lastError: null,
      stats: { trades: 0, wins: 0, losses: 0, realizedPnl: 0 },
      runtime: {},
    }
    const plan = planGridSync(bot, 100, [])
    expect(plan).not.toBeNull()
    expect(plan!.toPlace.length).toBeGreaterThan(0)
    expect(plan!.runtime.gridCenter).toBe(100)
  })
})
