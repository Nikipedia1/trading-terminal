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
  plans: { title: 'Plans', minW: 3, minH: 8, defaultW: 5, defaultH: 14 },
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
  orderblock: { title: 'Order Block', minW: 4, minH: 8, defaultW: 5, defaultH: 14 },
  draw: { title: 'Draw Tools', minW: 2, minH: 4, defaultW: 3, defaultH: 8 },
  orderflow: { title: 'Order Flow', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  cycles: { title: 'Cycles', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  deepprint: { title: 'Deep Print', minW: 4, minH: 8, defaultW: 6, defaultH: 14 },
  volprofile: { title: 'Volume Profile', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  domladder: { title: 'DOM Ladder', minW: 3, minH: 8, defaultW: 3, defaultH: 14 },
  footprint: { title: 'Footprint', minW: 4, minH: 8, defaultW: 5, defaultH: 14 },
  cluster: { title: 'Cluster Chart', minW: 4, minH: 8, defaultW: 5, defaultH: 14 },
  tpo: { title: 'TPO Profile', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  gex: { title: 'Gamma / GEX', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  cvd: { title: 'CVD / Delta', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  absorption: { title: 'Absorption', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  imbalance: { title: 'Imbalance', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  deeptrades: { title: 'Deep Trades', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  ofi: { title: 'OFI / VPIN', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  iceberg: { title: 'Iceberg', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  tradingdesk: { title: 'Trading Desk', minW: 4, minH: 8, defaultW: 6, defaultH: 14 },
  opscanner: { title: 'Ops Scanner', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
}

const DEFAULT_CHART: ChartPanelConfig = {
  id: 'chart-main',
  symbol: 'BTCUSDT',
  interval: '15m',
  exchange: 'binance',
  syncGroup: null,
}

function defaultLayout(): GridLayoutItem[] {
  return [{ i: DEFAULT_CHART.id, x: 0, y: 0, w: 8, h: 16, minW: 4, minH: 8 }]
}

interface LayoutState {
  panels: ChartPanelConfig[]
  widgets: WidgetPanelConfig[]
  layout: GridLayoutItem[]
  primaryPanelId: string
  setLayout: (layout: GridLayoutItem[]) => void
  addChartPanel: () => void
  removeChartPanel: (id: string) => void
  updateChartPanel: (id: string, patch: Partial<ChartPanelConfig>) => void
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

  setLayout: (layout) => set({ layout }),

  addChartPanel: () => {
    const s = get()
    if (s.panels.length >= MAX_CHART_PANELS) return
    const id = uid('chart')
    const panel: ChartPanelConfig = {
      id,
      symbol: s.panels[0]?.symbol ?? 'BTCUSDT',
      interval: s.panels[0]?.interval ?? '15m',
      exchange: s.panels[0]?.exchange ?? 'binance',
      syncGroup: null,
    }
    const item: GridLayoutItem = {
      i: id,
      x: (s.panels.length * 4) % 12,
      y: Infinity,
      w: 6,
      h: 12,
      minW: 4,
      minH: 8,
    }
    set({
      panels: [...s.panels, panel],
      layout: [...s.layout, item],
      primaryPanelId: id,
    })
  },

  removeChartPanel: (id) => {
    set((s) => {
      const panels = s.panels.filter((p) => p.id !== id)
      return {
        panels,
        layout: s.layout.filter((l) => l.i !== id),
        primaryPanelId:
          s.primaryPanelId === id ? panels[0]?.id ?? '' : s.primaryPanelId,
      }
    })
  },

  updateChartPanel: (id, patch) => {
    set((s) => ({
      panels: s.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  },

  setPrimaryPanel: (id) => set({ primaryPanelId: id }),

  addWidget: (kind) => {
    const s = get()
    if (s.widgets.length >= MAX_WIDGETS) return
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
      x: 0,
      y: Infinity,
      w: meta.defaultW,
      h: meta.defaultH,
      minW: meta.minW,
      minH: meta.minH,
    }
    set((st) => ({
      widgets: [...st.widgets, widget],
      layout: [...st.layout, item],
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

/* ---- cross-panel sync bus (range / crosshair / orderflow highlight) ---- */

export type SyncHighlight = {
  timeSec: number
  price: number
  aggressor?: 'buy' | 'sell'
}

export type SyncPayload = {
  logicalRange?: { from: number; to: number }
  timeRange?: { from: number; to: number }
  crosshair?: { time: number | null; price: number | null }
  type?: string
  from?: number
  to?: number
  time?: number | null
  price?: number | null
  highlight?: SyncHighlight | null
  sourceId?: string
}

type SyncListener = (payload: SyncPayload & { sourceId?: string }) => void

const syncListeners = new Map<string, Set<SyncListener>>()
const syncHighlights = new Map<string, SyncHighlight | null>()

export function publishSync(group: string, sourceId: string, payload: SyncPayload): void {
  const set = syncListeners.get(group)
  if (!set) return
  const msg = { ...payload, sourceId }
  for (const cb of set) {
    try {
      cb(msg)
    } catch {
      /* */
    }
  }
}

export function subscribeSyncGroup(
  group: string,
  panelId: string,
  cb: SyncListener
): () => void {
  void panelId
  let set = syncListeners.get(group)
  if (!set) {
    set = new Set()
    syncListeners.set(group, set)
  }
  set.add(cb)
  return () => {
    set!.delete(cb)
    if (set!.size === 0) syncListeners.delete(group)
  }
}

export function setSyncHighlight(group: string, highlight: SyncHighlight | null): void {
  syncHighlights.set(group, highlight)
}

export function getSyncHighlight(group: string): SyncHighlight | null {
  return syncHighlights.get(group) ?? null
}
