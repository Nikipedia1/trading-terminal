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

/** Named theme presets for 2D chart (candles + canvas). */
export const CHART_THEME_PRESETS: Record<
  string,
  { label: string; style: ChartStyle }
> = {
  nacs: {
    label: 'NACS Desk',
    style: {
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
    },
  },
  binance: {
    label: 'Binance',
    style: {
      candle: {
        upBody: '#0ecb81',
        downBody: '#f6465d',
        upBorder: '#0ecb81',
        downBorder: '#f6465d',
        upWick: '#0ecb81',
        downWick: '#f6465d',
      },
      canvas: {
        background: '#0b0e11',
        text: '#848e9c',
        grid: '#1e2329',
        border: '#2b3139',
      },
    },
  },
  classic: {
    label: 'Classic TV',
    style: {
      candle: {
        upBody: '#26a69a',
        downBody: '#ef5350',
        upBorder: '#26a69a',
        downBorder: '#ef5350',
        upWick: '#26a69a',
        downWick: '#ef5350',
      },
      canvas: {
        background: '#131722',
        text: '#787b86',
        grid: '#1e222d',
        border: '#2a2e39',
      },
    },
  },
  ice: {
    label: 'Ice',
    style: {
      candle: {
        upBody: '#38bdf8',
        downBody: '#fb7185',
        upBorder: '#7dd3fc',
        downBorder: '#fda4af',
        upWick: '#38bdf8',
        downWick: '#fb7185',
      },
      canvas: {
        background: '#0a1018',
        text: '#94a3b8',
        grid: '#1a2535',
        border: '#243044',
      },
    },
  },
  magma: {
    label: 'Magma',
    style: {
      candle: {
        upBody: '#fbbf24',
        downBody: '#ef4444',
        upBorder: '#fcd34d',
        downBorder: '#f87171',
        upWick: '#fbbf24',
        downWick: '#ef4444',
      },
      canvas: {
        background: '#120a08',
        text: '#a8a29e',
        grid: '#2a1810',
        border: '#3f2418',
      },
    },
  },
  matrix: {
    label: 'Matrix',
    style: {
      candle: {
        upBody: '#22c55e',
        downBody: '#4ade80',
        upBorder: '#4ade80',
        downBorder: '#86efac',
        upWick: '#22c55e',
        downWick: '#4ade80',
      },
      canvas: {
        background: '#020805',
        text: '#4ade80',
        grid: '#0a1f12',
        border: '#14532d',
      },
    },
  },
  purple: {
    label: 'Neon Purple',
    style: {
      candle: {
        upBody: '#a78bfa',
        downBody: '#f472b6',
        upBorder: '#c4b5fd',
        downBorder: '#f9a8d4',
        upWick: '#a78bfa',
        downWick: '#f472b6',
      },
      canvas: {
        background: '#0c0a14',
        text: '#a1a1aa',
        grid: '#1c1630',
        border: '#2e2648',
      },
    },
  },
  bloomberg: {
    label: 'Bloomberg',
    style: {
      candle: {
        upBody: '#ff8300',
        downBody: '#ff8300',
        upBorder: '#ff8300',
        downBorder: '#ff8300',
        upWick: '#ff8300',
        downWick: '#ff8300',
      },
      canvas: {
        background: '#000000',
        text: '#ff8300',
        grid: '#1a1200',
        border: '#332000',
      },
    },
  },
  mono: {
    label: 'Mono',
    style: {
      candle: {
        upBody: '#eaecef',
        downBody: '#848e9c',
        upBorder: '#eaecef',
        downBorder: '#848e9c',
        upWick: '#eaecef',
        downWick: '#848e9c',
      },
      canvas: {
        background: '#0c0c0c',
        text: '#9ca3af',
        grid: '#1f1f1f',
        border: '#2a2a2a',
      },
    },
  },
  ocean: {
    label: 'Ocean',
    style: {
      candle: {
        upBody: '#2dd4bf',
        downBody: '#f43f5e',
        upBorder: '#5eead4',
        downBorder: '#fb7185',
        upWick: '#2dd4bf',
        downWick: '#f43f5e',
      },
      canvas: {
        background: '#061018',
        text: '#7dd3fc',
        grid: '#0c2030',
        border: '#164e63',
      },
    },
  },
  gold: {
    label: 'Gold Desk',
    style: {
      candle: {
        upBody: '#f0b90b',
        downBody: '#848e9c',
        upBorder: '#fcd535',
        downBorder: '#5e6673',
        upWick: '#f0b90b',
        downWick: '#848e9c',
      },
      canvas: {
        background: '#0b0e11',
        text: '#f0b90b',
        grid: '#1e2329',
        border: '#3d3200',
      },
    },
  },
  highContrast: {
    label: 'High Contrast',
    style: {
      candle: {
        upBody: '#00ff88',
        downBody: '#ff3355',
        upBorder: '#00ff88',
        downBorder: '#ff3355',
        upWick: '#ffffff',
        downWick: '#ffffff',
      },
      canvas: {
        background: '#000000',
        text: '#ffffff',
        grid: '#333333',
        border: '#555555',
      },
    },
  },
  fuchsia: {
    label: 'Fucsia / Bianco',
    style: {
      candle: {
        upBody: '#ff2d95',
        downBody: '#e8e8ed',
        upBorder: '#ff5cad',
        downBorder: '#ffffff',
        upWick: '#ff2d95',
        downWick: '#c7c7cc',
      },
      canvas: {
        background: '#0c0a0e',
        text: '#f5f5f7',
        grid: '#2a1a28',
        border: '#4a2040',
      },
    },
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
  applyTheme: (presetId: string) => void
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

  applyTheme: (presetId) => {
    const preset = CHART_THEME_PRESETS[presetId]
    if (!preset) return
    const style = {
      candle: { ...preset.style.candle },
      canvas: { ...preset.style.canvas },
    }
    persist(style)
    set({ style })
  },

  resetStyle: () => {
    const style = {
      candle: { ...DEFAULT_CHART_STYLE.candle },
      canvas: { ...DEFAULT_CHART_STYLE.canvas },
    }
    persist(style)
    set({ style })
  },

  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}))
