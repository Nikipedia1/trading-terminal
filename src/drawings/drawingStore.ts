/**
 * Drawing store – per panel+symbol drawings with localStorage persistence.
 */

import { create } from 'zustand'
import type { Drawing, DrawingTool, DrawingsExport } from './types'
import { drawingsStorageKey } from './types'

interface DrawingState {
  activeTool: DrawingTool
  activeColor: string
  byPanelSymbol: Record<string, Record<string, Drawing[]>>
  selectedId: string | null

  setActiveTool: (tool: DrawingTool) => void
  setActiveColor: (color: string) => void
  setSelectedId: (id: string | null) => void

  getDrawings: (panelId: string, symbol: string) => Drawing[]
  setDrawings: (panelId: string, symbol: string, drawings: Drawing[]) => void
  addDrawing: (panelId: string, symbol: string, drawing: Drawing) => void
  updateDrawing: (panelId: string, symbol: string, id: string, patch: Partial<Drawing>) => void
  removeDrawing: (panelId: string, symbol: string, id: string) => void
  clearDrawings: (panelId: string, symbol: string) => void

  loadFromStorage: (panelId: string, symbol: string) => void
  exportJson: (panelId: string, symbol: string) => string
  importJson: (panelId: string, symbol: string, json: string) => { ok: boolean; error?: string }
}

function persist(panelId: string, symbol: string, drawings: Drawing[]) {
  try {
    localStorage.setItem(drawingsStorageKey(panelId, symbol), JSON.stringify(drawings))
  } catch {
    /* quota */
  }
}

function load(panelId: string, symbol: string): Drawing[] {
  try {
    const raw = localStorage.getItem(drawingsStorageKey(panelId, symbol))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  // Default: pan so user can move the chart without switching tools
  activeTool: 'pan',
  activeColor: '#1e90ff',
  byPanelSymbol: {},
  selectedId: null,

  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      // leaving select mode clears selection highlight noise when panning
      selectedId: tool === 'cursor' ? get().selectedId : null,
    }),
  setActiveColor: (color) => set({ activeColor: color }),
  setSelectedId: (id) => set({ selectedId: id }),

  getDrawings: (panelId, symbol) => {
    const sym = symbol.toUpperCase()
    return get().byPanelSymbol[panelId]?.[sym] ?? []
  },

  setDrawings: (panelId, symbol, drawings) => {
    const sym = symbol.toUpperCase()
    set((s) => ({
      byPanelSymbol: {
        ...s.byPanelSymbol,
        [panelId]: {
          ...(s.byPanelSymbol[panelId] ?? {}),
          [sym]: drawings,
        },
      },
    }))
    persist(panelId, sym, drawings)
  },

  addDrawing: (panelId, symbol, drawing) => {
    const current = get().getDrawings(panelId, symbol)
    get().setDrawings(panelId, symbol, [...current, drawing])
  },

  updateDrawing: (panelId, symbol, id, patch) => {
    const current = get().getDrawings(panelId, symbol)
    const next = current.map((d) =>
      d.id === id ? ({ ...d, ...patch, updatedAt: Date.now() } as Drawing) : d
    )
    get().setDrawings(panelId, symbol, next)
  },

  removeDrawing: (panelId, symbol, id) => {
    const current = get().getDrawings(panelId, symbol)
    get().setDrawings(
      panelId,
      symbol,
      current.filter((d) => d.id !== id)
    )
    if (get().selectedId === id) set({ selectedId: null })
  },

  clearDrawings: (panelId, symbol) => {
    get().setDrawings(panelId, symbol, [])
    set({ selectedId: null })
  },

  loadFromStorage: (panelId, symbol) => {
    const sym = symbol.toUpperCase()
    const drawings = load(panelId, sym)
    set((s) => ({
      byPanelSymbol: {
        ...s.byPanelSymbol,
        [panelId]: {
          ...(s.byPanelSymbol[panelId] ?? {}),
          [sym]: drawings,
        },
      },
    }))
  },

  exportJson: (panelId, symbol) => {
    const payload: DrawingsExport = {
      version: 1,
      exportedAt: Date.now(),
      panelId,
      symbol: symbol.toUpperCase(),
      drawings: get().getDrawings(panelId, symbol),
    }
    return JSON.stringify(payload, null, 2)
  },

  importJson: (panelId, symbol, json) => {
    try {
      const data = JSON.parse(json) as DrawingsExport
      if (!data || data.version !== 1 || !Array.isArray(data.drawings)) {
        return { ok: false, error: 'Invalid format: expected version 1 with drawings[]' }
      }
      const current = get().getDrawings(panelId, symbol)
      const byId = new Map(current.map((d) => [d.id, d]))
      for (const d of data.drawings) {
        if (d && d.id && d.tool) byId.set(d.id, d)
      }
      get().setDrawings(panelId, symbol, Array.from(byId.values()))
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Parse error' }
    }
  },
}))
