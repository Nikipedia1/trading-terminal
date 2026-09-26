import { describe, it, expect } from 'vitest'
import { aggressorFromBuyerMaker, feedKey } from '../types'

describe('aggressorFromBuyerMaker', () => {
  it('isBuyerMaker true → aggressor sell (hit bid)', () => {
    expect(aggressorFromBuyerMaker(true)).toBe('sell')
  })

  it('isBuyerMaker false → aggressor buy (lift ask)', () => {
    expect(aggressorFromBuyerMaker(false)).toBe('buy')
  })
})

describe('feedKey', () => {
  it('normalizes symbol to upper case', () => {
    expect(feedKey('binance', 'btcusdt')).toBe('binance:BTCUSDT')
  })

  it('is stable for same exchange+symbol', () => {
    expect(feedKey('kucoin', 'ETH-USDT')).toBe(feedKey('kucoin', 'eth-usdt'))
  })
})
