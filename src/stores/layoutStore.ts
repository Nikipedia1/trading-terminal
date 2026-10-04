/**
 * Layout store – multi-panel desk: charts + movable widgets on one grid.
 * Default: only the main chart. Add Trade / Wallet / Book etc. via + Panel.
 */

import { create } from 'zustand'
import type {
  ChartPanelConfig,
  GridLayoutItem,
  WidgetKind,
  WidgetPanelConfig,
  DeskPanel,
} from '@/types'

function uid(prefix = 'panel') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const WIDGET_META: Record<
  WidgetKind,
  { title: string; minW: number; minH: number; defaultW: number; defaultH: number }
> = {
  paper: { title: 'Trade', minW: 3, minH: 8, defaultW: 4, defaultH: 14 },
  book: { title: 'Order Book', minW: 3, minH: 6, defaultW: 3, defaultH: 12 },
  tape: { title: 'Tape', minW: 2, minH: 4, defaultW: 3, defaultH: 10 },
  large: { title: 'Large Trades', minW: 3, minH: 4, defaultW: 3, defaultH: 10 },
  futures: { title: 'Futures', minW: 3, minH: 4, defaultW: 3, defaultH: 8 },
  alerts: { title: 'Alerts', minW: 3, minH: 4, defaultW: 3, defaultH: 8 },
  journal: { title: 'Journal', minW: 3, minH: 4, defaultW: 3, defaultH: 8 },
  terminal: { title: 'Terminal', minW: 4, minH: 6, defaultW: 5, defaultH: 10 },
  watchlist: { title: 'Watchlist', minW: 3, minH: 5, defaultW: 3, defaultH: 12 },
  ai: { title: 'AI Analysis', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  wallet: { title: 'Wallet', minW: 3, minH: 8, defaultW: 4, defaultH: 14 },
  bots: { title: 'Bots', minW: 4, minH: 8, defaultW: 5, defaultH: 14 },
  admin: { title: 'Admin', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  liquidity: { title: 'Liquidity', minW: 3, minH: 6, defaultW: 3, defaultH: 10 },
  backtest: { title: 'Backtest', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  livekeys: { title: 'Live Keys', minW: 3, minH: 6, defaultW: 3, defaultH: 12 },
  plugins: { title: 'Plugins', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  micro: { title: 'Microstructure', minW: 3, minH: 6, defaultW: 3, defaultH: 10 },
  viz3d: { title: '3D Pro', minW: 4, minH: 8, defaultW: 6, defaultH: 14 },
  news: { title: 'News', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  calendar: { title: 'Calendario', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  livetv: { title: 'Live TV', minW: 3, minH: 6, defaultW: 5, defaultH: 12 },
  learn: { title: 'Learn', minW: 4, minH: 8, defaultW: 5, defaultH: 14 },
  ops: { title: 'Ops', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  onchain: { title: 'On-chain', minW: 3, minH: 8, defaultW: 4, defaultH: 14 },
  quantlab: { title: 'Quant Lab', minW: 4, minH: 8, defaultW: 6, defaultH: 14 },
}

const DEFAULT_CHART: ChartPanelConfig = {
  id: 'chart-main',
  symbol: 'BTCUSDT',
  interval: '15m',
  exchange: 'binance',
  syncGroup: 'A',
}

function defaultLayout(): GridLayoutItem[] {
  return [{ i: DEFAULT_CHART.id, x: 0, y: 0, w: 12, h: 16, minW: 4, minH: 8 }]
}

interface LayoutState {
  panels: ChartPanelConfig[]
  widgets: WidgetPanelConfig[]
  layout: GridLayoutItem[]
  primaryPanelId: string
  addChartPanel: () => void
  removePanel: (id: string) => void
  updatePanel: (id: string, patch: Partial<ChartPanelConfig>) => void
  setLayout: (layout: GridLayoutItem[]) => void
  setPrimary: (id: string) => void
  addWidget: (kind: WidgetKind) => void
  removeWidget: (id: string) => void
  resetLayout: () => void
  applyDesk: (panels: ChartPanelConfig[], widgets: WidgetPanelConfig[], layout: GridLayoutItem[]) => void
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  panels: [DEFAULT_CHART],
  widgets: [],
  layout: defaultLayout(),
  primaryPanelId: DEFAULT_CHART.id,

  addChartPanel: () => {
    const id = uid('chart')
    const primary = get().panels.find((p) => p.id === get().primaryPanelId) ?? get().panels[0]
    const panel: ChartPanelConfig = {
      id,
      symbol: primary?.symbol ?? 'BTCUSDT',
      interval: primary?.interval ?? '15m',
      exchange: primary?.exchange ?? 'binance',
      syncGroup: primary?.syncGroup ?? 'A',
    }
    const item: GridLayoutItem = {
      i: id,
      x: (get().layout.length * 2) % 12,
      y: Infinity,
      w: 6,
      h: 12,
      minW: 4,
      minH: 8,
    }
    set((s) => ({
      panels: [...s.panels, panel],
      layout: [...s.layout, item],
    }))
  },

  removePanel: (id) => {
    set((s) => {
      const panels = s.panels.filter((p) => p.id !== id)
      const layout = s.layout.filter((l) => l.i !== id)
      const primaryPanelId =
        s.primaryPanelId === id ? panels[0]?.id ?? '' : s.primaryPanelId
      return { panels, layout, primaryPanelId }
    })
  },

  updatePanel: (id, patch) => {
    set((s) => ({
      panels: s.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  },

  setLayout: (layout) => set({ layout }),

  setPrimary: (id) => set({ primaryPanelId: id }),

  addWidget: (kind) => {
    const meta = WIDGET_META[kind]
    if (!meta) return
    const id = uid(kind)
    const widget: WidgetPanelConfig = {
      id,
      kind,
      title: meta.title,
    }
    const item: GridLayoutItem = {
      i: id,
      x: (get().layout.length * 2) % 12,
      y: Infinity,
      w: meta.defaultW,
      h: meta.defaultH,
      minW: meta.minW,
      minH: meta.minH,
    }
    set((s) => ({
      widgets: [...s.widgets, widget],
      layout: [...s.layout, item],
    }))
  },

  removeWidget: (id) => {
    set((s) => ({
      widgets: s.widgets.filter((w) => w.id !== id),
      layout: s.layout.filter((l) => l.i !== id),
    }))
  },

  resetLayout: () =>
    set({
      panels: [DEFAULT_CHART],
      widgets: [],
      layout: defaultLayout(),
      primaryPanelId: DEFAULT_CHART.id,
    }),

  applyDesk: (panels, widgets, layout) =>
    set({
      panels,
      widgets,
      layout,
      primaryPanelId: panels[0]?.id ?? '',
    }),
}))
