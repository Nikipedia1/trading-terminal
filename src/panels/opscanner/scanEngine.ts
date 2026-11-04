/**
 * Lightweight multi-symbol ops scanner.
 * Uses existing candle analysis — no invented prices.
 */
import type { Candle } from '@/types'
import { analyzeCandles } from '@/analysis/aiDesk/taEngine'
import type { ScanBias, ScanRow, ScanSetup } from './types'

export const SCAN_UNIVERSE = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'NEARUSDT',
  'DOTUSDT',
  'ATOMUSDT',
  'LTCUSDT',
  'APTUSDT',
  'ARBUSDT',
  'OPUSDT',
  'SUIUSDT',
  'INJUSDT',
  'TIAUSDT',
  'PEPEUSDT',
] as const

function mapBias(b: string | undefined): ScanBias {
  const s = String(b || '').toLowerCase()
  if (s.includes('bull') || s === 'long') return 'long'
  if (s.includes('bear') || s === 'short') return 'short'
  return 'neutral'
}

function pickSetup(bias: ScanBias, rangePos: number, changePct: number): ScanSetup {
  if (rangePos >= 85 && bias === 'long' && changePct > 0.4) return 'breakout'
  if (rangePos <= 15 && bias === 'short' && changePct < -0.4) return 'breakout'
  if (rangePos >= 80 && bias === 'short') return 'mean-revert'
  if (rangePos <= 20 && bias === 'long') return 'mean-revert'
  if (Math.abs(changePct) < 0.15 && rangePos > 35 && rangePos < 65) return 'squeeze'
  if (bias !== 'neutral' && Math.abs(changePct) >= 0.25) return 'trend-cont'
  if (rangePos > 30 && rangePos < 70) return 'range'
  return 'none'
}

function scoreRow(
  bias: ScanBias,
  rangePos: number,
  changePct: number,
  setup: ScanSetup
): number {
  let s = 40
  if (bias === 'long') s += 12
  if (bias === 'short') s += 12
  s += Math.min(20, Math.abs(rangePos - 50) * 0.35)
  s += Math.min(15, Math.abs(changePct) * 4)
  const setupBoost: Record<ScanSetup, number> = {
    breakout: 18,
    'mean-revert': 14,
    'trend-cont': 12,
    squeeze: 8,
    range: 4,
    none: 0,
  }
  s += setupBoost[setup]
  return Math.max(0, Math.min(99, Math.round(s)))
}

export function scanSymbol(
  symbol: string,
  candles: Candle[],
  interval: string,
  exchange: string
): ScanRow | null {
  if (!candles || candles.length < 8) return null
  const last = candles[candles.length - 1]!
  const first = candles[Math.max(0, candles.length - 24)]!
  const changePct =
    first.close > 0 ? ((last.close - first.close) / first.close) * 100 : 0

  let rangePos = 50
  let bias: ScanBias = 'neutral'
  let summary = 'Warmup'

  try {
    const ta = analyzeCandles(candles, symbol, interval)
    rangePos = Number.isFinite(ta?.rangePos) ? Number(ta.rangePos) : 50
    bias = mapBias(ta?.bias)
    summary = ta?.summary?.[0] || summary
  } catch {
    const window = candles.slice(-48)
    const hi = Math.max(...window.map((c) => c.high))
    const lo = Math.min(...window.map((c) => c.low))
    rangePos = hi > lo ? ((last.close - lo) / (hi - lo)) * 100 : 50
    bias = changePct > 0.3 ? 'long' : changePct < -0.3 ? 'short' : 'neutral'
    summary = 'Fallback momentum'
  }

  const setup = pickSetup(bias, rangePos, changePct)
  const score = scoreRow(bias, rangePos, changePct, setup)
  const volProxy = candles.slice(-12).reduce((a, c) => a + (c.volume || 0), 0)

  return {
    symbol,
    last: last.close,
    changePct,
    high: last.high,
    low: last.low,
    rangePos,
    bias,
    setup,
    score,
    summary,
    volumeProxy: volProxy,
    interval,
    exchange,
    updatedAt: Date.now(),
  }
}

export function rankRows(rows: ScanRow[]): ScanRow[] {
  return [...rows].sort((a, b) => b.score - a.score || Math.abs(b.changePct) - Math.abs(a.changePct))
}
