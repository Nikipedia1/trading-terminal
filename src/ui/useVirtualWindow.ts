/**
 * Windowed list virtualization – same idea as @tanstack/react-virtual.
 * Implemented in-house so CF build never fails on optional peer deps.
 * Drop-in for tape / book / wallet long lists.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface VirtualWindowOpts {
  count: number
  rowHeight: number
  overscan?: number
}

export interface VirtualWindowResult {
  scrollerRef: React.RefObject<HTMLDivElement | null>
  totalHeight: number
  startIndex: number
  endIndex: number
  offsetY: number
  onScroll: () => void
}

export function useVirtualWindow({
  count,
  rowHeight,
  overscan = 10,
}: VirtualWindowOpts): VirtualWindowResult {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewH, setViewH] = useState(240)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setViewH(entries[0].contentRect.height)
    })
    ro.observe(el)
    setViewH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const onScroll = useCallback(() => {
    const el = scrollerRef.current
    if (el) setScrollTop(el.scrollTop)
  }, [])

  const totalHeight = count * rowHeight

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const visible = Math.ceil(viewH / rowHeight) + overscan * 2
    const end = Math.min(count, start + visible)
    return {
      startIndex: start,
      endIndex: end,
      offsetY: start * rowHeight,
    }
  }, [scrollTop, viewH, count, rowHeight, overscan])

  return {
    scrollerRef,
    totalHeight,
    startIndex,
    endIndex,
    offsetY,
    onScroll,
  }
}
