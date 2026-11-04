/** Ops Scanner types */
export type ScanBias = 'long' | 'short' | 'neutral'
export type ScanSetup =
  | 'breakout'
  | 'mean-revert'
  | 'trend-cont'
  | 'range'
  | 'squeeze'
  | 'none'

export interface ScanRow {
  symbol: string
  last: number
  changePct: number
  high: number
  low: number
  rangePos: number
  bias: ScanBias
  setup: ScanSetup
  score: number
  summary: string
  volumeProxy: number
  interval: string
  exchange: string
  updatedAt: number
}

export type ScanFilter = 'all' | 'long' | 'short' | 'high-score'
