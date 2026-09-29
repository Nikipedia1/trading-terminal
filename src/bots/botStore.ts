/**
 * Bot instances – localStorage, paper trading only.
 */

import { create } from 'zustand'
import type { BotInstance, BotKind, BotBaseConfig, BotParams } from './types'
import { defaultConfig, defaultParams, ensureRisk } from './types'

const STORAGE_KEY = 'tt-bots:v1'

function uid() {
  return `bot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function load(): BotInstance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as BotInstance[]
    if (!Array.isArray(arr)) return []
    return arr.map((b) => ({
      ...b,
      status: b.enabled ? 'running' : 'paused',
      runtime: b.runtime ?? {},
      config: ensureRisk(b.config ?? defaultConfig()),
    }))
  } catch {
    return []
  }
}

function persist(bots: BotInstance[]) {
  try {
    const slim = bots.map(({ runtime, ...rest }) => ({
      ...rest,
      runtime: {
        lastOrderAt: runtime?.lastOrderAt,
        dcaCount: runtime?.dcaCount,
        gridCenter: runtime?.gridCenter,
        lastSide: runtime?.lastSide,
        dayKey: runtime?.dayKey,
        dayPnl: runtime?.dayPnl,
        dayTrades: runtime?.dayTrades,
      },
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
  } catch {
    /* */
  }
}

interface BotState {
  bots: BotInstance[]
  addBot: (kind: BotKind, name?: string, symbol?: string) => string
  removeBot: (id: string) => void
  updateBot: (
    id: string,
    patch: Partial<
      Pick<
        BotInstance,
        | 'name'
        | 'enabled'
        | 'config'
        | 'params'
        | 'status'
        | 'lastSignal'
        | 'lastError'
        | 'lastTickAt'
        | 'stats'
        | 'runtime'
      >
    >
  ) => void
  setEnabled: (id: string, enabled: boolean) => void
  patchConfig: (id: string, cfg: Partial<BotBaseConfig>) => void
  patchParams: (id: string, params: BotParams) => void
  resetStats: (id: string) => void
}

export const useBotStore = create<BotState>((set, get) => ({
  bots: load(),

  addBot: (kind, name, symbol) => {
    const id = uid()
    const bot: BotInstance = {
      id,
      name: name?.trim() || `${kind} ${get().bots.length + 1}`,
      kind,
      status: 'paused',
      enabled: false,
      config: defaultConfig(symbol ?? 'BTCUSDT'),
      params: defaultParams(kind),
      createdAt: Date.now(),
      lastTickAt: null,
      lastSignal: null,
      lastError: null,
      stats: { trades: 0, wins: 0, losses: 0, realizedPnl: 0 },
      runtime: {},
    }
    set((s) => {
      const bots = [...s.bots, bot]
      persist(bots)
      return { bots }
    })
    return id
  },

  removeBot: (id) => {
    set((s) => {
      const bots = s.bots.filter((b) => b.id !== id)
      persist(bots)
      return { bots }
    })
  },

  updateBot: (id, patch) => {
    set((s) => {
      const bots = s.bots.map((b) => (b.id === id ? { ...b, ...patch } : b))
      persist(bots)
      return { bots }
    })
  },

  setEnabled: (id, enabled) => {
    set((s) => {
      const bots = s.bots.map((b) =>
        b.id === id
          ? {
              ...b,
              enabled,
              status: enabled ? ('running' as const) : ('paused' as const),
              lastError: null,
              runtime:
                enabled && b.kind === 'grid'
                  ? { ...b.runtime, gridCenter: undefined }
                  : b.runtime,
            }
          : b
      )
      persist(bots)
      return { bots }
    })
  },

  patchConfig: (id, cfg) => {
    set((s) => {
      const bots = s.bots.map((b) =>
        b.id === id
          ? { ...b, config: ensureRisk({ ...b.config, ...cfg, risk: cfg.risk ?? b.config.risk }) }
          : b
      )
      persist(bots)
      return { bots }
    })
  },

  patchParams: (id, params) => {
    set((s) => {
      const bots = s.bots.map((b) => (b.id === id ? { ...b, params, kind: params.kind } : b))
      persist(bots)
      return { bots }
    })
  },

  resetStats: (id) => {
    set((s) => {
      const bots = s.bots.map((b) =>
        b.id === id
          ? {
              ...b,
              stats: { trades: 0, wins: 0, losses: 0, realizedPnl: 0 },
              runtime: {},
            }
          : b
      )
      persist(bots)
      return { bots }
    })
  },
}))
