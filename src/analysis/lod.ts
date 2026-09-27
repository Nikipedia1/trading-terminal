/**
 * Level-of-detail helpers for orderflow overlays.
 * When zoomed out (many bars visible), reduce paint density.
 */

export interface LodLevel {
  /** 0 = full detail, 1 = medium, 2 = sparse */
  level: 0 | 1 | 2
  /** Max items to paint (bubbles, footprint cells, etc.) */
  maxItems: number
  /** Skip every N-th bar when aggregating */
  barStride: number
  /** Min px width before skipping a cell */
  minCellPx: number
}

/**
 * Derive LOD from visible bar count (or pixel span).
 * @param visibleBars number of candles currently in view
 */
export function lodFromVisibleBars(visibleBars: number): LodLevel {
  if (visibleBars <= 80) {
    return { level: 0, maxItems: 800, barStride: 1, minCellPx: 2 }
  }
  if (visibleBars <= 200) {
    return { level: 1, maxItems: 400, barStride: 2, minCellPx: 3 }
  }
  return { level: 2, maxItems: 150, barStride: 4, minCellPx: 4 }
}

/** Cap an array intelligently: keep newest + every N-th of the rest */
export function lodCap<T>(items: T[], max: number, preferEnd = true): T[] {
  if (items.length <= max) return items
  if (max <= 0) return []
  if (preferEnd) {
    // Keep last max items (live edge is most important)
    return items.slice(items.length - max)
  }
  const stride = Math.ceil(items.length / max)
  const out: T[] = []
  for (let i = 0; i < items.length; i += stride) {
    out.push(items[i])
    if (out.length >= max) break
  }
  return out
}

/** Decimate by stride (e.g. barStride from LOD) */
export function lodStride<T>(items: T[], stride: number): T[] {
  if (stride <= 1) return items
  const out: T[] = []
  for (let i = 0; i < items.length; i += stride) out.push(items[i])
  return out
}
