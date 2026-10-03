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
  /** Optional body/snippet when available (RSS description) */
  text?: string
}

export interface NewsApiResponse {
  items: NewsItem[]
  fetchedAt?: string
  sources?: string[]
  warnings?: string[]
}

export type NewsDirezione = 'rialzista' | 'ribassista' | 'neutra'
export type NewsOrizzonte = 'minuti' | 'ore' | 'giorni'

/** Response of POST /api/news-analyze – only these fields. */
export interface NewsImpactAnalysis {
  sintesi: string
  asset_coinvolti: string[]
  direzione: NewsDirezione
  forza: number
  orizzonte: NewsOrizzonte
  meccanismo: string
  rischi: string[]
  livelli_da_osservare: string
  confidenza: number
}
