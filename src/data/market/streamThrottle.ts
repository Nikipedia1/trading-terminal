/**
 * Throttle + backpressure helpers for high-frequency trade/book streams.
 */

import { STREAM_POLICY } from './feedPolicy'

/** Leading-edge throttle: at most `hz` calls per second; drops intermediate. */
export function createHzThrottle<T extends unknown[]>(
  hz: number,
  fn: (...args: T) => void
): { call: (...args: T) => void; dropped: () => number; reset: () => void } {
  const minGap = 1000 / Math.max(1, hz)
  let last = 0
  let dropped = 0
  let pending: T | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    timer = null
    if (!pending) return
    const args = pending
    pending = null
    last = Date.now()
    fn(...args)
  }

  return {
    call: (...args: T) => {
      const now = Date.now()
      if (now - last >= minGap) {
        last = now
        fn(...args)
        return
      }
      dropped++
      pending = args
      if (!timer) {
        timer = setTimeout(flush, Math.max(0, minGap - (now - last)))
      }
    },
    dropped: () => dropped,
    reset: () => {
      dropped = 0
      pending = null
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}

/** Bounded queue: push drops oldest when over max (backpressure). */
export function createBoundedQueue<T>(max: number) {
  const q: T[] = []
  let dropped = 0
  return {
    push(item: T) {
      q.push(item)
      while (q.length > max) {
        q.shift()
        dropped++
      }
    },
    drain(): T[] {
      const out = q.slice()
      q.length = 0
      return out
    },
    size: () => q.length,
    dropped: () => dropped,
    clear() {
      q.length = 0
    },
  }
}

export function tradeThrottle<T extends unknown[]>(fn: (...args: T) => void) {
  return createHzThrottle(STREAM_POLICY.tradeEmitHz, fn)
}

export function bookThrottle<T extends unknown[]>(fn: (...args: T) => void) {
  return createHzThrottle(STREAM_POLICY.bookEmitHz, fn)
}
