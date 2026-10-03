/** Asset filter chips for the News panel. */
export type NewsAssetFilter = 'all' | 'BTC' | 'ETH' | 'macro'

export interface NewsItem {
  id: string
  title: string
  source: string
  /** Unix epoch milliseconds */
  publishedAt: number
  url: string
  /** Tags used by the asset filter (e.g. BTC, ETH, macro). */
  assets: Array<'BTC' | 'ETH' | 'macro'>
}
