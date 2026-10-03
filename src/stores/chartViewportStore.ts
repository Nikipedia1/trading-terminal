/**
 * Primary chart viewport bus — visible time range + crosshair.
 * ChartContainer publishes; 3D Pro / overlays subscribe for live sync.
 */

import { create } from 'zustand'

export interface ChartViewportState {
  panelId: string | null
  symbol: string | null
  interval: string | null
  /** Visible range in unix seconds (from chart timeScale) */
  fromSec: number | null
  toSec: number | null
  /** Crosshair */
  crosshairTime: number | null
  crosshairPrice: number | null
  /** Monotonic tick so subscribers can force refresh */
  rev: number

  setViewport: (patch: {
    panelId?: string | null
    symbol?: string | null
    interval?: string | null
    fromSec?: number | null
    toSec?: number | null
  }) => void
  setCrosshair: (time: number | null, price: number | null) => void
  clearCrosshair: () => void
}

export const useChartViewportStore = create<ChartViewportState>((set) => ({
  panelId: null,
  symbol: null,
  interval: null,
  fromSec: null,
  toSec: null,
  crosshairTime: null,
  crosshairPrice: null,
  rev: 0,

  setViewport: (patch) =>
    set((s) => ({
      ...s,
      ...patch,
      rev: s.rev + 1,
    })),

  setCrosshair: (time, price) =>
    set((s) => ({
      ...s,
      crosshairTime: time,
      crosshairPrice: price,
      rev: s.rev + 1,
    })),

  clearCrosshair: () =>
    set((s) => ({
      ...s,
      crosshairTime: null,
      crosshairPrice: null,
      rev: s.rev + 1,
    })),
}))
