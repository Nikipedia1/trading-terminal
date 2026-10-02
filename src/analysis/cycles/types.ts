/** Cycle analysis config & models – real OHLCV only. */

export interface CycleConfig {
  /** Master enable for overlay */
  enabled: boolean
  /** Draw bandpass cycle wave around trend */
  showWave: boolean
  /** Vertical marks at phase 0° / 180° */
  showPhaseMarks: boolean
  /** Show seasonality strip in menu (computed on demand) */
  showSeasonality: boolean
  /** Min/max period search window (bars) */
  minPeriod: number
  maxPeriod: number
  /** Fixed period override; 0 = auto dominant */
  fixedPeriod: number
}

export const DEFAULT_CYCLE_CONFIG: CycleConfig = {
  enabled: false,
  showWave: true,
  showPhaseMarks: true,
  showSeasonality: true,
  minPeriod: 8,
  maxPeriod: 80,
  fixedPeriod: 0,
}

export interface CyclePoint {
  time: number
  value: number
}

export interface CycleModel {
  /** Dominant cycle length in bars */
  period: number
  /** How period was chosen */
  periodSource: 'auto' | 'fixed'
  /** Autocorrelation peak strength [0,1] */
  strength: number
  /** Instantaneous phase degrees [0, 360) at last bar */
  phaseDeg: number
  /** Phase series 0–360 */
  phase: CyclePoint[]
  /** Bandpass cycle component (price units, mean ~0) */
  cycle: CyclePoint[]
  /** Trend (SMA of period) for wave anchoring */
  trend: CyclePoint[]
  /** Reconstructed wave = trend + cycle */
  wave: CyclePoint[]
  /** Schaff Trend Cycle 0–100 */
  stc: CyclePoint[]
  /** Bar indices (relative to series) near phase 0 / 180 */
  cycleHighTimes: number[]
  cycleLowTimes: number[]
  /** Weekday seasonality: 0=Sun..6=Sat average % return */
  weekdayReturns: { dow: number; avgPct: number; samples: number }[]
  barCount: number
  ready: boolean
}
