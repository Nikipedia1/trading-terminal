/** DeepDom – time × price heatmap of resting L2 liquidity */

export interface DomLevel {
  price: number
  qty: number
  /** +1 ask, -1 bid (for optional tint) */
  side: 1 | -1
}

export interface DomSnapshot {
  /** unix seconds */
  timeSec: number
  mid: number
  levels: DomLevel[]
}

export interface DeepDomConfig {
  /** Sliding window length in minutes */
  windowMinutes: number
  /** Sample interval ms */
  sampleMs: number
  /** Price band as fraction of mid (e.g. 0.002 = ±0.2%) */
  bandPct: number
}

export const DEFAULT_DEEP_DOM_CONFIG: DeepDomConfig = {
  windowMinutes: 5,
  sampleMs: 1000,
  bandPct: 0.003,
}

/** Known public L2 limits – shown in UI, not hidden. */
export const L2_GRANULARITY_NOTES: Record<string, string> = {
  binance: 'Binance L2: snapshot 1000 levels + depth@100ms – adatto a DeepDom.',
  kucoin:
    'KuCoin pubblico: REST level2_100 (≤100 livelli/lato). Heatmap più stretta rispetto a Binance; niente inventare livelli.',
}
