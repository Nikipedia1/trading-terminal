/** Time Price Opportunity (Market Profile) types */

export interface TpoConfig {
  /** Minutes per TPO period (classic = 30) */
  periodMinutes: number
  /** Fraction of total TPO count for Value Area (default 0.70) */
  valueAreaPct: number
  /** First N periods define Initial Balance */
  ibPeriods: number
  /** Max periods to show (letters) */
  maxPeriods: number
}

export const DEFAULT_TPO_CONFIG: TpoConfig = {
  periodMinutes: 30,
  valueAreaPct: 0.7,
  ibPeriods: 2,
  maxPeriods: 48,
}

export interface TpoLevel {
  price: number
  /** Letters that printed at this price (period order) */
  letters: string[]
  count: number
  inValueArea: boolean
  isPoc: boolean
  isSinglePrint: boolean
}

export interface TpoModel {
  levels: TpoLevel[]
  periods: { letter: string; timeSec: number; high: number; low: number }[]
  poc: number | null
  vah: number | null
  val: number | null
  ibHigh: number | null
  ibLow: number | null
  totalTpo: number
  tickSize: number
  periodMinutes: number
}

export const TPO_NOTE =
  'TPO from OHLC bars (period blocks). For tick-true profile use Cluster/Footprint with Live.'
