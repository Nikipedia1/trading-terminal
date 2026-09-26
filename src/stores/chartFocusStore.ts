/**
 * Chart focus bus – sidebar / trade list can request chart to center on a time.
 * ChartContainer subscribes and applies timeScale.setVisibleRange.
 */

import { create } from 'zustand'

export interface FocusRequest {
  /** unix seconds */
  timeSec: number
  price?: number
  /** half-window seconds around time (default 30 bars worth approximated by caller) */
  padSec?: number
  /** monotonic id so same time can be re-requested */
  id: number
}

interface ChartFocusState {
  request: FocusRequest | null
  requestFocus: (timeSec: number, opts?: { price?: number; padSec?: number }) => void
  clear: () => void
}

let seq = 0

export const useChartFocusStore = create<ChartFocusState>((set) => ({
  request: null,
  requestFocus: (timeSec, opts) => {
    seq += 1
    set({
      request: {
        timeSec,
        price: opts?.price,
        padSec: opts?.padSec ?? 900,
        id: seq,
      },
    })
  },
  clear: () => set({ request: null }),
}))
