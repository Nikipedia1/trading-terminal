/**
 * Pure risk checks – no side effects.
 * Enforces leverage, size, daily loss, kill-switch, circuit breaker.
 */

import type { RiskCheckInput, RiskCheckResult, RiskLimits } from './types'
import { DEFAULT_RISK_LIMITS } from './types'

export function checkOrderRisk(
  input: RiskCheckInput,
  limits: RiskLimits = DEFAULT_RISK_LIMITS,
  consecutiveRejects = 0
): RiskCheckResult {
  if (limits.killSwitch) {
    return {
      ok: false,
      code: 'KILL_SWITCH',
      message: 'Kill-switch active – trading halted. Disarm or reset risk to continue.',
    }
  }

  if (consecutiveRejects >= limits.maxConsecutiveRejects) {
    return {
      ok: false,
      code: 'CIRCUIT_BREAKER',
      message: `Circuit breaker: ${consecutiveRejects} consecutive rejects. Reset risk to resume.`,
    }
  }

  if (!Number.isFinite(input.leverage) || input.leverage < 1) {
    return { ok: false, code: 'LEV_INVALID', message: 'Invalid leverage' }
  }
  if (input.leverage > limits.maxLeverage) {
    return {
      ok: false,
      code: 'LEV_CAP',
      message: `Leverage ${input.leverage}× exceeds max ${limits.maxLeverage}×`,
    }
  }

  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    return { ok: false, code: 'QTY_INVALID', message: 'Invalid quantity' }
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { ok: false, code: 'PX_INVALID', message: 'Invalid price for risk check' }
  }

  const notional = Math.abs(input.qty * input.price)
  if (notional > limits.maxOrderNotional) {
    return {
      ok: false,
      code: 'NOTIONAL_CAP',
      message: `Notional ${notional.toFixed(2)} exceeds max ${limits.maxOrderNotional}`,
    }
  }

  if (input.openPositionCount >= limits.maxOpenPositions) {
    return {
      ok: false,
      code: 'POS_CAP',
      message: `Max open positions (${limits.maxOpenPositions}) reached`,
    }
  }

  // dailyPnl negative means loss
  if (input.dailyPnl < 0 && Math.abs(input.dailyPnl) >= limits.maxDailyLoss) {
    return {
      ok: false,
      code: 'DAILY_LOSS',
      message: `Daily loss limit hit (${limits.maxDailyLoss} quote). Trading blocked until reset.`,
    }
  }

  return { ok: true }
}

export function dayKeyUtc(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10)
}
