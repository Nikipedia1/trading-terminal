/**
 * Desk smoke tests — CI without network.
 * Covers risk/SLA units + full WidgetKind wiring + workflows + hard caps.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { checkOrderRisk, DEFAULT_RISK_LIMITS } from '@/trading/risk/riskEngine'
import { evaluateSla, FEED_SLA } from '@/data/market/feedPolicy'
import { toCanonicalSymbol, toVenueSymbol } from '@/data/market/symbolNormalize'
import { can } from '@/auth/rbac'
import { useLayoutStore, WIDGET_META } from '@/stores/layoutStore'
import { useMarketStore } from '@/stores/marketStore'
import type { WidgetKind } from '@/types'
import { buildTpoFromCandles, DEFAULT_TPO_CONFIG } from '@/analysis/tpo'
import type { Candle } from '@/types'

const ALL_KINDS = Object.keys(WIDGET_META) as WidgetKind[]

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

  it('TPO builds from OHLC candles', () => {
    const candles: Candle[] = []
    let t = 1_700_000_000
    for (let i = 0; i < 40; i++) {
      const o = 50000 + i
      candles.push({
        time: t,
        open: o,
        high: o + 10,
        low: o - 10,
        close: o + 2,
        volume: 1,
      })
      t += 60
    }
    const m = buildTpoFromCandles(candles, DEFAULT_TPO_CONFIG)
    expect(m.totalTpo).toBeGreaterThan(0)
    expect(m.poc).not.toBeNull()
  })
})

describe('desk widget registry smoke', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      panels: [
        {
          id: 'panel-main',
          symbol: 'BTCUSDT',
          interval: '1m',
          exchange: 'binance',
          syncGroup: null,
        },
      ],
      widgets: [],
      layout: [{ i: 'panel-main', x: 0, y: 0, w: 12, h: 18, minW: 4, minH: 4 }],
      primaryPanelId: 'panel-main',
    })
  })

  it('WIDGET_META covers a full desk suite', () => {
    expect(ALL_KINDS.length).toBeGreaterThanOrEqual(30)
    for (const k of ALL_KINDS) {
      const meta = WIDGET_META[k]
      expect(meta, `meta for ${k}`).toBeTruthy()
      expect(meta.title.length).toBeGreaterThan(0)
      expect(meta.defaultW).toBeGreaterThan(0)
      expect(meta.defaultH).toBeGreaterThan(0)
    }
  })

  it('addWidget registers each kind once', () => {
    const store = useLayoutStore.getState()
    for (const k of ALL_KINDS.slice(0, 12)) {
      store.addWidget(k)
    }
    const kinds = useLayoutStore.getState().widgets.map((w) => w.kind)
    expect(kinds.length).toBeGreaterThan(0)
    expect(kinds.length).toBeLessThanOrEqual(12)
  })
})

describe('desk workflows', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      panels: [
        {
          id: 'panel-main',
          symbol: 'ETHUSDT',
          interval: '15m',
          exchange: 'binance',
          syncGroup: null,
        },
      ],
      widgets: [],
      layout: [{ i: 'panel-main', x: 0, y: 0, w: 12, h: 18, minW: 4, minH: 4 }],
      primaryPanelId: 'panel-main',
    })
    useMarketStore.setState({
      symbol: 'ETHUSDT',
      interval: '15m',
      exchange: 'binance',
    } as any)
  })

  it('scalp BTC 1m workflow applies focused desk', async () => {
    const { applyTemplate, WORKSPACE_TEMPLATES } = await import('@/workspace/templates')
    expect(WORKSPACE_TEMPLATES.some((t) => t.id === 'scalp-btc-1m')).toBe(true)
    const r = applyTemplate('scalp-btc-1m')
    expect(r.ok).toBe(true)
    const s = useLayoutStore.getState()
    expect(s.panels).toHaveLength(1)
    expect(s.panels[0]?.symbol).toBe('BTCUSDT')
    expect(s.panels[0]?.interval).toBe('1m')
    const kinds = s.widgets.map((w) => w.kind)
    expect(kinds).toEqual(expect.arrayContaining(['cluster', 'domladder', 'cvd']))
    expect(s.widgets.length).toBeLessThanOrEqual(6)
  })

  it('MAX_WIDGETS blocks further addWidget', async () => {
    const { MAX_WIDGETS } = await import('@/ui/deskLimits')
    const store = useLayoutStore.getState()
    for (let i = 0; i < MAX_WIDGETS + 3; i++) {
      store.addWidget('tape')
    }
    expect(useLayoutStore.getState().widgets.length).toBeLessThanOrEqual(MAX_WIDGETS)
  })
})
