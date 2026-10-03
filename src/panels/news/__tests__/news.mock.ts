/**
 * Test-only fixtures. Never imported by production NewsPanel fetch path.
 */
import type { NewsItem } from '../types'

export const MOCK_NEWS: NewsItem[] = [
  {
    id: 't1',
    title: 'Bitcoin ETF inflows hit weekly high',
    source: 'CoinDesk',
    url: 'https://example.test/btc-etf',
    publishedAt: Date.now() - 60_000,
    tags: ['BTC'],
  },
  {
    id: 't2',
    title: 'Ethereum upgrade timeline confirmed',
    source: 'Cointelegraph',
    url: 'https://example.test/eth-upgrade',
    publishedAt: Date.now() - 120_000,
    tags: ['ETH'],
  },
  {
    id: 't3',
    title: 'Fed signals slower path for rate cuts',
    source: 'Reuters',
    url: 'https://example.test/fed-macro',
    publishedAt: Date.now() - 180_000,
    tags: ['macro'],
  },
  {
    id: 't4',
    title: 'BTC and ETH correlation with equities rises',
    source: 'The Block',
    url: 'https://example.test/btc-eth-macro',
    publishedAt: Date.now() - 240_000,
    tags: ['BTC', 'ETH', 'macro'],
  },
]
