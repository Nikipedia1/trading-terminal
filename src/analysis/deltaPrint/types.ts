/** Delta Print config (histogram + optional CVD + divergence flags) */

export interface DeltaPrintConfig {
  /** Show cumulative delta line */
  cvd: boolean
  /** Annotate price/delta divergences (markers only) */
  divergence: boolean
  /** Hide histogram bars with |delta| < this % of max |delta| in window (0 = show all) */
  minBarPct: number
}

export const DEFAULT_DELTA_CONFIG: DeltaPrintConfig = {
  cvd: false,
  divergence: false,
  minBarPct: 0,
}
