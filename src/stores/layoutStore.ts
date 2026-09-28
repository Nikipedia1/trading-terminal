/**
 * Layout store – multi-panel desk: charts + movable widgets on one grid.
 * Owns panel configs + react-grid-layout positions.
 * Does NOT hold market data (each ChartPanel owns its own via usePanelMarket).
 */

import { create } from 'zustand'
import type {
  ChartPanelConfig,
  GridLayoutItem,
  Interval,
  ExchangeId,
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
}

const DEFAULT_CHART: ChartPanelConfig = {
  id: 'panel-main',
  symbol: 'BTCUSDT',
  interval: '1m',
  exchange: 'binance',
  syncGroup: null,
}

const DEFAULT_PAPER: WidgetPanelConfig = {
  id: 'widget-paper',
  kind: 'paper',
  title: 'Trade',
}

const DEFAULT_BOOK: WidgetPanelConfig = {
  id: 'widget-book',
  kind: 'book',
  title: 'Order Book',
}

/** Default desk: chart left, paper + book right column */
const DEFAULT_LAYOUT: GridLayoutItem[] = [
  { i: 'panel-main', x: 0, y: 0, w: 8, h: 16, minW: 4, minH: 4 },
  { i: 'widget-paper', x: 8, y: 0, w: 4, h: 10, minW: 3, minH: 8 },
  { i: 'widget-book', x: 8, y: 10, w: 4, h: 6, minW: 3, minH: 6 },
]

interface LayoutState {
  /** Chart panels only (symbol/interval/exchange) */
  panels: ChartPanelConfig[]
  /** Movable widgets (paper, book, tape, …) */
  widgets: WidgetPanelConfig[]
  layout: GridLayoutItem[]
  /** Panel whose symbol feeds the global ticker / trades / order book */
  primaryPanelId: string

  addPanel: () => void
  addWidget: (kind: WidgetKind) => void
  removePanel: (id: string) => void
  removeWidget: (id: string) => void
  /** Remove any desk item (chart or widget) by layout id */
  removeDeskItem: (id: string) => void
  updatePanel: (
    id: string,
    patch: Partial<Pick<ChartPanelConfig, 'symbol' | 'interval' | 'exchange' | 'syncGroup'>>
  ) => void
  setLayout: (layout: GridLayoutItem[]) => void
  setPrimaryPanel: (id: string) => void
  deskPanels: () => DeskPanel[]
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  panels: [DEFAULT_CHART],
  widgets: [DEFAULT_PAPER, DEFAULT_BOOK],
  layout: DEFAULT_LAYOUT,
  primaryPanelId: 'panel-main',

  deskPanels: () => {
    const { panels, widgets } = get()
    const charts: DeskPanel[] = panels.map((p) => ({ type: 'chart', ...p }))
    const ws: DeskPanel[] = widgets.map((w) => ({ type: 'widget', ...w }))
    return [...charts, ...ws]
  },

  addPanel: () => {
    const id = uid('panel')
    const primary = get().panels.find((p) => p.id === get().primaryPanelId) ?? get().panels[0]
    const newPanel: ChartPanelConfig = {
      id,
      symbol: primary?.symbol ?? 'BTCUSDT',
      interval: primary?.interval ?? '1m',
      exchange: primary?.exchange ?? 'binance',
      syncGroup: null,
    }
    const maxY = get().layout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
    const newLayoutItem: GridLayoutItem = {
      i: id,
      x: 0,
      y: maxY,
      w: 6,
      h: 8,
      minW: 4,
      minH: 4,
    }
    set((s) => ({
      panels: [...s.panels, newPanel],
      layout: [...s.layout, newLayoutItem],
    }))
  },

  addWidget: (kind) => {
    // Only one instance per kind to keep desk clean
    if (get().widgets.some((w) => w.kind === kind)) return
    const meta = WIDGET_META[kind]
    const id = uid(`widget-${kind}`)
    const widget: WidgetPanelConfig = { id, kind, title: meta.title }
    const maxY = get().layout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
    const item: GridLayoutItem = {
      i: id,
      x: 0,
      y: maxY,
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

  removePanel: (id) => {
    const { panels, primaryPanelId } = get()
    if (panels.length <= 1) return
    const nextPanels = panels.filter((p) => p.id !== id)
    const nextLayout = get().layout.filter((l) => l.i !== id)
    const nextPrimary = primaryPanelId === id ? nextPanels[0].id : primaryPanelId
    set({
      panels: nextPanels,
      layout: nextLayout,
      primaryPanelId: nextPrimary,
    })
  },

  removeWidget: (id) => {
    set((s) => ({
      widgets: s.widgets.filter((w) => w.id !== id),
      layout: s.layout.filter((l) => l.i !== id),
    }))
  },

  removeDeskItem: (id) => {
    const { panels, widgets } = get()
    if (panels.some((p) => p.id === id)) {
      get().removePanel(id)
      return
    }
    if (widgets.some((w) => w.id === id)) {
      get().removeWidget(id)
    }
  },

  updatePanel: (id, patch) => {
    set((s) => ({
      panels: s.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  },

  setLayout: (layout) => set({ layout }),

  setPrimaryPanel: (id) => {
    if (get().panels.some((p) => p.id === id)) {
      set({ primaryPanelId: id })
    }
  },
}))

/** Sync bus for optional cross-panel crosshair + time range + orderflow highlight */
type SyncListener = (sourceId: string, payload: SyncPayload) => void

export type SyncPayload =
  | { type: 'timeRange'; from: number; to: number }
  | {
      type: 'crosshair'
      time: number | null
      price: number | null
      highlight?: {
        timeSec: number
        price: number
        aggressor?: 'buy' | 'sell'
      } | null
    }

const syncListeners = new Map<string, Set<SyncListener>>()

export function subscribeSyncGroup(groupId: string, listener: SyncListener): () => void {
  if (!syncListeners.has(groupId)) syncListeners.set(groupId, new Set())
  syncListeners.get(groupId)!.add(listener)
  return () => {
    syncListeners.get(groupId)?.delete(listener)
  }
}

export function publishSync(groupId: string, sourceId: string, payload: SyncPayload) {
  const set = syncListeners.get(groupId)
  if (!set) return
  for (const fn of set) {
    try {
      fn(sourceId, payload)
    } catch {
      /* ignore listener errors */
    }
  }
}

const lastHighlight = new Map<
  string,
  { timeSec: number; price: number; aggressor?: 'buy' | 'sell' } | null
>()

export function setSyncHighlight(
  groupId: string,
  h: { timeSec: number; price: number; aggressor?: 'buy' | 'sell' } | null
) {
  lastHighlight.set(groupId, h)
}

export function getSyncHighlight(groupId: string) {
  return lastHighlight.get(groupId) ?? null
}
