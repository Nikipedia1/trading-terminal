/** Asset filter chips for the News panel. */
export type NewsAssetFilter = 'all' | 'BTC' | 'ETH' | 'macro'

/**
 * Unified news item from GET /api/news.
 * publishedAt is ISO-8601 from the API; ms number accepted for tests.
 */
export interface NewsItem {
  id: string
  title: string
  source: string
  url: string
  /** ISO-8601 string or epoch milliseconds */
  publishedAt: string | number
  /** Free-form tags (e.g. BTC, ETH, macro) from the API */
  tags: string[]
}

export interface NewsApiResponse {
  items: NewsItem[]
  fetchedAt?: string
  sources?: string[]
  warnings?: string[]
}
