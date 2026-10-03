/** Coalesce high-frequency DOM updates to one per animation frame. */

export function rafThrottle<T extends unknown[]>(fn: (...args: T) => void) {
  let scheduled = false
  let lastArgs: T | null = null
  return (...args: T) => {
    lastArgs = args
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      if (lastArgs) fn(...lastArgs)
      lastArgs = null
    })
  }
}
