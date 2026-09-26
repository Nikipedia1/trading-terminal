/**
 * Live DOM ladder – vertical bid/ask beside the chart (guide-style DeepDom).
 * Data: shared L2 order book feed only. Public limits apply (Binance ≤1000, KuCoin ≤100).
 */

import { useEffect, useState } from 'react'
import type { ExchangeId } from '@/types'
import { subscribeOrderBookFeed, type OrderBookSnapshot } from '@/data/shared'
import { L2_GRANULARITY_NOTES } from './types'

interface DomLadderProps {
  enabled: boolean
  exchange: ExchangeId
  symbol: string
  /** Levels per side (default 12) */
  depth?: number
}

function fmt(n: number): string {
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

export function DomLadder({ enabled, exchange, symbol, depth = 12 }: DomLadderProps) {
  const [book, setBook] = useState<OrderBookSnapshot | null>(null)
  const [status, setStatus] = useState('…')

  useEffect(() => {
    if (!enabled) {
      setBook(null)
      return
    }
    const sub = subscribeOrderBookFeed(exchange, symbol, {
      onBook: (b) => {
        if (b.ready) setBook(b)
      },
      onStatus: (s) => setStatus(s.status),
    })
    return () => sub.unsubscribe()
  }, [enabled, exchange, symbol])

  if (!enabled) return null

  const asks = (book?.asks ?? []).slice(0, depth).reverse()
  const bids = (book?.bids ?? []).slice(0, depth)
  const maxQty = Math.max(
    ...asks.map((l) => l.qty),
    ...bids.map((l) => l.qty),
    0.0001
  )
  const mid =
    book && book.bids[0] && book.asks[0]
      ? (book.bids[0].price + book.asks[0].price) / 2
      : null
  const spread =
    book && book.bids[0] && book.asks[0]
      ? book.asks[0].price - book.bids[0].price
      : null

  return (
    <div className="absolute top-2 right-2 z-[8] w-[140px] pointer-events-none select-none">
      <div className="bg-[#0b0e11]/92 border border-[#2b3139] rounded-md overflow-hidden shadow-lg font-mono text-[10px]">
        <div className="px-1.5 py-1 border-b border-[#2b3139] flex justify-between text-[#848e9c]">
          <span className="font-semibold text-[#eaecef]">DOM</span>
          <span>{status}</span>
        </div>

        {/* Asks (above mid) */}
        <div className="border-b border-[#2b3139]/50">
          {asks.length === 0 ? (
            <div className="px-1.5 py-2 text-[#848e9c] text-center">—</div>
          ) : (
            asks.map((l) => (
              <div key={`a-${l.price}`} className="relative h-[15px] flex items-center px-1">
                <div
                  className="absolute inset-y-0 right-0 bg-[#a855f7]/25"
                  style={{ width: `${(l.qty / maxQty) * 100}%` }}
                />
                <span className="relative text-[#a855f7] w-[52px] tabular-nums">{fmt(l.price)}</span>
                <span className="relative ml-auto text-[#eaecef] tabular-nums">{fmt(l.qty)}</span>
              </div>
            ))
          )}
        </div>

        {/* Mid / spread */}
        <div className="px-1.5 py-0.5 bg-[#12161c] text-center text-[#f0b90b] font-semibold tabular-nums">
          {mid != null ? fmt(mid) : '—'}
          {spread != null && (
            <span className="text-[#848e9c] font-normal ml-1">sp {fmt(spread)}</span>
          )}
        </div>

        {/* Bids */}
        <div>
          {bids.length === 0 ? (
            <div className="px-1.5 py-2 text-[#848e9c] text-center">—</div>
          ) : (
            bids.map((l) => (
              <div key={`b-${l.price}`} className="relative h-[15px] flex items-center px-1">
                <div
                  className="absolute inset-y-0 right-0 bg-[#0ecb81]/25"
                  style={{ width: `${(l.qty / maxQty) * 100}%` }}
                />
                <span className="relative text-[#0ecb81] w-[52px] tabular-nums">{fmt(l.price)}</span>
                <span className="relative ml-auto text-[#eaecef] tabular-nums">{fmt(l.qty)}</span>
              </div>
            ))
          )}
        </div>

        <div className="px-1.5 py-1 border-t border-[#2b3139] text-[8px] text-[#5e6673] leading-tight">
          {(L2_GRANULARITY_NOTES[exchange] || '').slice(0, 72)}
        </div>
      </div>
    </div>
  )
}
