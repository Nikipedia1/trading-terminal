/**
 * Per-panel orderflow toggles + configs.
 * Used by ChartPanel and persisted in workspace snapshots.
 */

import { create } from 'zustand'
import type { OrderflowState } from '@/charts/OrderflowMenu'
import { DEFAULT_DEEP_TRADES_CONFIG } from '@/analysis/deepTrades'
import { DEFAULT_DEEP_DOM_CONFIG } from '@/analysis/deepDom'
import { DEFAULT_DELTA_CONFIG } from '@/analysis/deltaPrint'
import { DEFAULT_PROFILE_CONFIG } from '@/analysis/volumeProfile'
import { DEFAULT_GAMMA_CONFIG } from '@/analysis/gamma'

export function defaultOrderflowState(): OrderflowState {
  return {
    print: false,
    delta: false,
    deltaCfg: { ...DEFAULT_DELTA_CONFIG },
    profile: false,
    profileCfg: { ...DEFAULT_PROFILE_CONFIG },
    trades: false,
    tradesCfg: { ...DEFAULT_DEEP_TRADES_CONFIG },
    dom: false,
    domCfg: { ...DEFAULT_DEEP_DOM_CONFIG },
    footprint: false,
    gamma: false,
    gammaCfg: { ...DEFAULT_GAMMA_CONFIG },
    replay: false,
  }
}

interface OrderflowStoreState {
  byPanel: Record<string, OrderflowState>
  get: (panelId: string) => OrderflowState
  set: (panelId: string, next: OrderflowState) => void
  patch: (panelId: string, patch: Partial<OrderflowState>) => void
  hydrate: (map: Record<string, OrderflowState>) => void
  exportAll: () => Record<string, OrderflowState>
}

export const useOrderflowStore = create<OrderflowStoreState>((set, get) => ({
  byPanel: {},

  get: (panelId) => get().byPanel[panelId] ?? defaultOrderflowState(),

  set: (panelId, next) =>
    set((s) => ({
      byPanel: { ...s.byPanel, [panelId]: next },
    })),

  patch: (panelId, patch) =>
    set((s) => {
      const cur = s.byPanel[panelId] ?? defaultOrderflowState()
      return {
        byPanel: { ...s.byPanel, [panelId]: { ...cur, ...patch } },
      }
    }),

  hydrate: (map) => set({ byPanel: map && typeof map === 'object' ? { ...map } : {} }),

  exportAll: () => {
    const out: Record<string, OrderflowState> = {}
    for (const [k, v] of Object.entries(get().byPanel)) {
      out[k] = { ...v }
    }
    return out
  },
}))
