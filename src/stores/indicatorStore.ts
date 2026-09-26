/**
 * Per-panel indicator visibility + params. Persisted in localStorage.
 */

import { create } from 'zustand'
import {
  type IndicatorId,
  type IndicatorParams,
  type IndicatorParamsMap,
  DEFAULT_INDICATOR_PARAMS,
} from '@/indicators'

const STORAGE_KEY = 'tt-indicators:v2'

type PanelMap = Record<string, IndicatorParamsMap>

function cloneDefaults(): IndicatorParamsMap {
  return structuredClone(DEFAULT_INDICATOR_PARAMS)
}

function loadAll(): PanelMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PanelMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persist(map: PanelMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function mergePanel(saved?: IndicatorParamsMap): IndicatorParamsMap {
  const base = cloneDefaults()
  if (!saved) return base
  for (const id of Object.keys(base) as IndicatorId[]) {
    if (saved[id]) base[id] = { ...base[id], ...saved[id] }
  }
  return base
}

interface IndicatorState {
  byPanel: PanelMap
  menuPanelId: string | null
  getParams: (panelId: string) => IndicatorParamsMap
  setVisible: (panelId: string, id: IndicatorId, visible: boolean) => void
  setParams: (panelId: string, id: IndicatorId, patch: Partial<IndicatorParams>) => void
  resetPanel: (panelId: string) => void
  openMenu: (panelId: string) => void
  closeMenu: () => void
  toggleMenu: (panelId: string) => void
}

export const useIndicatorStore = create<IndicatorState>((set, get) => ({
  byPanel: loadAll(),
  menuPanelId: null,

  getParams: (panelId) => mergePanel(get().byPanel[panelId]),

  setVisible: (panelId, id, visible) => {
    const byPanel = { ...get().byPanel }
    const cur = mergePanel(byPanel[panelId])
    cur[id] = { ...cur[id], visible }
    byPanel[panelId] = cur
    persist(byPanel)
    set({ byPanel })
  },

  setParams: (panelId, id, patch) => {
    const byPanel = { ...get().byPanel }
    const cur = mergePanel(byPanel[panelId])
    cur[id] = { ...cur[id], ...patch }
    byPanel[panelId] = cur
    persist(byPanel)
    set({ byPanel })
  },

  resetPanel: (panelId) => {
    const byPanel = { ...get().byPanel }
    byPanel[panelId] = cloneDefaults()
    persist(byPanel)
    set({ byPanel })
  },

  openMenu: (panelId) => set({ menuPanelId: panelId }),
  closeMenu: () => set({ menuPanelId: null }),
  toggleMenu: (panelId) =>
    set((s) => ({
      menuPanelId: s.menuPanelId === panelId ? null : panelId,
    })),
}))
