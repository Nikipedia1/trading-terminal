import { describe, it, expect } from 'vitest'
import { classifyBubbles } from '../classify'
import type { DeepTradeBubble } from '../types'
import type { Candle } from '@/types'

function candle(time: number, o: number, h: number, l: number, c: number): Candle {
  return { time, open: o, high: h, low: l, close: c, volume: 1 }
}

function bubble(
  partial: Partial<DeepTradeBubble> & Pick<DeepTradeBubble, 'timeSec' | 'price' | 'aggressor'>
): DeepTradeBubble {
  return {
    id: 't1',
    qty: 1,
    baseQty: 1,
    quoteQty: partial.price,
    outcome: 'pending',
    clusterCount: 1,
    ...partial,
  }
}

describe('classifyBubbles', () => {
  const interval = 60
  // bars at t=0,60,120,180,240
  const candles: Candle[] = [
    candle(0, 100, 105, 99, 102),
    candle(60, 102, 108, 101, 107), // buy effective path
    candle(120, 107, 110, 106, 109),
    candle(180, 109, 111, 100, 101), // sell path
    candle(240, 101, 102, 95, 96),
  ]

  it('marks pending when not enough confirmation bars', () => {
    const b = bubble({ timeSec: 200, price: 105, aggressor: 'buy' })
    // only one bar after trade bar at 180
    const out = classifyBubbles([b], candles.slice(0, 4), interval, 2)
    expect(out[0].outcome).toBe('pending')
  })

  it('buy effective when subsequent high+close above print', () => {
    const b = bubble({ timeSec: 30, price: 103, aggressor: 'buy' })
    // trade in bar 0; confirm bars 60,120 close 107,109 > 103
    const out = classifyBubbles([b], candles, interval, 2)
    expect(out[0].outcome).toBe('effective')
  })

  it('buy trapped when close stays at or below print', () => {
    const b = bubble({ timeSec: 190, price: 110, aggressor: 'buy' })
    // trade in bar 180; next bars close 96 << 110
    const out = classifyBubbles([b], candles, interval, 1)
    expect(out[0].outcome).toBe('trapped')
  })

  it('sell effective when subsequent low+close below print', () => {
    const b = bubble({ timeSec: 190, price: 105, aggressor: 'sell' })
    const out = classifyBubbles([b], candles, interval, 1)
    expect(out[0].outcome).toBe('effective')
  })

  it('sell trapped when price never sustains below', () => {
    // trade early, price only goes up
    const b = bubble({ timeSec: 10, price: 100, aggressor: 'sell' })
    const out = classifyBubbles([b], candles, interval, 2)
    // closes 107,109 all above → trapped
    expect(out[0].outcome).toBe('trapped')
  })

  it('returns pending for all when candles empty', () => {
    const b = bubble({ timeSec: 10, price: 100, aggressor: 'buy' })
    const out = classifyBubbles([b], [], interval, 2)
    expect(out[0].outcome).toBe('pending')
  })
})
