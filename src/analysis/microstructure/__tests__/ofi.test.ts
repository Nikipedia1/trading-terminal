import { describe, it, expect } from 'vitest'
import {
  ofiContribution,
  multiLevelOfiContribution,
  multiLevelDepthImbalance,
  lnQuoteFromLevels,
  type L1Quote,
  type LnQuote,
} from '../ofi'

describe('ofiContribution (L1)', () => {
  it('bid size increase at same price → positive', () => {
    const prev: L1Quote = { bidPrice: 100, bidSize: 5, askPrice: 101, askSize: 4 }
    const curr: L1Quote = { bidPrice: 100, bidSize: 8, askPrice: 101, askSize: 4 }
    expect(ofiContribution(prev, curr)).toBe(3)
  })

  it('ask size increase at same price → negative', () => {
    const prev: L1Quote = { bidPrice: 100, bidSize: 5, askPrice: 101, askSize: 4 }
    const curr: L1Quote = { bidPrice: 100, bidSize: 5, askPrice: 101, askSize: 7 }
    expect(ofiContribution(prev, curr)).toBe(-3)
  })

  it('bid price improve → +curr size', () => {
    const prev: L1Quote = { bidPrice: 100, bidSize: 5, askPrice: 101, askSize: 4 }
    const curr: L1Quote = { bidPrice: 100.5, bidSize: 2, askPrice: 101, askSize: 4 }
    expect(ofiContribution(prev, curr)).toBe(2)
  })
})

describe('multiLevelOfiContribution', () => {
  it('equals L1 when only top level changes and levels=1', () => {
    const prev: LnQuote = {
      bids: [{ price: 100, size: 5 }],
      asks: [{ price: 101, size: 4 }],
    }
    const curr: LnQuote = {
      bids: [{ price: 100, size: 8 }],
      asks: [{ price: 101, size: 4 }],
    }
    expect(multiLevelOfiContribution(prev, curr, 1)).toBe(3)
  })

  it('sums independent level contributions', () => {
    const prev: LnQuote = {
      bids: [
        { price: 100, size: 5 },
        { price: 99, size: 10 },
      ],
      asks: [
        { price: 101, size: 4 },
        { price: 102, size: 6 },
      ],
    }
    const curr: LnQuote = {
      bids: [
        { price: 100, size: 8 }, // +3
        { price: 99, size: 12 }, // +2
      ],
      asks: [
        { price: 101, size: 4 },
        { price: 102, size: 6 },
      ],
    }
    expect(multiLevelOfiContribution(prev, curr, 2, 'equal')).toBe(5)
  })

  it('does not invent missing levels', () => {
    const prev: LnQuote = {
      bids: [{ price: 100, size: 5 }],
      asks: [{ price: 101, size: 4 }],
    }
    const curr: LnQuote = {
      bids: [{ price: 100, size: 5 }],
      asks: [{ price: 101, size: 4 }],
    }
    expect(multiLevelOfiContribution(prev, curr, 5)).toBe(0)
  })
})

describe('multiLevelDepthImbalance', () => {
  it('aggregates sizes over levels', () => {
    const q = lnQuoteFromLevels(
      [
        { price: 100, qty: 10 },
        { price: 99, qty: 20 },
      ],
      [
        { price: 101, qty: 5 },
        { price: 102, qty: 5 },
      ],
      2
    )
    // bid 30, ask 10 → (30-10)/40 = 0.5
    expect(multiLevelDepthImbalance(q, 2)).toBeCloseTo(0.5)
  })
})
