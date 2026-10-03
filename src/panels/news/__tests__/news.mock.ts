/**
 * Mock news fixtures – TEST ONLY. Never import from production panel code.
 */
import type { NewsItem } from '../types'

const HOUR = 3_600_000

export const MOCK_NEWS: NewsItem[] = [
  {
    id: 'mock-1',
    title: 'Bitcoin holds above key support as ETF flows stabilize',
    source: 'CoinDesk',
    publishedAt: Date.now() - 1 * HOUR,
    url: 'https://example.com/news/btc-support',
    assets: ['BTC'],
  },
  {
    id: 'mock-2',
    title: 'Ethereum staking yields compress after Dencun anniversary',
    source: 'The Block',
    publishedAt: Date.now() - 3 * HOUR,
    url: 'https://example.com/news/eth-staking',
    assets: ['ETH'],
  },
  {
    id: 'mock-3',
    title: 'Fed speakers signal patience on rate path',
    source: 'Reuters',
    publishedAt: Date.now() - 5 * HOUR,
    url: 'https://example.com/news/fed-patience',
    assets: ['macro'],
  },
  {
    id: 'mock-4',
    title: 'BTC and ETH correlation ticks higher into CPI week',
    source: 'Bloomberg',
    publishedAt: Date.now() - 8 * HOUR,
    url: 'https://example.com/news/btc-eth-cpi',
    assets: ['BTC', 'ETH', 'macro'],
  },
  {
    id: 'mock-5',
    title: 'Macro: dollar index softens on mixed labor data',
    source: 'WSJ',
    publishedAt: Date.now() - 12 * HOUR,
    url: 'https://example.com/news/dxy-labor',
    assets: ['macro'],
  },
]
