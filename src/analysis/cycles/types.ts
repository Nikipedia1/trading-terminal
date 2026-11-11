/** Cycle analysis config & models – real OHLCV only (Hurst-style tools). */

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
  /**
   * Future Line of Demarcation (Hurst):
   * median price shifted forward by half the dominant period.
   */
  showFld: boolean
  /** Secondary FLD for secondary period */
  showFldSecondary: boolean
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
  showFld: true,
  showFldSecondary: false,
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
    patch: { minPeriod: 5, maxPeriod: 25, fixedPeriod: 0, showSecondary: false, showFld: true },
  },
  intraday: {
    label: 'Intraday',
    patch: {
      minPeriod: 8,
      maxPeriod: 50,
      fixedPeriod: 0,
      showSecondary: true,
      showFld: true,
      showFldSecondary: true,
    },
  },
  swing: {
    label: 'Swing',
    patch: {
      minPeriod: 15,
      maxPeriod: 120,
      fixedPeriod: 0,
      showSecondary: true,
      showFld: true,
      showFldSecondary: true,
    },
  },
}

export interface CyclePoint {
  time: number
  value: number
}

/** Spectral peak from autocorrelation / periodogram proxy */
export interface SpectrumPeak {
  period: number
  strength: number
}

export interface CycleModel {
  period: number
  periodSource: 'auto' | 'fixed'
  strength: number
  secondaryPeriod: number
  secondaryStrength: number
  phaseDeg: number
  amplitude: number
  phase: CyclePoint[]
  cycle: CyclePoint[]
  cycle2: CyclePoint[]
  trend: CyclePoint[]
  wave: CyclePoint[]
  wave2: CyclePoint[]
  ampUpper: CyclePoint[]
  ampLower: CyclePoint[]
  stc: CyclePoint[]
  /** FLD primary: hl2 shifted forward by floor(period/2) bars */
  fld: CyclePoint[]
  fld2: CyclePoint[]
  fldBias: 'bull' | 'bear' | 'flat' | null
  spectrum: SpectrumPeak[]
  cycleHighTimes: number[]
  cycleLowTimes: number[]
  nextHighTime: number | null
  nextLowTime: number | null
  barsToNextTurn: number | null
  nextTurnKind: 'high' | 'low' | null
  weekdayReturns: { dow: number; avgPct: number; samples: number }[]
  barCount: number
  barDurationSec: number
  ready: boolean
}
