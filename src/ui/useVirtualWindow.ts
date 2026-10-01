/**
 * Virtual window hook – wraps @tanstack/react-virtual.
 * Drop-in compatible with the previous in-house API so Tape/Book keep working.
 * Zero behavioral change for callers; real TanStack under the hood.
 */

import { useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

export interface VirtualWindowOptions {
  count: number
  rowHeight: number
  overscan?: number
}

/** @deprecated alias for VirtualWindowOptions */
export type VirtualWindowOpts = VirtualWindowOptions

export interface VirtualWindowResult {
  scrollerRef: React.RefObject<HTMLDivElement | null>
  totalHeight: number
  startIndex: number
  endIndex: number
  offsetY: number
  onScroll: () => void
  virtualItems: ReturnType<ReturnType<typeof useVirtualizer>['getVirtualItems']>
}

export function useVirtualWindow({
  count,
  rowHeight,
  overscan = 8,
}: VirtualWindowOptions): VirtualWindowResult {
  const scrollerRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: Math.max(0, count),
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => rowHeight,
    overscan,
  })

  const items = virtualizer.getVirtualItems()
  const startIndex = items.length ? items[0].index : 0
  const endIndex = items.length ? items[items.length - 1].index + 1 : 0
  const offsetY = items.length ? items[0].start : 0
  const totalHeight = virtualizer.getTotalSize()

  const onScroll = useCallback(() => {
    // no-op: TanStack virtualizer measures on scroll via getScrollElement
  }, [])

  return {
    scrollerRef,
    totalHeight,
    startIndex,
    endIndex,
    offsetY,
    onScroll,
    virtualItems: items,
  }
}
