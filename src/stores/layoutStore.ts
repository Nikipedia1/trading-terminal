/**
 * Layout store – multi-panel desk: charts + movable widgets on one grid.
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

const DEFAULT_WALLET: WidgetPanelConfig = {
  id: 'widget-wallet',
  kind: 'wallet',
  title: 'Wallet',
}

const DEFAULT_LAYOUT: GridLayoutItem[] = [
  { i: 'panel-main', x: 0, y: 0, w: 8, h: 16, minW: 4, minH: 4 },
  { i: 'widget-paper', x: 8, y: 0, w: 4, h: 8, minW: 3, minH: 8 },
  { i: 'widget-wallet', x: 8, y: 8, w: 4, h: 8, minW: 3, minH: 8 },
  { i: 'widget-book', x: 8, y: 16, w: 4, h: 6, minW: 3, minH: 6 },
]

interface LayoutState {
  panels: ChartPanelConfig[]
  widgets: WidgetPanelConfig[]
  layout: GridLayoutItem[]
  primaryPanelId: string

  addPanel: () => void
  addWidget: (kind: WidgetKind) => void
  removePanel: (id: string) => void
  removeWidget: (id: string) => void
  removeDeskItem: (id: string) => void
  updatePanel: (
    id: string,
    patch: Partial<Pick<ChartPanelConfig, 'symbol' | 'interval' | 'exchange' | 'syncGroup'>>
  ) => void
  setLayout: (layout: GridLayoutItem[]) => void
  setPrimaryPanel: (id: string) => void
  reconcileLayout: () => void
  deskPanels: () => DeskPanel[]
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  panels: [DEFAULT_CHART],
  widgets: [DEFAULT_PAPER, DEFAULT_WALLET, DEFAULT_BOOK],
  layout: DEFAULT_LAYOUT,
  primaryPanelId: 'panel-main',

  deskPanels: () => {
    const { panels, widgets } = get()
    const charts: DeskPanel[] = panels.map((p) => ({ type: 'chart', ...p }))
    const ws: DeskPanel[] = widgets.map((w) => ({ type: 'widget', ...w }))
    return [...charts, ...ws]
  },

  reconcileLayout: () => {
    let { panels, widgets, layout } = get()
    // Ensure Wallet is always available as a desk panel (visible by default)
    if (!widgets.some((w) => w.kind === 'wallet')) {
      widgets = [
        ...widgets,
        { id: 'widget-wallet', kind: 'wallet', title: 'Wallet' },
      ]
      set({ widgets })
    }
    const validIds = new Set([
      ...panels.map((p) => p.id),
      ...widgets.map((w) => w.id),
    ])
    let nextLayout = layout.filter((l) => validIds.has(l.i))
    const inLayout = new Set(nextLayout.map((l) => l.i))
    let maxY = nextLayout.reduce((m, l) => Math.max(m, l.y + l.h), 0)

    for (const w of widgets) {
      if (inLayout.has(w.id)) continue
      const meta = WIDGET_META[w.kind]
      nextLayout = [
        ...nextLayout,
        {
          i: w.id,
          x: 0,
          y: maxY,
          w: meta.defaultW,
          h: meta.defaultH,
          minW: meta.minW,
          minH: meta.minH,
        },
      ]
      maxY += meta.defaultH
      inLayout.add(w.id)
    }

    for (const p of panels) {
      if (inLayout.has(p.id)) continue
      nextLayout = [
        ...nextLayout,
        { i: p.id, x: 0, y: maxY, w: 6, h: 8, minW: 4, minH: 4 },
      ]
      maxY += 8
      inLayout.add(p.id)
    }

    set({ layout: nextLayout })
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
    set((s) => ({
      panels: [...s.panels, newPanel],
      layout: [...s.layout, { i: id, x: 0, y: maxY, w: 6, h: 8, minW: 4, minH: 4 }],
    }))
  },

  addWidget: (kind) => {
    const existing = get().widgets.find((w) => w.kind === kind)
    if (existing) {
      const hasSlot = get().layout.some((l) => l.i === existing.id)
      if (hasSlot) return
      const meta = WIDGET_META[kind]
      const maxY = get().layout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
      set((s) => ({
        layout: [
          ...s.layout,
          {
            i: existing.id,
            x: 0,
            y: maxY,
            w: meta.defaultW,
            h: meta.defaultH,
            minW: meta.minW,
            minH: meta.minH,
          },
        ],
      }))
      return
    }
    const meta = WIDGET_META[kind]
    const id = uid(`widget-${kind}`)
    const widget: WidgetPanelConfig = { id, kind, title: meta.title }
    const maxY = get().layout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
    set((s) => ({
      widgets: [...s.widgets, widget],
      layout: [
        ...s.layout,
        {
          i: id,
          x: 0,
          y: maxY,
          w: meta.defaultW,
          h: meta.defaultH,
          minW: meta.minW,
          minH: meta.minH,
        },
      ],
    }))
  },

  removePanel: (id) => {
    const { panels, primaryPanelId } = get()
    if (panels.length <= 1) return
    const nextPanels = panels.filter((p) => p.id !== id)
    set({
      panels: nextPanels,
      layout: get().layout.filter((l) => l.i !== id),
      primaryPanelId: primaryPanelId === id ? nextPanels[0].id : primaryPanelId,
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
    if (panels.some((p) => p.id === id)) get().removePanel(id)
    else if (widgets.some((w) => w.id === id)) get().removeWidget(id)
  },

  updatePanel: (id, patch) => {
    set((s) => ({
      panels: s.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  },

  setLayout: (layout) => set({ layout }),

  setPrimaryPanel: (id) => {
    if (get().panels.some((p) => p.id === id)) set({ primaryPanelId: id })
  },
}))

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
      /* ignore */
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
