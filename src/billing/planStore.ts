import { create } from 'zustand'
import { PLANS, type PlanId } from './plans'

const STORAGE = 'tt-plan:v1'

function loadPlan(): PlanId {
  try {
    const env = (import.meta as { env?: Record<string, string> }).env?.VITE_DEFAULT_PLAN
    if (env === 'pro' || env === 'team' || env === 'free') {
      /* prefer stored */
    }
    const raw = localStorage.getItem(STORAGE)
    if (raw === 'pro' || raw === 'team' || raw === 'free') return raw
    if (env === 'pro' || env === 'team' || env === 'free') return env
  } catch {
    /* */
  }
  return 'free'
}

interface PlanState {
  planId: PlanId
  setPlan: (id: PlanId) => void
  canLiveTrade: () => boolean
  aiQuotaHour: () => number
}

export const usePlanStore = create<PlanState>((set, get) => ({
  planId: typeof window !== 'undefined' ? loadPlan() : 'free',
  setPlan: (id) => {
    try {
      localStorage.setItem(STORAGE, id)
    } catch {
      /* */
    }
    set({ planId: id })
  },
  canLiveTrade: () => PLANS[get().planId].entitlements.liveTrading,
  aiQuotaHour: () => PLANS[get().planId].entitlements.aiAnalyzePerHour,
}))

export function getPlanDefinition(id?: PlanId) {
  return PLANS[id ?? usePlanStore.getState().planId]
}
