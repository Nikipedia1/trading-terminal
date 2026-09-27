/**
 * Virtualized trade tape – fixed row height, windowed render.
 * Handles 10k+ rows without DOM lag.
 */

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import type { Trade } from '@/types'

const ROW_H = 18
const OVERSCAN = 12

interface VirtualizedTapeProps {
  trades: Trade[]
  className?: string
}

export function VirtualizedTape({ trades, className = '' }: VirtualizedTapeProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewH, setViewH] = useState(200)

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

  const total = trades.length
  const totalH = total * ROW_H

  const { start, end, offsetY } = useMemo(() => {
    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
    const visible = Math.ceil(viewH / ROW_H) + OVERSCAN * 2
    const endIdx = Math.min(total, startIdx + visible)
    return {
      start: startIdx,
      end: endIdx,
      offsetY: startIdx * ROW_H,
    }
  }, [scrollTop, viewH, total])

  const slice = trades.slice(start, end)

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      <div className="shrink-0 grid grid-cols-4 text-[10px] text-[#848e9c] px-2 py-1 border-b border-[#1e2329] font-mono-nums">
        <span>Time</span>
        <span className="text-right">Price</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Side</span>
      </div>
      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto"
        onScroll={onScroll}
      >
        <div style={{ height: totalH, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {slice.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-4 px-2 font-mono-nums text-[10px] border-b border-[#1e2329]/40"
                style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}
              >
                <span className="text-[#848e9c] tabular-nums">
                  {new Date(t.time).toLocaleTimeString()}
                </span>
                <span
                  className={
                    'text-right tabular-nums ' +
                    (t.isBuyerMaker ? 'text-[#f6465d]' : 'text-[#0ecb81]')
                  }
                >
                  {t.price.toFixed(2)}
                </span>
                <span className="text-right text-[#eaecef] tabular-nums">
                  {t.qty.toFixed(5)}
                </span>
                <span
                  className={
                    'text-right ' +
                    (t.isBuyerMaker ? 'text-[#f6465d]' : 'text-[#0ecb81]')
                  }
                >
                  {t.isBuyerMaker ? 'SELL' : 'BUY'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="shrink-0 px-2 py-0.5 text-[9px] text-[#5e6673] border-t border-[#1e2329]">
        {total.toLocaleString()} trades · virtualized
      </div>
    </div>
  )
}
