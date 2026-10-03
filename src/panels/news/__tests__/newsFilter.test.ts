/**
 * News filter helpers – uses mock data from news.mock.ts only.
 */
import { describe, it, expect } from 'vitest'
import { MOCK_NEWS } from './news.mock'
import type { NewsAssetFilter, NewsItem } from '../types'

function matchesFilter(item: NewsItem, filter: NewsAssetFilter): boolean {
  if (filter === 'all') return true
  return item.assets.includes(filter)
}

describe('News mock filter', () => {
  it('exposes mock headlines for tests only', () => {
    expect(MOCK_NEWS.length).toBeGreaterThanOrEqual(4)
    expect(MOCK_NEWS.every((n) => n.title && n.source && n.url)).toBe(true)
  })

  it('filters BTC', () => {
    const btc = MOCK_NEWS.filter((n) => matchesFilter(n, 'BTC'))
    expect(btc.length).toBeGreaterThan(0)
    expect(btc.every((n) => n.assets.includes('BTC'))).toBe(true)
  })

  it('filters ETH', () => {
    const eth = MOCK_NEWS.filter((n) => matchesFilter(n, 'ETH'))
    expect(eth.every((n) => n.assets.includes('ETH'))).toBe(true)
  })

  it('filters macro', () => {
    const macro = MOCK_NEWS.filter((n) => matchesFilter(n, 'macro'))
    expect(macro.every((n) => n.assets.includes('macro'))).toBe(true)
  })

  it('all returns everything', () => {
    expect(MOCK_NEWS.filter((n) => matchesFilter(n, 'all'))).toHaveLength(MOCK_NEWS.length)
  })
})
