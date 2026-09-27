/**
 * Layout store – multi-panel chart management.
 * Owns panel configs + react-grid-layout positions.
 * Does NOT hold market data (each ChartPanel owns its own via usePanelMarket).
 */

import { create } from 'zustand'
import type { ChartPanelConfig, GridLayoutItem, Interval, ExchangeId } from '@/types'

function uid() {
  return `panel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

const DEFAULT_PANEL: ChartPanelConfig = {
  id: 'panel-main',
  symbol: 'BTCUSDT',
  interval: '1m',
  exchange: 'binance',
  syncGroup: null,
}

const DEFAULT_LAYOUT: GridLayoutItem[] = [
  { i: 'panel-main', x: 0, y: 0, w: 12, h: 12, minW: 4, minH: 4 },
]

interface LayoutState {
  panels: ChartPanelConfig[]
  layout: GridLayoutItem[]
  /** Panel whose symbol feeds the global ticker / trades / order book */
  primaryPanelId: string

  addPanel: () => void
  removePanel: (id: string) => void
  updatePanel: (id: string, patch: Partial<Pick<ChartPanelConfig, 'symbol' | 'interval' | 'exchange' | 'syncGroup'>>) => void
  setLayout: (layout: GridLayoutItem[]) => void
  setPrimaryPanel: (id: string) => void
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  panels: [DEFAULT_PANEL],
  layout: DEFAULT_LAYOUT,
  primaryPanelId: 'panel-main',

  addPanel: () => {
    const id = uid()
    const primary = get().panels.find((p) => p.id === get().primaryPanelId) ?? get().panels[0]
    const newPanel: ChartPanelConfig = {
      id,
      symbol: primary?.symbol ?? 'BTCUSDT',
      interval: primary?.interval ?? '1m',
      exchange: primary?.exchange ?? 'binance',
      syncGroup: null,
    }

    // Place new panel below existing content (magnetic grid, 12 cols)
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

  removePanel: (id) => {
    const { panels, primaryPanelId } = get()
    if (panels.length <= 1) return // keep at least one

    const nextPanels = panels.filter((p) => p.id !== id)
    const nextLayout = get().layout.filter((l) => l.i !== id)
    const nextPrimary =
      primaryPanelId === id ? nextPanels[0].id : primaryPanelId

    set({
      panels: nextPanels,
      layout: nextLayout,
      primaryPanelId: nextPrimary,
    })
  },

  updatePanel: (id, patch) => {
    set((s) => ({
      panels: s.panels.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      ),
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
      /** Optional orderflow bubble under cursor (mirrored to synced panels) */
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

/** Last crosshair highlight per sync group (for overlays that paint on demand) */
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
