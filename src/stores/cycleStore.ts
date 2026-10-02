/** Per-panel cycle analysis config. */

import { create } from 'zustand'
import type { CycleConfig } from '@/analysis/cycles'
import { DEFAULT_CYCLE_CONFIG } from '@/analysis/cycles'

export function defaultCycleConfig(): CycleConfig {
  return { ...DEFAULT_CYCLE_CONFIG }
}

interface CycleStoreState {
  byPanel: Record<string, CycleConfig>
  get: (panelId: string) => CycleConfig
  set: (panelId: string, next: CycleConfig) => void
  patch: (panelId: string, patch: Partial<CycleConfig>) => void
}

export const useCycleStore = create<CycleStoreState>((set, get) => ({
  byPanel: {},

  get: (panelId) => get().byPanel[panelId] ?? defaultCycleConfig(),

  set: (panelId, next) =>
    set((s) => ({
      byPanel: { ...s.byPanel, [panelId]: next },
    })),

  patch: (panelId, patch) =>
    set((s) => {
      const cur = s.byPanel[panelId] ?? defaultCycleConfig()
      return {
        byPanel: { ...s.byPanel, [panelId]: { ...cur, ...patch } },
      }
    }),
}))
