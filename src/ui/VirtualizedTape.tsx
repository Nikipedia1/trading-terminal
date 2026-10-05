/**
 * Virtualized trade tape – windowed render.
 * Desk widget: live trades from marketStore (primary instrument).
 * Optional trades prop for embedded use.
 */

import { useMemo } from 'react'
import type { Trade } from '@/types'
import { useMarketStore } from '@/stores/marketStore'
import { useVirtualWindow } from './useVirtualWindow'

const ROW_H = 18

interface VirtualizedTapeProps {
  /** If omitted, uses live marketStore.trades */
  trades?: Trade[]
  className?: string
}

export function VirtualizedTape({ trades: tradesProp, className = '' }: VirtualizedTapeProps) {
  const storeTrades = useMarketStore((s) => s.trades)
  const symbol = useMarketStore((s) => s.symbol)
  const status = useMarketStore((s) => s.status)
  const trades = tradesProp ?? storeTrades ?? []
  const total = trades.length

  const { scrollerRef, totalHeight, startIndex, endIndex, offsetY, onScroll } =
    useVirtualWindow({ count: total, rowHeight: ROW_H, overscan: 12 })

  const slice = useMemo(
    () => trades.slice(startIndex, endIndex),
    [trades, startIndex, endIndex]
  )

  return (
    <div className={`flex flex-col h-full min-h-0 bg-[#0b0e11] ${className}`}>
      <div className="shrink-0 flex items-center justify-between px-2 py-1 border-b border-[#1e2329]">
        <span className="text-[10px] font-semibold tracking-wide text-[#848e9c]">TAPE</span>
        <span className="text-[10px] font-mono text-[#5e6673]">
          {symbol} · {status === 'connected' ? 'LIVE' : String(status)}
        </span>
      </div>
      <div className="shrink-0 grid grid-cols-4 text-[10px] text-[#848e9c] px-2 py-1 border-b border-[#1e2329] font-mono">
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
        {total === 0 ? (
          <div className="px-2 py-6 text-center text-[11px] text-[#5e6673]">
            Waiting for trades… Start Live on the chart.
          </div>
        ) : (
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {slice.map((t, i) => {
                const isSell = !!t.isBuyerMaker
                const key = t.id || `${t.time}-${t.price}-${t.qty}-${startIndex + i}`
                const timeMs = t.time < 1e12 ? t.time * 1000 : t.time
                return (
                  <div
                    key={key}
                    className="grid grid-cols-4 px-2 font-mono text-[10px] border-b border-[#1e2329]/40"
                    style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}
                  >
                    <span className="text-[#848e9c] tabular-nums">
                      {new Date(timeMs).toLocaleTimeString()}
                    </span>
                    <span
                      className={
                        'text-right tabular-nums ' +
                        (isSell ? 'text-[#f6465d]' : 'text-[#0ecb81]')
                      }
                    >
                      {Number.isFinite(t.price) ? t.price.toFixed(t.price < 1 ? 6 : 2) : '—'}
                    </span>
                    <span className="text-right text-[#eaecef] tabular-nums">
                      {Number.isFinite(t.qty) ? t.qty.toFixed(5) : '—'}
                    </span>
                    <span
                      className={
                        'text-right ' + (isSell ? 'text-[#f6465d]' : 'text-[#0ecb81]')
                      }
                    >
                      {isSell ? 'SELL' : 'BUY'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <div className="shrink-0 px-2 py-0.5 text-[9px] text-[#5e6673] border-t border-[#1e2329]">
        {total.toLocaleString()} trades · virtualized
      </div>
    </div>
  )
}
