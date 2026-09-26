/**
 * Chart appearance – candle body/wick + canvas/grid colors.
 * Persisted in localStorage. Applied by SeriesManager + ChartContainer.
 */

import { create } from 'zustand'

export interface CandleStyle {
  upBody: string
  downBody: string
  upBorder: string
  downBorder: string
  upWick: string
  downWick: string
}

export interface CanvasStyle {
  background: string
  text: string
  grid: string
  border: string
}

export interface ChartStyle {
  candle: CandleStyle
  canvas: CanvasStyle
}

export const DEFAULT_CHART_STYLE: ChartStyle = {
  candle: {
    upBody: '#0ecb81',
    downBody: '#f6465d',
    upBorder: '#0ecb81',
    downBorder: '#f6465d',
    upWick: '#0ecb81',
    downWick: '#f6465d',
  },
  canvas: {
    background: '#12161c',
    text: '#848e9c',
    grid: '#1e2329',
    border: '#1e2329',
  },
}

const STORAGE_KEY = 'tt-chart-style:v1'

function loadStyle(): ChartStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_CHART_STYLE)
    const parsed = JSON.parse(raw)
    return {
      candle: { ...DEFAULT_CHART_STYLE.candle, ...parsed?.candle },
      canvas: { ...DEFAULT_CHART_STYLE.canvas, ...parsed?.canvas },
    }
  } catch {
    return structuredClone(DEFAULT_CHART_STYLE)
  }
}

function persist(style: ChartStyle) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(style))
  } catch {
    /* ignore */
  }
}

/** Convert hex to rgba with alpha (for volume bars) */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return `rgba(128,128,128,${alpha})`
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

interface ChartStyleState {
  style: ChartStyle
  panelOpen: boolean
  setCandle: (patch: Partial<CandleStyle>) => void
  setCanvas: (patch: Partial<CanvasStyle>) => void
  resetStyle: () => void
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
}

export const useChartStyleStore = create<ChartStyleState>((set, get) => ({
  style: loadStyle(),
  panelOpen: false,

  setCandle: (patch) => {
    const style = {
      ...get().style,
      candle: { ...get().style.candle, ...patch },
    }
    persist(style)
    set({ style })
  },

  setCanvas: (patch) => {
    const style = {
      ...get().style,
      canvas: { ...get().style.canvas, ...patch },
    }
    persist(style)
    set({ style })
  },

  resetStyle: () => {
    const style = structuredClone(DEFAULT_CHART_STYLE)
    persist(style)
    set({ style })
  },

  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}))
