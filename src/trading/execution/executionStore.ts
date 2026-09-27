/**
 * Execution mode – paper (default) vs live_armed (explicit opt-in).
 * Live never shares state with paper fills.
 */

import { create } from 'zustand'
import { auditAppend } from '@/trading/audit/auditLog'
import { clearSessionCredentials } from '@/trading/credentials/vault'

export type ExecutionMode = 'paper' | 'live_armed'

interface ExecutionState {
  mode: ExecutionMode
  /** User accepted live risk disclosure this session */
  liveRiskAccepted: boolean
  hotkeysEnabled: boolean
  defaultQty: number
  armLive: () => void
  disarmLive: () => void
  acceptLiveRisk: () => void
  setHotkeysEnabled: (v: boolean) => void
  setDefaultQty: (q: number) => void
}

const MODE_KEY = 'tt-exec-mode:v1'

function loadMode(): ExecutionMode {
  try {
    const m = localStorage.getItem(MODE_KEY)
    // Never auto-restore live – always start paper for safety
    void m
    return 'paper'
  } catch {
    return 'paper'
  }
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  mode: loadMode(),
  liveRiskAccepted: false,
  hotkeysEnabled: true,
  defaultQty: 0.001,

  acceptLiveRisk: () => set({ liveRiskAccepted: true }),

  armLive: () => {
    set((s) => {
      if (!s.liveRiskAccepted) return s
      auditAppend({
        mode: 'live',
        action: 'arm_live',
        detail: 'Live execution armed (session only)',
        ok: true,
      })
      return { mode: 'live_armed' }
    })
  },

  disarmLive: () => {
    clearSessionCredentials()
    auditAppend({
      mode: 'live',
      action: 'disarm_live',
      detail: 'Live disarmed; session credentials cleared',
      ok: true,
    })
    set({ mode: 'paper', liveRiskAccepted: false })
  },

  setHotkeysEnabled: (v) => set({ hotkeysEnabled: v }),
  setDefaultQty: (q) => set({ defaultQty: q > 0 ? q : 0.001 }),
}))
