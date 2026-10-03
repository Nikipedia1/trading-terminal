/**
 * Smoke tests for critical desk modules (login path units, paper, news helpers).
 * Full browser E2E would use Playwright; CI runs these without network.
 */
import { describe, it, expect } from 'vitest'
import { checkOrderRisk, DEFAULT_RISK_LIMITS } from '@/trading/risk/riskEngine'
import { evaluateSla, FEED_SLA } from '@/data/market/feedPolicy'
import { toCanonicalSymbol, toVenueSymbol } from '@/data/market/symbolNormalize'
import { can } from '@/auth/rbac'

describe('desk smoke', () => {
  it('risk engine blocks kill-switch', () => {
    const r = checkOrderRisk(
      {
        mode: 'paper',
        symbol: 'BTCUSDT',
        leverage: 5,
        qty: 0.01,
        price: 50000,
        openPositionCount: 0,
        dailyPnl: 0,
      },
      { ...DEFAULT_RISK_LIMITS, killSwitch: true }
    )
    expect(r.ok).toBe(false)
  })

  it('symbol normalize cross-venue', () => {
    expect(toCanonicalSymbol('btc-usdt')).toBe('BTCUSDT')
    expect(toVenueSymbol('BTCUSDT', 'okx')).toBe('BTC-USDT')
  })

  it('SLA evaluates book stale', () => {
    const s = evaluateSla({
      bookAgeMs: FEED_SLA.bookStaleMs + 1,
      tickAgeMs: 100,
      latencyP99: 100,
      gapsRecent: 0,
    })
    expect(s.level).toBe('warn')
  })

  it('rbac viewer cannot live order', () => {
    expect(can('viewer', 'live.order')).toBe(false)
    expect(can('admin', 'live.order')).toBe(true)
  })
})
