/**
 * Virtualized trade tape – windowed render (TanStack virtual pattern).
 * Handles 10k+ rows without DOM lag.
 */

import { useMemo } from 'react'
import type { Trade } from '@/types'
import { useVirtualWindow } from './useVirtualWindow'

const ROW_H = 18

interface VirtualizedTapeProps {
  trades: Trade[]
  className?: string
}

export function VirtualizedTape({ trades, className = '' }: VirtualizedTapeProps) {
  const total = trades.length
  const { scrollerRef, totalHeight, startIndex, endIndex, offsetY, onScroll } =
    useVirtualWindow({ count: total, rowHeight: ROW_H, overscan: 12 })

  const slice = useMemo(
    () => trades.slice(startIndex, endIndex),
    [trades, startIndex, endIndex]
  )

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
        <div style={{ height: totalHeight, position: 'relative' }}>
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
