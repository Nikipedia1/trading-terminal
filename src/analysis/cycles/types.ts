/** Cycle analysis config & models – real OHLCV only. */

export interface CycleConfig {
  /** Master enable for overlay */
  enabled: boolean
  /** Draw bandpass cycle wave around trend */
  showWave: boolean
  /** Vertical marks at phase 0° / 180° (historical) */
  showPhaseMarks: boolean
  /** Show seasonality strip in menu (computed on demand) */
  showSeasonality: boolean
  /** Amplitude envelope around trend */
  showAmplitude: boolean
  /** Projected next cycle high/low markers */
  showProjections: boolean
  /** Secondary dominant period wave (lighter) */
  showSecondary: boolean
  /** On-chart HUD readout */
  showHud: boolean
  /** Min/max period search window (bars) */
  minPeriod: number
  maxPeriod: number
  /** Fixed period override; 0 = auto dominant */
  fixedPeriod: number
  /** Wave stroke opacity 0.2–1 */
  waveOpacity: number
}

export const DEFAULT_CYCLE_CONFIG: CycleConfig = {
  enabled: false,
  showWave: true,
  showPhaseMarks: true,
  showSeasonality: true,
  showAmplitude: true,
  showProjections: true,
  showSecondary: false,
  showHud: true,
  minPeriod: 8,
  maxPeriod: 80,
  fixedPeriod: 0,
  waveOpacity: 0.85,
}

/** Named presets for quick setup */
export const CYCLE_PRESETS: Record<
  string,
  { label: string; patch: Partial<CycleConfig> }
> = {
  scalp: {
    label: 'Scalp',
    patch: { minPeriod: 5, maxPeriod: 25, fixedPeriod: 0, showSecondary: false },
  },
  intraday: {
    label: 'Intraday',
    patch: { minPeriod: 8, maxPeriod: 50, fixedPeriod: 0, showSecondary: true },
  },
  swing: {
    label: 'Swing',
    patch: { minPeriod: 15, maxPeriod: 120, fixedPeriod: 0, showSecondary: true },
  },
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
  /** Secondary period (bars), 0 if none */
  secondaryPeriod: number
  /** Secondary strength [0,1] */
  secondaryStrength: number
  /** Instantaneous phase degrees [0, 360) at last bar */
  phaseDeg: number
  /** Instantaneous amplitude (price units) at last bar */
  amplitude: number
  /** Phase series 0–360 */
  phase: CyclePoint[]
  /** Bandpass cycle component (price units, mean ~0) */
  cycle: CyclePoint[]
  /** Secondary bandpass component */
  cycle2: CyclePoint[]
  /** Trend (SMA of period) for wave anchoring */
  trend: CyclePoint[]
  /** Reconstructed wave = trend + cycle */
  wave: CyclePoint[]
  /** Secondary wave = trend + cycle2 */
  wave2: CyclePoint[]
  /** Upper amplitude envelope = trend + amp */
  ampUpper: CyclePoint[]
  /** Lower amplitude envelope = trend − amp */
  ampLower: CyclePoint[]
  /** Schaff Trend Cycle 0–100 */
  stc: CyclePoint[]
  /** Historical cycle high times (phase ~0 cross) */
  cycleHighTimes: number[]
  /** Historical cycle low times (phase ~180 cross) */
  cycleLowTimes: number[]
  /** Projected next high time (unix sec), null if not ready */
  nextHighTime: number | null
  /** Projected next low time (unix sec) */
  nextLowTime: number | null
  /** Bars until next turning point (high or low, whichever sooner) */
  barsToNextTurn: number | null
  /** Label of next turn */
  nextTurnKind: 'high' | 'low' | null
  /** Weekday seasonality: 0=Sun..6=Sat average % return */
  weekdayReturns: { dow: number; avgPct: number; samples: number }[]
  barCount: number
  barDurationSec: number
  ready: boolean
}
