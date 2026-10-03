/**
 * Shared macro calendar state for the Calendario panel + chart overlays.
 * High-impact event times drive vertical lines via CoordinateBridge.
 */

import { create } from 'zustand'
import type { MacroCalendarEvent, MacroImpact } from '@/panels/calendar/types'

interface CalendarState {
  events: MacroCalendarEvent[]
  fetchedAt: string | null
  loading: boolean
  error: string | null
  /** When true, high-impact vertical lines render on charts */
  showHighImpactLines: boolean
  impactFilter: MacroImpact | 'all'

  setEvents: (events: MacroCalendarEvent[], fetchedAt?: string | null) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  setShowHighImpactLines: (v: boolean) => void
  setImpactFilter: (f: MacroImpact | 'all') => void

  /** Unix seconds of high-impact events (for chart) */
  highImpactTimes: () => { timeSec: number; label: string; id: string }[]
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  fetchedAt: null,
  loading: false,
  error: null,
  showHighImpactLines: true,
  impactFilter: 'all',

  setEvents: (events, fetchedAt = null) =>
    set({ events, fetchedAt: fetchedAt ?? new Date().toISOString(), error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setShowHighImpactLines: (showHighImpactLines) => set({ showHighImpactLines }),
  setImpactFilter: (impactFilter) => set({ impactFilter }),

  highImpactTimes: () => {
    const out: { timeSec: number; label: string; id: string }[] = []
    for (const e of get().events) {
      if (e.impact !== 'high') continue
      const ms = Date.parse(e.time)
      if (!Number.isFinite(ms)) continue
      out.push({
        timeSec: Math.floor(ms / 1000),
        label: e.name.length > 28 ? `${e.name.slice(0, 26)}…` : e.name,
        id: e.id,
      })
    }
    return out
  },
}))
