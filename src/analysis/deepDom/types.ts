/** DeepDom – time × price heatmap of resting L2 liquidity + delta / surprise / magnet */

export type DomSurprise = 'refill' | 'pull'

export interface DomLevel {
  price: number
  qty: number
  /** +1 ask, -1 bid (for optional tint) */
  side: 1 | -1
  /** Δ qty vs previous sample at same price (0 if new level or first sample) */
  deltaQty: number
  /** Consecutive samples this price has had qty > 0 (magnet persistence) */
  persistence: number
  /** Book surprise on this sample, if any */
  surprise: DomSurprise | null
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
  /**
   * Surprise factor K: if prevQty > 0 and qty/prevQty >= K → REFILL;
   * if qty/prevQty <= 1/K (or level vanishes with large prev) → PULL.
   * Default 3.
   */
  surpriseFactor: number
  /** Magnet: levels present for >= M consecutive samples get outline */
  magnetSamples: number
  /** Color heatmap by |delta| instead of absolute size when true */
  showDelta: boolean
  /** Draw REFILL / PULL text markers */
  showSurprise: boolean
  /** Outline stable (magnet) levels */
  showMagnet: boolean
}

export const DEFAULT_DEEP_DOM_CONFIG: DeepDomConfig = {
  windowMinutes: 5,
  sampleMs: 1000,
  bandPct: 0.003,
  surpriseFactor: 3,
  magnetSamples: 5,
  showDelta: true,
  showSurprise: true,
  showMagnet: true,
}

/** Known public L2 limits – shown in UI, not hidden. */
export const L2_GRANULARITY_NOTES: Record<string, string> = {
  binance: 'Binance L2: snapshot 1000 levels + depth@100ms – adatto a DeepDom.',
  kucoin:
    'KuCoin pubblico: REST level2_100 (≤100 livelli/lato). Heatmap più stretta rispetto a Binance; niente inventare livelli. Nessuna spoofing detection istituzionale su feed pubblico.',
}
