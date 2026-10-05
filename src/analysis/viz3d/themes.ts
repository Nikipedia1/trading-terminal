/** Shared 3D color themes for Viz3DScene. */
export type Viz3DThemeId =
  | 'desk'
  | 'neon'
  | 'mono'
  | 'aurora'
  | 'magma'
  | 'ocean'
  | 'matrix'
  | 'gold'
  | 'ice'
  | 'cyber'
  | 'fuchsia'

export interface Viz3DThemeColors {
  bg: string
  grid: string
  buy: string
  sell: string
  wick: string
  label: string
  accent: string
  face: string
}

export const VIZ3D_THEMES: Record<Viz3DThemeId, Viz3DThemeColors> = {
  desk: {
    bg: '#0b0e11',
    grid: 'rgba(43,49,57,0.55)',
    buy: '#0ecb81',
    sell: '#f6465d',
    wick: '#848e9c',
    label: '#5e6673',
    accent: '#f0b90b',
    face: 'rgba(30,35,41,0.9)',
  },
  neon: {
    bg: '#05070a',
    grid: 'rgba(96,165,250,0.25)',
    buy: '#22d3ee',
    sell: '#e879f9',
    wick: '#64748b',
    label: '#94a3b8',
    accent: '#60a5fa',
    face: 'rgba(15,23,42,0.85)',
  },
  mono: {
    bg: '#0c0c0c',
    grid: 'rgba(80,80,80,0.4)',
    buy: '#eaecef',
    sell: '#848e9c',
    wick: '#5e6673',
    label: '#5e6673',
    accent: '#eaecef',
    face: 'rgba(28,28,28,0.9)',
  },
  aurora: {
    bg: '#060a12',
    grid: 'rgba(52,211,153,0.2)',
    buy: '#34d399',
    sell: '#c084fc',
    wick: '#64748b',
    label: '#94a3b8',
    accent: '#67e8f9',
    face: 'rgba(15,23,42,0.88)',
  },
  magma: {
    bg: '#120a08',
    grid: 'rgba(251,146,60,0.22)',
    buy: '#fbbf24',
    sell: '#ef4444',
    wick: '#a8a29e',
    label: '#a8a29e',
    accent: '#fb923c',
    face: 'rgba(40,20,12,0.9)',
  },
  ocean: {
    bg: '#041018',
    grid: 'rgba(56,189,248,0.22)',
    buy: '#2dd4bf',
    sell: '#f43f5e',
    wick: '#64748b',
    label: '#7dd3fc',
    accent: '#38bdf8',
    face: 'rgba(12,32,48,0.9)',
  },
  matrix: {
    bg: '#020805',
    grid: 'rgba(34,197,94,0.28)',
    buy: '#22c55e',
    sell: '#4ade80',
    wick: '#166534',
    label: '#4ade80',
    accent: '#86efac',
    face: 'rgba(6,24,12,0.92)',
  },
  gold: {
    bg: '#0b0e11',
    grid: 'rgba(240,185,11,0.2)',
    buy: '#f0b90b',
    sell: '#848e9c',
    wick: '#5e6673',
    label: '#c99400',
    accent: '#fcd535',
    face: 'rgba(30,28,16,0.9)',
  },
  ice: {
    bg: '#0a1018',
    grid: 'rgba(125,211,252,0.2)',
    buy: '#38bdf8',
    sell: '#fb7185',
    wick: '#64748b',
    label: '#94a3b8',
    accent: '#7dd3fc',
    face: 'rgba(18,28,40,0.9)',
  },
  cyber: {
    bg: '#050508',
    grid: 'rgba(34,211,238,0.22)',
    buy: '#22d3ee',
    sell: '#f472b6',
    wick: '#64748b',
    label: '#94a3b8',
    accent: '#a78bfa',
    face: 'rgba(12,10,24,0.9)',
  },
  fuchsia: {
    bg: '#0c0a0e',
    grid: 'rgba(255,45,149,0.22)',
    buy: '#ff2d95',
    sell: '#e8e8ed',
    wick: '#c7c7cc',
    label: '#f5f5f7',
    accent: '#ff5cad',
    face: 'rgba(42,20,38,0.9)',
  },
}
