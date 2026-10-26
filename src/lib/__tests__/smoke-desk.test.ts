/**
 * Desk smoke tests — CI without network.
 * Covers risk/SLA units + full WidgetKind wiring (meta + addWidget).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { checkOrderRisk, DEFAULT_RISK_LIMITS } from '@/trading/risk/riskEngine'
import { evaluateSla, FEED_SLA } from '@/data/market/feedPolicy'
import { toCanonicalSymbol, toVenueSymbol } from '@/data/market/symbolNormalize'
import { can } from '@/auth/rbac'
import { useLayoutStore, WIDGET_META } from '@/stores/layoutStore'
import type { WidgetKind } from '@/types'
import { buildTpoFromCandles, DEFAULT_TPO_CONFIG } from '@/analysis/tpo'
import { buildFootprintCells } from '@/analysis/footprint'
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

  it('addWidget works for every WidgetKind', () => {
    for (const k of ALL_KINDS) {
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
      useLayoutStore.getState().addWidget(k)
      const s = useLayoutStore.getState()
      const w = s.widgets.find((x) => x.kind === k)
      expect(w, `widget ${k} added`).toBeTruthy()
      expect(s.layout.some((l) => l.i === w!.id)).toBe(true)
      expect(w!.title).toBe(WIDGET_META[k].title)
    }
  })

  it('critical orderflow kinds exist', () => {
    for (const k of ['cluster', 'tpo', 'footprint', 'deepprint', 'battlefield'] as WidgetKind[]) {
      expect(WIDGET_META[k], k).toBeTruthy()
    }
  })
})

describe('analysis smoke (panel compute)', () => {
  const candles: Candle[] = []
  const t0 = Math.floor(Date.now() / 1000) - 3600
  for (let i = 0; i < 60; i++) {
    const t = t0 + i * 60
    const px = 50000 + Math.sin(i / 5) * 50
    candles.push({
      time: t,
      open: px,
      high: px + 10,
      low: px - 10,
      close: px + 2,
      volume: 100 + i,
    })
  }

  it('TPO builds levels from candles', () => {
    const model = buildTpoFromCandles(candles, { ...DEFAULT_TPO_CONFIG, periodMinutes: 15 })
    expect(model.levels.length).toBeGreaterThan(0)
    expect(model.poc).not.toBeNull()
    expect(model.totalTpo).toBeGreaterThan(0)
  })

  it('footprint cells empty without trades (no throw)', () => {
    const cells = buildFootprintCells([], candles.map((c) => c.time), '1m')
    expect(Array.isArray(cells)).toBe(true)
    expect(cells.length).toBe(0)
  })
})
