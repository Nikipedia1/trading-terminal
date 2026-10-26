/**
 * Desk workflows — one saved layout, not 30 ad-hoc panels.
 * applyTemplate sets symbol/interval + full grid via layoutStore.applyDesk.
 */

import type { ExchangeId, Interval, WidgetKind } from '@/types'
import { useLayoutStore, WIDGET_META } from '@/stores/layoutStore'
import { useOrderflowStore } from '@/stores/orderflowStore'
import { useMarketStore } from '@/stores/marketStore'

export interface WorkspaceTemplate {
  id: string
  name: string
  description: string
  symbol: string
  exchange: ExchangeId
  interval: Interval
  /** Widget kinds to open (order = placement priority) */
  widgets: WidgetKind[]
  orderflow?: {
    print?: boolean
    delta?: boolean
    profile?: boolean
    trades?: boolean
    dom?: boolean
    footprint?: boolean
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'scalp-btc-1m',
    name: 'Scalp BTC 1m',
    description: '1 chart · Cluster · DOM · CVD',
    symbol: 'BTCUSDT',
    exchange: 'binance',
    interval: '1m',
    widgets: ['cluster', 'domladder', 'cvd'],
    orderflow: {
      print: true,
      delta: true,
      trades: true,
      dom: true,
      profile: false,
      footprint: false,
    },
  },
  {
    id: 'scalp-1m',
    name: 'Scalp 1m (current)',
    description: 'Keep symbol · 1m · Cluster · DOM · CVD',
    symbol: '', // keep current
    exchange: 'binance',
    interval: '1m',
    widgets: ['cluster', 'domladder', 'cvd'],
    orderflow: {
      print: true,
      delta: true,
      trades: true,
      dom: true,
      profile: false,
      footprint: false,
    },
  },
  {
    id: 'swing-4h',
    name: 'Swing 4h',
    description: '1 chart · TPO · Volume Profile · CVD',
    symbol: '',
    exchange: 'binance',
    interval: '4h',
    widgets: ['tpo', 'volprofile', 'cvd'],
    orderflow: {
      print: false,
      delta: true,
      profile: true,
      trades: false,
      dom: false,
      footprint: false,
    },
  },
  {
    id: 'event-risk',
    name: 'Event risk',
    description: '5m · Footprint · Tape · DOM · News',
    symbol: '',
    exchange: 'binance',
    interval: '5m',
    widgets: ['footprint', 'tape', 'domladder', 'news'],
    orderflow: {
      print: true,
      delta: true,
      trades: true,
      dom: true,
      footprint: true,
      profile: true,
    },
  },
]

/** Build a focused desk: 1 primary chart + listed widgets (capped). */
export function buildWorkflowDesk(t: WorkspaceTemplate, currentSymbol?: string) {
  const symbol = (t.symbol || currentSymbol || 'BTCUSDT').toUpperCase()
  const chartId = uid('chart')
  const panels = [
    {
      id: chartId,
      symbol,
      interval: t.interval,
      exchange: t.exchange,
      syncGroup: null as string | null,
n    },
  ]

  const widgets = t.widgets.slice(0, 6).map((kind) => {
    const meta = WIDGET_META[kind]
    return {
      id: uid(kind),
      kind,
      title: meta?.title ?? kind,
    }
  })

  // Grid: chart left 7 cols; stack widgets on right 5 cols
  const layout = [
    { i: chartId, x: 0, y: 0, w: 7, h: 18, minW: 4, minH: 8 },
    ...widgets.map((w, idx) => {
      const meta = WIDGET_META[w.kind]
      const h = Math.min(meta?.defaultH ?? 10, 12)
      return {
        i: w.id,
        x: 7,
        y: idx * h,
        w: 5,
        h,
        minW: meta?.minW ?? 2,
        minH: meta?.minH ?? 4,
      }
    }),
  ]

  return { panels, widgets, layout, chartId, symbol }
}

export function applyTemplate(id: string): { ok: true; name: string } | { ok: false; error: string } {
  const t = WORKSPACE_TEMPLATES.find((x) => x.id === id)
  if (!t) return { ok: false, error: 'Unknown template' }

  const market = useMarketStore.getState()
  const desk = buildWorkflowDesk(t, market.symbol)

  useLayoutStore.getState().applyDesk(desk.panels, desk.widgets, desk.layout)

  market.setSymbol(desk.symbol)
  market.setInterval(t.interval)
  market.setExchange(t.exchange)

  if (t.orderflow) {
    useOrderflowStore.getState().patch(desk.chartId, t.orderflow)
  }

  return { ok: true, name: t.name }
}
