/** Indicator definitions - computed from real OHLCV only. */

export type IndicatorId =
  | 'sma'
  | 'ema'
  | 'wma'
  | 'vwma'
  | 'alma'
  | 'hull'
  | 'dema'
  | 'tema'
  | 'bb'
  | 'donchian'
  | 'keltner'
  | 'envelope'
  | 'supertrend'
  | 'vwap'
  | 'volsma'
  | 'ichimoku'
  | 'sar'
  | 'pivots'
  | 'rsi'
  | 'macd'
  | 'stoch'
  | 'atr'
  | 'cci'
  | 'willr'
  | 'momentum'
  | 'roc'
  | 'obv'
  | 'mfi'
  | 'adx'
  | 'ao'
  | 'trix'
  | 'ppo'
  | 'aroon'
  | 'dpo'
  | 'cmf'
  | 'adl'
  | 'force'
  | 'elderray'
  | 'uo'
  | 'cmo'
  | 'rvi'
  | 'stddev'
  | 'fisher'
  | 'vortex'
  | 'chop'
  | 'mass'
  | 'klinger'
  | 'smi'
  | 'mcginley'
  | 'lsma'
  | 'eom'
  | 'histvol'

export type PriceSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4'

export type IndicatorPane = 'overlay' | 'pane'

export interface IndicatorMeta {
  id: IndicatorId
  label: string
  short: string
  pane: IndicatorPane
  description: string
  group: 'MA' | 'Bands' | 'Trend' | 'Oscillator' | 'Volume'
}

export const INDICATOR_CATALOG: IndicatorMeta[] = [
  { id: 'sma', label: 'SMA', short: 'SMA', pane: 'overlay', group: 'MA', description: 'Simple MA (3 lengths)' },
  { id: 'ema', label: 'EMA', short: 'EMA', pane: 'overlay', group: 'MA', description: 'Exponential MA (3 lengths)' },
  { id: 'wma', label: 'WMA', short: 'WMA', pane: 'overlay', group: 'MA', description: 'Weighted MA' },
  { id: 'vwma', label: 'VWMA', short: 'VWMA', pane: 'overlay', group: 'MA', description: 'Volume-weighted MA' },
  { id: 'alma', label: 'ALMA', short: 'ALMA', pane: 'overlay', group: 'MA', description: 'Arnaud Legoux MA' },
  { id: 'hull', label: 'Hull MA', short: 'HMA', pane: 'overlay', group: 'MA', description: 'Hull Moving Average' },
  { id: 'dema', label: 'DEMA', short: 'DEMA', pane: 'overlay', group: 'MA', description: 'Double EMA' },
  { id: 'tema', label: 'TEMA', short: 'TEMA', pane: 'overlay', group: 'MA', description: 'Triple EMA' },
  { id: 'mcginley', label: 'McGinley Dynamic', short: 'MD', pane: 'overlay', group: 'MA', description: 'McGinley Dynamic MA' },
  { id: 'lsma', label: 'Least Squares MA', short: 'LSMA', pane: 'overlay', group: 'MA', description: 'Linear regression MA' },
  { id: 'bb', label: 'Bollinger', short: 'BB', pane: 'overlay', group: 'Bands', description: 'SMA +/- k sigma' },
  { id: 'donchian', label: 'Donchian', short: 'DC', pane: 'overlay', group: 'Bands', description: 'Highest high / lowest low' },
  { id: 'keltner', label: 'Keltner', short: 'KC', pane: 'overlay', group: 'Bands', description: 'EMA +/- ATR mult' },
  { id: 'envelope', label: 'Envelope', short: 'Env', pane: 'overlay', group: 'Bands', description: 'MA +/- %' },
  { id: 'supertrend', label: 'Supertrend', short: 'ST', pane: 'overlay', group: 'Trend', description: 'ATR-based trend line' },
  { id: 'sar', label: 'Parabolic SAR', short: 'SAR', pane: 'overlay', group: 'Trend', description: 'Stop and reverse' },
  { id: 'ichimoku', label: 'Ichimoku', short: 'Ichi', pane: 'overlay', group: 'Trend', description: 'Cloud + conversion/base' },
  { id: 'pivots', label: 'Pivot Points', short: 'Piv', pane: 'overlay', group: 'Trend', description: 'Classic P / R1-R2 / S1-S2' },
  { id: 'adx', label: 'ADX', short: 'ADX', pane: 'pane', group: 'Trend', description: 'ADX +DI -DI' },
  { id: 'aroon', label: 'Aroon', short: 'Aroon', pane: 'pane', group: 'Trend', description: 'Aroon Up / Down' },
  { id: 'vortex', label: 'Vortex', short: 'VI', pane: 'pane', group: 'Trend', description: 'Vortex Indicator +/-' },
  { id: 'vwap', label: 'VWAP', short: 'VWAP', pane: 'overlay', group: 'Volume', description: 'VWAP on loaded candles' },
  { id: 'volsma', label: 'Volume SMA', short: 'VolMA', pane: 'pane', group: 'Volume', description: 'Volume + SMA' },
  { id: 'obv', label: 'OBV', short: 'OBV', pane: 'pane', group: 'Volume', description: 'On-Balance Volume' },
  { id: 'mfi', label: 'MFI', short: 'MFI', pane: 'pane', group: 'Volume', description: 'Money Flow Index' },
  { id: 'cmf', label: 'CMF', short: 'CMF', pane: 'pane', group: 'Volume', description: 'Chaikin Money Flow' },
  { id: 'adl', label: 'A/D Line', short: 'ADL', pane: 'pane', group: 'Volume', description: 'Accumulation/Distribution' },
  { id: 'force', label: 'Force Index', short: 'FI', pane: 'pane', group: 'Volume', description: 'Elder Force Index' },
  { id: 'klinger', label: 'Klinger', short: 'KO', pane: 'pane', group: 'Volume', description: 'Klinger Volume Oscillator' },
  { id: 'eom', label: 'Ease of Movement', short: 'EOM', pane: 'pane', group: 'Volume', description: 'Arms Ease of Movement' },
  { id: 'rsi', label: 'RSI', short: 'RSI', pane: 'pane', group: 'Oscillator', description: 'Relative Strength Index' },
  { id: 'macd', label: 'MACD', short: 'MACD', pane: 'pane', group: 'Oscillator', description: 'MACD / signal / hist' },
  { id: 'stoch', label: 'Stochastic', short: 'Stoch', pane: 'pane', group: 'Oscillator', description: '%K / %D' },
  { id: 'cci', label: 'CCI', short: 'CCI', pane: 'pane', group: 'Oscillator', description: 'Commodity Channel Index' },
  { id: 'willr', label: 'Williams %R', short: '%R', pane: 'pane', group: 'Oscillator', description: 'Williams percent range' },
  { id: 'momentum', label: 'Momentum', short: 'Mom', pane: 'pane', group: 'Oscillator', description: 'Close - close[n]' },
  { id: 'roc', label: 'ROC', short: 'ROC', pane: 'pane', group: 'Oscillator', description: 'Rate of Change %' },
  { id: 'atr', label: 'ATR', short: 'ATR', pane: 'pane', group: 'Oscillator', description: 'Average True Range' },
  { id: 'ao', label: 'Awesome Osc', short: 'AO', pane: 'pane', group: 'Oscillator', description: 'SMA5-SMA34 of median' },
  { id: 'trix', label: 'TRIX', short: 'TRIX', pane: 'pane', group: 'Oscillator', description: 'Triple EMA rate of change' },
  { id: 'ppo', label: 'PPO', short: 'PPO', pane: 'pane', group: 'Oscillator', description: 'Percentage Price Oscillator' },
  { id: 'dpo', label: 'DPO', short: 'DPO', pane: 'pane', group: 'Oscillator', description: 'Detrended Price Oscillator' },
  { id: 'elderray', label: 'Elder Ray', short: 'Elder', pane: 'pane', group: 'Oscillator', description: 'Bull / Bear Power' },
  { id: 'uo', label: 'Ultimate Osc', short: 'UO', pane: 'pane', group: 'Oscillator', description: 'Ultimate Oscillator' },
  { id: 'cmo', label: 'CMO', short: 'CMO', pane: 'pane', group: 'Oscillator', description: 'Chande Momentum' },
  { id: 'rvi', label: 'RVI', short: 'RVI', pane: 'pane', group: 'Oscillator', description: 'Relative Vigor Index' },
  { id: 'stddev', label: 'Std Dev', short: 'sigma', pane: 'pane', group: 'Oscillator', description: 'Rolling standard deviation' },
  { id: 'fisher', label: 'Fisher Transform', short: 'Fisher', pane: 'pane', group: 'Oscillator', description: 'Fisher Transform of median price' },
  { id: 'chop', label: 'Choppiness', short: 'CHOP', pane: 'pane', group: 'Oscillator', description: 'Choppiness Index' },
  { id: 'mass', label: 'Mass Index', short: 'Mass', pane: 'pane', group: 'Oscillator', description: 'Mass Index (reversal bulge)' },
  { id: 'smi', label: 'SMI Ergodic', short: 'SMI', pane: 'pane', group: 'Oscillator', description: 'Stochastic Momentum Index Ergodic' },
  { id: 'histvol', label: 'Hist Volatility', short: 'HV', pane: 'pane', group: 'Oscillator', description: 'Annualized historical volatility' },
]

export interface IndicatorParams {
  visible: boolean
  period: number
  period2: number
  period3: number
  mult: number
  mult2: number
  source: PriceSource
  color: string
  color2: string
  color3: string
  lineWidth: number
  lineWidth2: number
  lineWidth3: number
  show1: boolean
  show2: boolean
  show3: boolean
  levelHigh: number
  levelLow: number
  showValue: boolean
}

export type IndicatorParamsMap = Record<IndicatorId, IndicatorParams>

function base(
  partial: Partial<IndicatorParams> & Pick<IndicatorParams, 'period' | 'color'>
): IndicatorParams {
  return {
    visible: false,
    period2: 0,
    period3: 0,
    mult: 2,
    mult2: 0.2,
    source: 'close',
    color2: '#3b82f6',
    color3: '#a855f7',
    lineWidth: 2,
    lineWidth2: 1,
    lineWidth3: 1,
    show1: true,
    show2: true,
    show3: true,
    levelHigh: 70,
    levelLow: 30,
    showValue: true,
    ...partial,
  }
}

export const DEFAULT_INDICATOR_PARAMS: IndicatorParamsMap = {
  sma: base({ period: 20, period2: 50, period3: 200, color: '#f0b90b', color2: '#3b82f6', color3: '#a855f7' }),
  ema: base({ period: 9, period2: 21, period3: 55, color: '#22d3ee', color2: '#fb923c', color3: '#e879f9' }),
  wma: base({ period: 20, color: '#34d399' }),
  vwma: base({ period: 20, color: '#2dd4bf' }),
  alma: base({ period: 9, mult: 0.85, mult2: 6, color: '#a3e635' }),
  hull: base({ period: 16, color: '#f472b6' }),
  dema: base({ period: 21, color: '#60a5fa' }),
  tema: base({ period: 21, color: '#c084fc' }),
  mcginley: base({ period: 14, mult: 0.6, color: '#f0b90b' }),
  lsma: base({ period: 25, color: '#3b82f6' }),
  bb: base({ period: 20, mult: 2, color: '#848e9c', color2: '#3b82f6', color3: '#848e9c', lineWidth: 1 }),
  donchian: base({ period: 20, color: '#94a3b8', color2: '#f0b90b', color3: '#94a3b8', lineWidth: 1 }),
  keltner: base({ period: 20, period2: 10, mult: 1.5, color: '#64748b', color2: '#22d3ee', color3: '#64748b', lineWidth: 1 }),
  envelope: base({ period: 20, mult: 2.5, color: '#94a3b8', color2: '#f0b90b', color3: '#94a3b8', lineWidth: 1 }),
  stddev: base({ period: 20, color: '#a78bfa' }),
  supertrend: base({ period: 10, mult: 3, color: '#0ecb81', color2: '#f6465d' }),
  sar: base({ period: 0, mult: 0.02, mult2: 0.2, color: '#f0b90b' }),
  ichimoku: base({ period: 9, period2: 26, period3: 52, color: '#22d3ee', color2: '#f6465d', color3: '#848e9c', lineWidth: 1 }),
  pivots: base({ period: 0, color: '#f0b90b', color2: '#0ecb81', color3: '#f6465d', lineWidth: 1 }),
  vwap: base({ period: 0, color: '#f59e0b' }),
  volsma: base({ period: 20, color: '#848e9c', color2: '#f0b90b' }),
  rsi: base({ period: 14, color: '#c084fc', levelHigh: 70, levelLow: 30 }),
  macd: base({ period: 12, period2: 26, period3: 9, color: '#22d3ee', color2: '#f0b90b', color3: '#848e9c' }),
  stoch: base({ period: 14, period2: 3, period3: 3, color: '#22d3ee', color2: '#f6465d', levelHigh: 80, levelLow: 20 }),
  cci: base({ period: 20, color: '#a78bfa', levelHigh: 100, levelLow: -100 }),
  willr: base({ period: 14, color: '#fb7185', levelHigh: -20, levelLow: -80 }),
  momentum: base({ period: 10, color: '#38bdf8' }),
  roc: base({ period: 12, color: '#4ade80' }),
  atr: base({ period: 14, color: '#94a3b8' }),
  adx: base({ period: 14, color: '#f0b90b', color2: '#0ecb81', color3: '#f6465d' }),
  obv: base({ period: 0, color: '#67e8f9' }),
  mfi: base({ period: 14, color: '#e879f9', levelHigh: 80, levelLow: 20 }),
  ao: base({ period: 5, period2: 34, color: '#0ecb81', color2: '#f6465d' }),
  trix: base({ period: 15, color: '#f472b6' }),
  ppo: base({ period: 12, period2: 26, period3: 9, color: '#22d3ee', color2: '#f0b90b' }),
  aroon: base({ period: 25, color: '#0ecb81', color2: '#f6465d' }),
  dpo: base({ period: 20, color: '#a78bfa' }),
  cmf: base({ period: 20, color: '#2dd4bf', levelHigh: 0.25, levelLow: -0.25 }),
  adl: base({ period: 0, color: '#67e8f9' }),
  force: base({ period: 13, color: '#fb923c' }),
  elderray: base({ period: 13, color: '#0ecb81', color2: '#f6465d' }),
  uo: base({ period: 7, period2: 14, period3: 28, color: '#c084fc', levelHigh: 70, levelLow: 30 }),
  cmo: base({ period: 14, color: '#e879f9', levelHigh: 50, levelLow: -50 }),
  rvi: base({ period: 10, period2: 4, color: '#22d3ee', color2: '#f0b90b' }),
  fisher: base({ period: 10, color: '#c084fc', levelHigh: 1.5, levelLow: -1.5 }),
  vortex: base({ period: 14, color: '#0ecb81', color2: '#f6465d' }),
  chop: base({ period: 14, color: '#f0b90b', levelHigh: 61.8, levelLow: 38.2 }),
  mass: base({ period: 9, period2: 25, color: '#22d3ee', levelHigh: 27 }),
  klinger: base({ period: 34, period2: 55, period3: 13, color: '#22d3ee', color2: '#f0b90b' }),
  smi: base({ period: 10, period2: 3, period3: 3, color: '#c084fc', color2: '#f0b90b' }),
  eom: base({ period: 14, color: '#22d3ee' }),
  histvol: base({ period: 20, color: '#a855f7' }),
}

export interface LinePoint {
  time: number
  value: number
}

export const PRICE_SOURCES: PriceSource[] = ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4']

export interface IndicatorValueRow {
  id: IndicatorId
  label: string
  values: { name: string; value: number; color: string }[]
}
