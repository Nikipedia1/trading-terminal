/**
 * Density modes – institutional UX.
 * research: full chrome, side panels, toolbars
 * scalp: minimal chrome, more DOM / chart real-estate
 */

import { create } from 'zustand'

export type DensityMode = 'research' | 'scalp'

const KEY = 'tt-density:v1'

function load(): DensityMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'scalp' || v === 'research') return v
  } catch {
    /* */
  }
  return 'research'
}

interface UiDensityState {
  mode: DensityMode
  setMode: (m: DensityMode) => void
  toggle: () => void
  /** true when scalp – hide non-essential chrome */
  isScalp: boolean
}

export const useUiDensityStore = create<UiDensityState>((set, get) => ({
  mode: load(),
  isScalp: load() === 'scalp',

  setMode: (m) => {
    try {
      localStorage.setItem(KEY, m)
    } catch {
      /* */
    }
    document.documentElement.dataset.density = m
    set({ mode: m, isScalp: m === 'scalp' })
  },

  toggle: () => {
    const next = get().mode === 'research' ? 'scalp' : 'research'
    get().setMode(next)
  },
}))

// Apply on module load
if (typeof document !== 'undefined') {
  document.documentElement.dataset.density = load()
}
