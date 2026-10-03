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
}

const DEFAULT_CHART: ChartPanelConfig = {
  id: 'panel-main',
  symbol: 'BTCUSDT',
  interval: '1m',
  exchange: 'binance',
  syncGroup: null,
}

const DEFAULT_LAYOUT: GridLayoutItem[] = [
  { i: 'panel-main', x: 0, y: 0, w: 12, h: 18, minW: 4, minH: 4 },
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
  widgets: [],
  layout: DEFAULT_LAYOUT,
  primaryPanelId: 'panel-main',

  deskPanels: () => {
    const { panels, widgets } = get()
    const charts: DeskPanel[] = panels.map((p) => ({ type: 'chart', ...p }))
    const ws: DeskPanel[] = widgets.map((w) => ({ type: 'widget', ...w }))
    return [...charts, ...ws]
  },

  reconcileLayout: () => {
    const { panels, widgets, layout } = get()
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
        {
          i: p.id,
          x: 0,
          y: maxY,
          w: 6,
          h: 12,
          minW: 4,
          minH: 4,
        },
      ]
      maxY += 12
      inLayout.add(p.id)
    }

    if (JSON.stringify(nextLayout) !== JSON.stringify(layout)) {
      set({ layout: nextLayout })
    }
  },

  addPanel: () => {
    const id = uid('chart')
    const panel: ChartPanelConfig = {
      id,
      symbol: 'BTCUSDT',
      interval: '1m',
      exchange: 'binance',
      syncGroup: null,
    }
    set((s) => {
      const maxY = s.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
      return {
        panels: [...s.panels, panel],
        layout: [
          ...s.layout,
          { i: id, x: 0, y: maxY, w: 6, h: 12, minW: 4, minH: 4 },
        ],
      }
    })
  },

  addWidget: (kind) => {
    const meta = WIDGET_META[kind]
    const id = uid(kind)
    const widget: WidgetPanelConfig = {
      id,
      kind,
      title: meta.title,
    }
    set((s) => {
      if (s.widgets.some((w) => w.kind === kind)) return s
      const maxY = s.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
      return {
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
      }
    })
  },

  removePanel: (id) => {
    set((s) => ({
      panels: s.panels.filter((p) => p.id !== id),
      layout: s.layout.filter((l) => l.i !== id),
      primaryPanelId:
        s.primaryPanelId === id
          ? s.panels.find((p) => p.id !== id)?.id ?? s.primaryPanelId
          : s.primaryPanelId,
    }))
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

  setPrimaryPanel: (id) => set({ primaryPanelId: id }),
}))

/* -------------------------------------------------------------------------- */
/* Chart viewport sync (multi-panel)                                          */
/* -------------------------------------------------------------------------- */

export type SyncPayload = {
  logicalRange?: { from: number; to: number }
}

type SyncListener = (payload: SyncPayload & { sourceId?: string }) => void

const syncListeners = new Map<string, Map<string, SyncListener>>()

/** ChartContainer calls subscribeSyncGroup(group, panelId, listener). */
export function subscribeSyncGroup(
  groupId: string,
  panelId: string,
  listener: SyncListener
): () => void {
  if (!groupId) return () => {}
  let group = syncListeners.get(groupId)
  if (!group) {
    group = new Map()
    syncListeners.set(groupId, group)
  }
  group.set(panelId, listener)
  return () => {
    group?.delete(panelId)
    if (group && group.size === 0) syncListeners.delete(groupId)
  }
}

export function publishSync(
  groupId: string,
  sourceId: string,
  payload: SyncPayload
) {
  if (!groupId) return
  const group = syncListeners.get(groupId)
  if (!group) return
  const msg = { ...payload, sourceId }
  for (const [id, fn] of group) {
    if (id === sourceId) continue
    try {
      fn(msg)
    } catch {
      /* */
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
