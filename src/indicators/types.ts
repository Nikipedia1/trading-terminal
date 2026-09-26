/** Indicator definitions – computed from real OHLCV only. */

export type IndicatorId =
  | 'sma'
  | 'ema'
  | 'bb'
  | 'rsi'
  | 'macd'
  | 'stoch'
  | 'atr'
  | 'vwap'

export type IndicatorPane = 'overlay' | 'pane'

export interface IndicatorMeta {
  id: IndicatorId
  label: string
  short: string
  pane: IndicatorPane
  description: string
}

export const INDICATOR_CATALOG: IndicatorMeta[] = [
  {
    id: 'sma',
    label: 'SMA',
    short: 'SMA',
    pane: 'overlay',
    description: 'Simple Moving Average',
  },
  {
    id: 'ema',
    label: 'EMA',
    short: 'EMA',
    pane: 'overlay',
    description: 'Exponential Moving Average',
  },
  {
    id: 'bb',
    label: 'Bollinger Bands',
    short: 'BB',
    pane: 'overlay',
    description: 'SMA ± k·σ',
  },
  {
    id: 'vwap',
    label: 'VWAP',
    short: 'VWAP',
    pane: 'overlay',
    description: 'Volume-weighted avg (from loaded candles)',
  },
  {
    id: 'rsi',
    label: 'RSI',
    short: 'RSI',
    pane: 'pane',
    description: 'Relative Strength Index',
  },
  {
    id: 'macd',
    label: 'MACD',
    short: 'MACD',
    pane: 'pane',
    description: 'MACD line, signal, histogram',
  },
  {
    id: 'stoch',
    label: 'Stochastic',
    short: 'Stoch',
    pane: 'pane',
    description: '%K / %D oscillator',
  },
  {
    id: 'atr',
    label: 'ATR',
    short: 'ATR',
    pane: 'pane',
    description: 'Average True Range',
  },
]

export interface IndicatorParams {
  /** Common period (SMA/EMA/RSI/ATR/BB length) */
  period: number
  /** Second period (EMA fast for MACD, %K smooth for Stoch) */
  period2: number
  /** Third period (MACD signal, Stoch %D) */
  period3: number
  /** Bollinger std-dev multiplier */
  mult: number
  color: string
  color2: string
  color3: string
  visible: boolean
}

export type IndicatorParamsMap = Record<IndicatorId, IndicatorParams>

export const DEFAULT_INDICATOR_PARAMS: IndicatorParamsMap = {
  sma: {
    period: 20,
    period2: 50,
    period3: 200,
    mult: 2,
    color: '#f0b90b',
    color2: '#3b82f6',
    color3: '#a855f7',
    visible: false,
  },
  ema: {
    period: 9,
    period2: 21,
    period3: 55,
    mult: 2,
    color: '#22d3ee',
    color2: '#fb923c',
    color3: '#e879f9',
    visible: false,
  },
  bb: {
    period: 20,
    period2: 0,
    period3: 0,
    mult: 2,
    color: '#848e9c',
    color2: '#3b82f6',
    color3: '#848e9c',
    visible: false,
  },
  vwap: {
    period: 0,
    period2: 0,
    period3: 0,
    mult: 0,
    color: '#f59e0b',
    color2: '#f59e0b',
    color3: '#f59e0b',
    visible: false,
  },
  rsi: {
    period: 14,
    period2: 0,
    period3: 0,
    mult: 0,
    color: '#c084fc',
    color2: '#848e9c',
    color3: '#848e9c',
    visible: false,
  },
  macd: {
    period: 12,
    period2: 26,
    period3: 9,
    mult: 0,
    color: '#22d3ee',
    color2: '#f0b90b',
    color3: '#848e9c',
    visible: false,
  },
  stoch: {
    period: 14,
    period2: 3,
    period3: 3,
    mult: 0,
    color: '#22d3ee',
    color2: '#f6465d',
    color3: '#848e9c',
    visible: false,
  },
  atr: {
    period: 14,
    period2: 0,
    period3: 0,
    mult: 0,
    color: '#94a3b8',
    color2: '#94a3b8',
    color3: '#94a3b8',
    visible: false,
  },
}

export interface LinePoint {
  time: number
  value: number
}
