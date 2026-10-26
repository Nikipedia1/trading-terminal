/**
 * Layout store – multi-panel desk: charts + movable widgets on one grid.
 */

import { create } from 'zustand'
import type {
  ChartPanelConfig,
  GridLayoutItem,
  WidgetKind,
  WidgetPanelConfig,
} from '@/types'
import { MAX_CHART_PANELS, MAX_WIDGETS } from '@/ui/deskLimits'

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
  battlefield: { title: 'Battlefield', minW: 4, minH: 8, defaultW: 6, defaultH: 14 },
  draw: { title: 'Draw', minW: 2, minH: 4, defaultW: 3, defaultH: 8 },
  orderflow: { title: 'Orderflow', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  cycles: { title: 'Cycles', minW: 3, minH: 6, defaultW: 4, defaultH: 10 },
  deepprint: { title: 'Deep Print', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  volprofile: { title: 'Volume Profile', minW: 3, minH: 6, defaultW: 3, defaultH: 12 },
  domladder: { title: 'DOM Ladder', minW: 2, minH: 6, defaultW: 3, defaultH: 14 },
  footprint: { title: 'Footprint', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  cluster: { title: 'Cluster', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  tpo: { title: 'TPO', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  gex: { title: 'GEX', minW: 3, minH: 6, defaultW: 4, defaultH: 10 },
  cvd: { title: 'CVD', minW: 3, minH: 5, defaultW: 3, defaultH: 10 },
  absorption: { title: 'Absorption', minW: 3, minH: 5, defaultW: 3, defaultH: 10 },
  imbalance: { title: 'Imbalance', minW: 3, minH: 5, defaultW: 3, defaultH: 10 },
  deeptrades: { title: 'Deep Trades', minW: 3, minH: 5, defaultW: 3, defaultH: 10 },
  ofi: { title: 'OFI', minW: 3, minH: 5, defaultW: 3, defaultH: 10 },
  iceberg: { title: 'Iceberg', minW: 3, minH: 5, defaultW: 3, defaultH: 10 },
}

const DEFAULT_CHART: ChartPanelConfig = {
  id: 'panel-main',
  symbol: 'BTCUSDT',
  interval: '15m',
  exchange: 'binance',
  syncGroup: null,
}

functionfunction defaultLayout(): GridLayoutItem[] {
  return [{ i: DEFAULT_CHART.id, x: 0, y: 0, w: 12, h: 18, minW: 4, minH: 8 }]
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
  setPrimaryPanel: (id: string) => void
  addWidget: (kind: WidgetKind) => void
  removeWidget: (id: string) => void
  resetLayout: () => void
  applyDesk: (
    panels: ChartPanelConfig[],
    widgets: WidgetPanelConfig[],
    layout: GridLayoutItem[]
  ) => void
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  panels: [DEFAULT_CHART],
  widgets: [],
  layout: defaultLayout(),
  primaryPanelId: DEFAULT_CHART.id,

  addChartPanel: () => {
    if (get().panels.length >= MAX_CHART_PANELS) {
      console.warn(`[desk] MAX_CHART_PANELS=${MAX_CHART_PANELS} reached`)
      return
    }
    const id = uid('chart')
    const panel: ChartPanelConfig = {
      id,
      symbol: 'BTCUSDT',
      interval: '15m',
      exchange: 'binance',
      syncGroup: null,
    }
    const item: GridLayoutItem = {
      i: id,
      x: 0,
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
      let primary = s.primaryPanelId
      if (primary === id) primary = panels[0]?.id ?? ''
      return { panels, layout, primaryPanelId: primary }
    })
  },

  updatePanel: (id, patch) => {
    set((s) => ({
      panels: s.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  },

  setLayout: (layout) => set({ layout }),
  setPrimary: (id) => set({ primaryPanelId: id }),
  setPrimaryPanel: (id) => set({ primaryPanelId: id }),

  addWidget: (kind) => {
    const meta = WIDGET_META[kind]
    if (!meta) return
    if (get().widgets.length >= MAX_WIDGETS) {
      console.warn(`[desk] MAX_WIDGETS=${MAX_WIDGETS} reached`)
      return
    }
    const id = uid(kind)
    const widget: WidgetPanelConfig = {
      id,
      kind,
      title: meta.title,
    }
    const occupiedRight = get().layout.some((it) => it.x >= 6)
    const item: GridLayoutItem = {
      i: id,
      x: occupiedRight ? 0 : 6,
      y: Infinity,
      w: meta.defaultW,
      h: meta.defaultH,
      minW: meta.minW,
      minH: meta.minH,
    }
    set((s) => {
      let nextLayout = [...s.layout]
      if (!occupiedRight) {
        nextLayout = nextLayout.map((it) => {
          if (it.w >= 10 && it.x === 0) {
            return { ...it, w: 6 }
          }
          return it
        })
      }
      nextLayout = [...nextLayout, item]
      return {
        widgets: [...s.widgets, widget],
        layout: nextLayout,
      }
    })
    try {
      queueMicrotask(() => {
        document
          .querySelector(`[data-panel-id="${id}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    } catch {
      /* */
    }
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

export type SyncPayload = {
  logicalRange?: { from: number; to: number }
  timeRange?: { from: number; to: number }
  crosshair?: { time: number | null; price: number | null }
  type?: string
  from?: number
  to?: number
}
