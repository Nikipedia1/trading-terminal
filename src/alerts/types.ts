/** Alert rule types – desk workflow */

export type AlertKind =
  | 'large_print'
  | 'stacked_imbalance'
  | 'delta_divergence'
  | 'book_pull'
  | 'price_poc'
  | 'price_vah'
  | 'price_val'
  | 'funding_spike'

export interface AlertRule {
  id: string
  kind: AlertKind
  enabled: boolean
  /** Optional symbol filter; empty = primary symbol */
  symbol?: string
  /** Kind-specific threshold */
  threshold?: number
  sound: boolean
  desktop: boolean
  webhook: boolean
  cooldownSec: number
}

export interface AlertEvent {
  id: string
  ruleId: string
  kind: AlertKind
  symbol: string
  message: string
  price?: number
  ts: number
}

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  large_print: 'Large print',
  stacked_imbalance: 'Stacked imbalance',
  delta_divergence: 'Delta divergence',
  book_pull: 'Book pull',
  price_poc: 'Price @ POC',
  price_vah: 'Price @ VAH',
  price_val: 'Price @ VAL',
  funding_spike: 'Funding spike',
}

export const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'r-large',
    kind: 'large_print',
    enabled: false,
    threshold: 50000, // USDT notional approx
    sound: true,
    desktop: true,
    webhook: false,
    cooldownSec: 30,
  },
  {
    id: 'r-stack',
    kind: 'stacked_imbalance',
    enabled: false,
    threshold: 3,
    sound: true,
    desktop: true,
    webhook: false,
    cooldownSec: 60,
  },
  {
    id: 'r-div',
    kind: 'delta_divergence',
    enabled: false,
    sound: true,
    desktop: false,
    webhook: false,
    cooldownSec: 120,
  },
  {
    id: 'r-pull',
    kind: 'book_pull',
    enabled: false,
    threshold: 3, // size drops by factor
    sound: true,
    desktop: true,
    webhook: false,
    cooldownSec: 20,
  },
  {
    id: 'r-poc',
    kind: 'price_poc',
    enabled: false,
    threshold: 0.0005, // relative distance
    sound: true,
    desktop: true,
    webhook: false,
    cooldownSec: 120,
  },
  {
    id: 'r-vah',
    kind: 'price_vah',
    enabled: false,
    threshold: 0.0005,
    sound: true,
    desktop: true,
    webhook: false,
    cooldownSec: 120,
  },
  {
    id: 'r-val',
    kind: 'price_val',
    enabled: false,
    threshold: 0.0005,
    sound: true,
    desktop: true,
    webhook: false,
    cooldownSec: 120,
  },
  {
    id: 'r-fund',
    kind: 'funding_spike',
    enabled: false,
    threshold: 0.001, // 0.1%
    sound: true,
    desktop: true,
    webhook: false,
    cooldownSec: 300,
  },
]
