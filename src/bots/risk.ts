/**
 * Risk engine – position sizing, daily loss, exposure, leverage caps.
 */

import type { BotInstance } from './types'
import type { SentimentSnapshot } from './sentiment'

export interface RiskContext {
  equity: number
  balance: number
  openMargin: number
  openPositions: number
  dayPnl: number
  markPrice: number
}

export interface RiskDecision {
  ok: boolean
  reason?: string
  qty: number
  leverage: number
  takeProfitPct: number | null
  stopLossPct: number | null
}

function dayKey(ts = Date.now()) {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
}

export function ensureDayRuntime(bot: BotInstance): NonNullable<BotInstance['runtime']> {
  const r = bot.runtime ?? {}
  const key = dayKey()
  if (r.dayKey !== key) {
    return { ...r, dayKey: key, dayPnl: 0, dayTrades: 0 }
  }
  return r
}

export function sizeFromRisk(
  equity: number,
  price: number,
  riskPct: number,
  slPct: number,
  leverage: number,
  maxQty?: number | null
): number {
  if (!Number.isFinite(equity) || equity <= 0) return 0
  if (!Number.isFinite(price) || price <= 0) return 0
  if (!Number.isFinite(slPct) || slPct <= 0) return 0
  const riskUsd = equity * (riskPct / 100)
  const lossPerUnit = price * (slPct / 100)
  if (lossPerUnit <= 0) return 0
  let qty = riskUsd / lossPerUnit
  const maxByMargin = (equity * 0.95 * leverage) / price
  qty = Math.min(qty, maxByMargin)
  if (maxQty != null && maxQty > 0) qty = Math.min(qty, maxQty)
  return qty > 0 ? qty : 0
}

export function evaluateRisk(
  bot: BotInstance,
  ctx: RiskContext,
  side: 'long' | 'short',
  sentiment: SentimentSnapshot | null
): RiskDecision {
  const cfg = bot.config
  const risk = cfg.risk
  const runtime = ensureDayRuntime(bot)

  let leverage = cfg.leverage
  if (risk.maxLeverage != null && risk.maxLeverage > 0) {
    leverage = Math.min(leverage, risk.maxLeverage)
  }
  leverage = Math.max(1, Math.min(125, Math.round(leverage)))

  let stopLossPct = cfg.stopLossPct
  let takeProfitPct = cfg.takeProfitPct

  if (risk.requireStopLoss && (stopLossPct == null || stopLossPct <= 0)) {
    return {
      ok: false,
      reason: 'Risk: stop-loss required',
      qty: 0,
      leverage,
      takeProfitPct,
      stopLossPct,
    }
  }

  const dayPnl = runtime.dayPnl ?? ctx.dayPnl
  if (risk.maxDailyLossPct != null && risk.maxDailyLossPct > 0) {
    const limit = -Math.abs(ctx.equity * (risk.maxDailyLossPct / 100))
    if (dayPnl <= limit) {
      return {
        ok: false,
        reason: `Risk: daily loss limit (${risk.maxDailyLossPct}%)`,
        qty: 0,
        leverage,
        takeProfitPct,
        stopLossPct,
      }
    }
  }

  if (risk.maxOpenPositions != null && ctx.openPositions >= risk.maxOpenPositions) {
    return {
      ok: false,
      reason: 'Risk: max open positions',
      qty: 0,
      leverage,
      takeProfitPct,
      stopLossPct,
    }
  }

  if (risk.maxExposurePct != null && risk.maxExposurePct > 0 && ctx.equity > 0) {
    const used = (ctx.openMargin / ctx.equity) * 100
    if (used >= risk.maxExposurePct) {
      return {
        ok: false,
        reason: `Risk: exposure ${used.toFixed(0)}% ≥ ${risk.maxExposurePct}%`,
        qty: 0,
        leverage,
        takeProfitPct,
        stopLossPct,
      }
    }
  }

  if (risk.useSentiment && sentiment) {
    const score = sentiment.score
    const min = risk.sentimentMinScore ?? -0.15
    if (risk.sentimentMode === 'filter' || risk.sentimentMode === 'align') {
      if (side === 'long' && score < min) {
        return {
          ok: false,
          reason: `Sentiment blocks long (${sentiment.label} ${score.toFixed(2)})`,
          qty: 0,
          leverage,
          takeProfitPct,
          stopLossPct,
        }
      }
      if (side === 'short' && score > -min) {
        return {
          ok: false,
          reason: `Sentiment blocks short (${sentiment.label} ${score.toFixed(2)})`,
          qty: 0,
          leverage,
          takeProfitPct,
          stopLossPct,
        }
      }
    }
  }

  let qty = cfg.qty
  if (risk.sizingMode === 'risk_pct' && stopLossPct != null && stopLossPct > 0) {
    const sized = sizeFromRisk(
      ctx.equity,
      ctx.markPrice,
      risk.riskPerTradePct || 1,
      stopLossPct,
      leverage,
      risk.maxQty
    )
    if (sized <= 0) {
      return {
        ok: false,
        reason: 'Risk: sized qty is 0',
        qty: 0,
        leverage,
        takeProfitPct,
        stopLossPct,
      }
    }
    qty = sized
  } else if (risk.maxQty != null && risk.maxQty > 0) {
    qty = Math.min(qty, risk.maxQty)
  }

  const marginNeeded = (qty * ctx.markPrice) / leverage
  if (marginNeeded > ctx.balance * 0.98) {
    return {
      ok: false,
      reason: 'Risk: insufficient margin',
      qty: 0,
      leverage,
      takeProfitPct,
      stopLossPct,
    }
  }

  if (risk.useSentiment && sentiment && risk.sentimentMode === 'scale') {
    const score = sentiment.score
    const align =
      side === 'long' ? Math.max(-1, Math.min(1, score)) : Math.max(-1, Math.min(1, -score))
    const mult = 0.7 + 0.5 * ((align + 1) / 2)
    qty *= mult
  }

  if (qty >= 1) qty = Math.round(qty * 1e4) / 1e4
  else qty = Math.round(qty * 1e8) / 1e8

  if (qty <= 0) {
    return {
      ok: false,
      reason: 'Risk: qty too small',
      qty: 0,
      leverage,
      takeProfitPct,
      stopLossPct,
    }
  }

  return {
    ok: true,
    qty,
    leverage,
    takeProfitPct,
    stopLossPct,
  }
}

export { defaultRiskConfig } from './types'
