import { describe, expect, it } from 'vitest'
import type { NewsAssetFilter, NewsItem } from '../types'
import { MOCK_NEWS } from './news.mock'

function matchesFilter(item: NewsItem, filter: NewsAssetFilter): boolean {
  if (filter === 'all') return true
  const tags = Array.isArray(item.tags) ? item.tags : []
  return tags.some((t) => t.toUpperCase() === filter.toUpperCase())
}

describe('news filter (tags)', () => {
  it('all returns everything', () => {
    expect(MOCK_NEWS.filter((n) => matchesFilter(n, 'all'))).toHaveLength(4)
  })
  it('BTC filter', () => {
    const ids = MOCK_NEWS.filter((n) => matchesFilter(n, 'BTC')).map((n) => n.id)
    expect(ids).toEqual(['t1', 't4'])
  })
  it('ETH filter', () => {
    const ids = MOCK_NEWS.filter((n) => matchesFilter(n, 'ETH')).map((n) => n.id)
    expect(ids).toEqual(['t2', 't4'])
  })
  it('macro filter', () => {
    const ids = MOCK_NEWS.filter((n) => matchesFilter(n, 'macro')).map((n) => n.id)
    expect(ids).toEqual(['t3', 't4'])
  })
})
