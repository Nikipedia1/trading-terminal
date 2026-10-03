/** Zustand risk state + persistence (user-scoped). */

import { create } from 'zustand'
import { userStorage } from '@/lib/userScopedStorage'
import { auditAppend } from '@/trading/audit/auditLog'
import type { RiskLimits } from './types'
import { DEFAULT_RISK_LIMITS } from './types'
import { checkOrderRisk, dayKeyUtc } from './riskEngine'
import type { RiskCheckInput, RiskCheckResult } from './types'

const KEY = 'tt-risk:v1'

interface Persisted {
  limits: RiskLimits
  consecutiveRejects: number
  dayKey: string
  dailyRealizedPnl: number
}

function load(): Persisted {
  try {
    const raw = userStorage.getItem(KEY)
    if (!raw) throw new Error('empty')
    const p = JSON.parse(raw) as Persisted
    return {
      limits: { ...DEFAULT_RISK_LIMITS, ...p.limits },
      consecutiveRejects: p.consecutiveRejects ?? 0,
      dayKey: p.dayKey || dayKeyUtc(),
      dailyRealizedPnl: typeof p.dailyRealizedPnl === 'number' ? p.dailyRealizedPnl : 0,
    }
  } catch {
    return {
      limits: { ...DEFAULT_RISK_LIMITS },
      consecutiveRejects: 0,
      dayKey: dayKeyUtc(),
      dailyRealizedPnl: 0,
    }
  }
}

function save(p: Persisted) {
  try {
    userStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* */
  }
}

interface RiskState extends Persisted {
  setLimits: (patch: Partial<RiskLimits>) => void
  setKillSwitch: (on: boolean) => void
  recordReject: () => void
  recordAccept: () => void
  addRealizedPnl: (pnl: number) => void
  resetDayIfNeeded: () => void
  resetCircuit: () => void
  evaluate: (input: Omit<RiskCheckInput, 'dailyPnl'>) => RiskCheckResult
}

const initial = load()

export const useRiskStore = create<RiskState>((set, get) => ({
  ...initial,

  setLimits: (patch) => {
    set((s) => {
      const limits = { ...s.limits, ...patch }
      const next = { ...s, limits }
      save({
        limits: next.limits,
        consecutiveRejects: next.consecutiveRejects,
        dayKey: next.dayKey,
        dailyRealizedPnl: next.dailyRealizedPnl,
      })
      return { limits }
    })
  },

  setKillSwitch: (on) => {
    set((s) => {
      const limits = { ...s.limits, killSwitch: on }
      save({
        limits,
        consecutiveRejects: s.consecutiveRejects,
        dayKey: s.dayKey,
        dailyRealizedPnl: s.dailyRealizedPnl,
      })
      auditAppend({
        mode: 'live',
        action: on ? 'error' : 'arm_live',
        detail: on ? 'Kill-switch ON' : 'Kill-switch OFF',
        ok: !on,
      })
      return { limits }
    })
  },

  recordReject: () => {
    set((s) => {
      const consecutiveRejects = s.consecutiveRejects + 1
      let limits = s.limits
      if (consecutiveRejects >= s.limits.maxConsecutiveRejects && !limits.killSwitch) {
        limits = { ...limits, killSwitch: true }
        auditAppend({
          mode: 'live',
          action: 'error',
          detail: `Circuit breaker tripped after ${consecutiveRejects} rejects`,
          ok: false,
        })
      }
      save({
        limits,
        consecutiveRejects,
        dayKey: s.dayKey,
        dailyRealizedPnl: s.dailyRealizedPnl,
      })
      return { consecutiveRejects, limits }
    })
  },

  recordAccept: () => {
    set((s) => {
      if (s.consecutiveRejects === 0) return s
      save({
        limits: s.limits,
        consecutiveRejects: 0,
        dayKey: s.dayKey,
        dailyRealizedPnl: s.dailyRealizedPnl,
      })
      return { consecutiveRejects: 0 }
    })
  },

  addRealizedPnl: (pnl) => {
    get().resetDayIfNeeded()
    set((s) => {
      const dailyRealizedPnl = s.dailyRealizedPnl + pnl
      save({
        limits: s.limits,
        consecutiveRejects: s.consecutiveRejects,
        dayKey: s.dayKey,
        dailyRealizedPnl,
      })
      return { dailyRealizedPnl }
    })
  },

  resetDayIfNeeded: () => {
    const today = dayKeyUtc()
    set((s) => {
      if (s.dayKey === today) return s
      const next = { ...s, dayKey: today, dailyRealizedPnl: 0 }
      save({
        limits: next.limits,
        consecutiveRejects: next.consecutiveRejects,
        dayKey: next.dayKey,
        dailyRealizedPnl: 0,
      })
      return { dayKey: today, dailyRealizedPnl: 0 }
    })
  },

  resetCircuit: () => {
    set((s) => {
      const limits = { ...s.limits, killSwitch: false }
      save({
        limits,
        consecutiveRejects: 0,
        dayKey: s.dayKey,
        dailyRealizedPnl: s.dailyRealizedPnl,
      })
      auditAppend({
        mode: 'live',
        action: 'arm_live',
        detail: 'Risk circuit reset',
        ok: true,
      })
      return { consecutiveRejects: 0, limits }
    })
  },

  evaluate: (input) => {
    get().resetDayIfNeeded()
    const s = get()
    return checkOrderRisk(
      { ...input, dailyPnl: s.dailyRealizedPnl },
      s.limits,
      s.consecutiveRejects
    )
  },
}))
