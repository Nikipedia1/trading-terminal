/** Trading bot definitions – paper execution only. */

export type BotKind =
  | 'grid'
  | 'dca'
  | 'rsi'
  | 'ema_cross'
  | 'breakout'
  | 'bollinger'

export type BotStatus = 'idle' | 'running' | 'paused' | 'error'

export type SizingMode = 'fixed' | 'risk_pct'
export type SentimentMode = 'off' | 'filter' | 'align' | 'scale'

export interface BotRiskConfig {
  sizingMode: SizingMode
  riskPerTradePct: number
  maxDailyLossPct: number | null
  maxExposurePct: number | null
  maxOpenPositions: number | null
  maxLeverage: number | null
  maxQty: number | null
  requireStopLoss: boolean
  useSentiment: boolean
  sentimentMode: SentimentMode
  sentimentMinScore: number
}

export interface BotBaseConfig {
  symbol: string
  qty: number
  leverage: number
  cooldownSec: number
  maxPositions: number
  stopLossPct: number | null
  takeProfitPct: number | null
  risk: BotRiskConfig
}

export interface GridParams {
  levels: number
  rangePct: number
}

export interface DcaParams {
  intervalMin: number
  maxOrders: number
}

export interface RsiParams {
  period: number
  oversold: number
  overbought: number
}

export interface EmaParams {
  fast: number
  slow: number
}

export interface BreakoutParams {
  lookback: number
  bufferPct: number
}

export interface BollingerParams {
  period: number
  stdDev: number
}

export type BotParams =
  | { kind: 'grid'; grid: GridParams }
  | { kind: 'dca'; dca: DcaParams }
  | { kind: 'rsi'; rsi: RsiParams }
  | { kind: 'ema_cross'; ema: EmaParams }
  | { kind: 'breakout'; breakout: BreakoutParams }
  | { kind: 'bollinger'; bollinger: BollingerParams }

export interface BotInstance {
  id: string
  name: string
  kind: BotKind
  status: BotStatus
  enabled: boolean
  config: BotBaseConfig
  params: BotParams
  createdAt: number
  lastTickAt: number | null
  lastSignal: string | null
  lastError: string | null
  stats: {
    trades: number
    wins: number
    losses: number
    realizedPnl: number
  }
  runtime?: {
    lastOrderAt?: number
    dcaCount?: number
    gridCenter?: number
    lastSide?: 'long' | 'short' | null
    dayKey?: string
    dayPnl?: number
    dayTrades?: number
  }
}

export const BOT_KIND_META: Record<BotKind, { label: string; hint: string }> = {
  grid: { label: 'Grid', hint: 'Buy low / sell high in a price range' },
  dca: { label: 'DCA', hint: 'Dollar-cost average buys on a timer' },
  rsi: { label: 'RSI Reversion', hint: 'Long oversold, short overbought' },
  ema_cross: { label: 'EMA Cross', hint: 'Trend follow on fast/slow EMA cross' },
  breakout: { label: 'Breakout', hint: 'Enter on range high/low break' },
  bollinger: { label: 'Bollinger', hint: 'Mean reversion at band extremes' },
}

export function defaultParams(kind: BotKind): BotParams {
  switch (kind) {
    case 'grid':
      return { kind: 'grid', grid: { levels: 5, rangePct: 4 } }
    case 'dca':
      return { kind: 'dca', dca: { intervalMin: 15, maxOrders: 20 } }
    case 'rsi':
      return { kind: 'rsi', rsi: { period: 14, oversold: 30, overbought: 70 } }
    case 'ema_cross':
      return { kind: 'ema_cross', ema: { fast: 9, slow: 21 } }
    case 'breakout':
      return { kind: 'breakout', breakout: { lookback: 20, bufferPct: 0.1 } }
    case 'bollinger':
      return { kind: 'bollinger', bollinger: { period: 20, stdDev: 2 } }
  }
}

export function defaultRiskConfig(): BotRiskConfig {
  return {
    sizingMode: 'risk_pct',
    riskPerTradePct: 1,
    maxDailyLossPct: 5,
    maxExposurePct: 50,
    maxOpenPositions: 3,
    maxLeverage: 20,
    maxQty: null,
    requireStopLoss: true,
    useSentiment: true,
    sentimentMode: 'filter',
    sentimentMinScore: -0.15,
  }
}

export function defaultConfig(symbol = 'BTCUSDT'): BotBaseConfig {
  return {
    symbol,
    qty: 0.001,
    leverage: 5,
    cooldownSec: 60,
    maxPositions: 1,
    stopLossPct: 2,
    takeProfitPct: 3,
    risk: defaultRiskConfig(),
  }
}

export function ensureRisk(cfg: BotBaseConfig): BotBaseConfig {
  if (cfg.risk && typeof cfg.risk === 'object') {
    return {
      ...cfg,
      risk: { ...defaultRiskConfig(), ...cfg.risk },
    }
  }
  return { ...cfg, risk: defaultRiskConfig() }
}
