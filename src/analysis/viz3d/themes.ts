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
    bg: '#12161c',
    grid: 'rgba(43,49,57,0.7)',
    buy: '#0ecb81',
    sell: '#f6465d',
    wick: '#848e9c',
    label: '#848e9c',
    accent: '#f0b90b',
    face: 'rgba(30,35,41,0.92)',
  },
  neon: {
    bg: '#020617',
    grid: 'rgba(96,165,250,0.35)',
    buy: '#22d3ee',
    sell: '#e879f9',
    wick: '#64748b',
    label: '#94a3b8',
    accent: '#60a5fa',
    face: 'rgba(15,23,42,0.9)',
  },
  mono: {
    bg: '#0a0a0a',
    grid: 'rgba(120,120,120,0.45)',
    buy: '#f5f5f5',
    sell: '#737373',
    wick: '#a3a3a3',
    label: '#d4d4d4',
    accent: '#ffffff',
    face: 'rgba(28,28,28,0.92)',
  },
  aurora: {
    bg: '#04120e',
    grid: 'rgba(52,211,153,0.3)',
    buy: '#34d399',
    sell: '#c084fc',
    wick: '#64748b',
    label: '#a7f3d0',
    accent: '#67e8f9',
    face: 'rgba(15,40,32,0.9)',
  },
  magma: {
    bg: '#1a0a06',
    grid: 'rgba(251,146,60,0.35)',
    buy: '#fbbf24',
    sell: '#ef4444',
    wick: '#fdba74',
    label: '#fdba74',
    accent: '#fb923c',
    face: 'rgba(60,25,12,0.92)',
  },
  ocean: {
    bg: '#02141c',
    grid: 'rgba(56,189,248,0.32)',
    buy: '#2dd4bf',
    sell: '#f43f5e',
    wick: '#67e8f9',
    label: '#a5f3fc',
    accent: '#38bdf8',
    face: 'rgba(8,40,55,0.92)',
  },
  matrix: {
    bg: '#000a04',
    grid: 'rgba(34,197,94,0.4)',
    buy: '#22c55e',
    sell: '#4ade80',
    wick: '#86efac',
    label: '#4ade80',
    accent: '#86efac',
    face: 'rgba(6,32,14,0.94)',
  },
  gold: {
    bg: '#100e08',
    grid: 'rgba(240,185,11,0.3)',
    buy: '#f0b90b',
    sell: '#848e9c',
    wick: '#c99400',
    label: '#f0b90b',
    accent: '#fcd535',
    face: 'rgba(40,32,12,0.92)',
  },
  ice: {
    bg: '#071422',
    grid: 'rgba(125,211,252,0.32)',
    buy: '#38bdf8',
    sell: '#fb7185',
    wick: '#7dd3fc',
    label: '#bae6fd',
    accent: '#7dd3fc',
    face: 'rgba(12,32,50,0.92)',
  },
  cyber: {
    bg: '#05010a',
    grid: 'rgba(34,211,238,0.32)',
    buy: '#22d3ee',
    sell: '#f472b6',
    wick: '#a78bfa',
    label: '#e9d5ff',
    accent: '#a78bfa',
    face: 'rgba(18,8,32,0.92)',
  },
  fuchsia: {
    bg: '#14020f',
    grid: 'rgba(255,45,149,0.35)',
    buy: '#ff2d95',
    sell: '#f0f0f5',
    wick: '#ff5cad',
    label: '#fce7f3',
    accent: '#ff5cad',
    face: 'rgba(50,10,40,0.94)',
  },
}
