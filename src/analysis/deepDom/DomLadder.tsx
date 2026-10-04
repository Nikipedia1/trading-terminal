/**
 * Professional-ish DOM ladder: tick aggregation, size filter, pull/refill flash.
 * Public L2 only — no queue position / MBO.
 */

import { useEffect, useRef, useState } from 'react'
import type { ExchangeId } from '@/types'
import { subscribeOrderBookFeed, type OrderBookSnapshot } from '@/data/shared'
import { L2_GRANULARITY_NOTES } from './types'

interface DomLadderProps {
  enabled: boolean
  exchange: ExchangeId
  symbol: string
  depth?: number
}

type TickAgg = 1 | 5 | 10

function fmt(n: number): string {
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

function aggregateLevels(
  levels: { price: number; qty: number }[],
  tickMult: number,
  baseTick: number
): { price: number; qty: number }[] {
  if (tickMult <= 1) return levels
  const step = baseTick * tickMult
  const map = new Map<number, number>()
  for (const l of levels) {
    const p = Math.round(l.price / step) * step
    map.set(p, (map.get(p) ?? 0) + l.qty)
  }
  return Array.from(map.entries())
    .map(([price, qty]) => ({ price, qty }))
    .sort((a, b) => b.price - a.price)
}

function inferTick(book: OrderBookSnapshot | null): number {
  if (!book || book.bids.length < 2) return 0.01
  const diffs: number[] = []
  for (let i = 0; i < Math.min(8, book.bids.length - 1); i++) {
    diffs.push(Math.abs(book.bids[i].price - book.bids[i + 1].price))
  }
  diffs.sort((a, b) => a - b)
  return diffs[0] || 0.01
}

export function DomLadder({ enabled, exchange, symbol, depth = 14 }: DomLadderProps) {
  const [book, setBook] = useState<OrderBookSnapshot | null>(null)
  const [status, setStatus] = useState('…')
  const [minSize, setMinSize] = useState(0)
  const [agg, setAgg] = useState<TickAgg>(1)
  const prevQty = useRef<Map<number, number>>(new Map())
  const flash = useRef<Map<number, { side: 'pull' | 'refill'; until: number }>>(new Map())
  const [, bump] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setBook(null)
      return
    }
    const sub = subscribeOrderBookFeed(exchange, symbol, {
      onBook: (b) => {
        if (!b.ready) return
        const now = Date.now()
        const next = new Map<number, number>()
        for (const l of [...b.bids, ...b.asks]) {
          next.set(l.price, l.qty)
          const prev = prevQty.current.get(l.price)
          if (prev != null && prev > 0) {
            if (l.qty >= prev * 3) flash.current.set(l.price, { side: 'refill', until: now + 400 })
            else if (l.qty <= prev / 3) flash.current.set(l.price, { side: 'pull', until: now + 400 })
          }
        }
        for (const [p, q] of prevQty.current) {
          if (!next.has(p) && q > 0) flash.current.set(p, { side: 'pull', until: now + 400 })
        }
        prevQty.current = next
        setBook(b)
        bump((x) => x + 1)
      },
      onStatus: (s) => setStatus(s.status === 'connected' ? 'live' : s.status),
      onError: () => setStatus('err'),
    })
    return () => sub.unsubscribe()
  }, [enabled, exchange, symbol])

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => bump((x) => x + 1), 200)
    return () => window.clearInterval(id)
  }, [enabled])

  if (!enabled) return null

  const tick = inferTick(book)
  let asks = book ? aggregateLevels(book.asks, agg, tick).filter((l) => l.qty >= minSize) : []
  let bids = book ? aggregateLevels(book.bids, agg, tick).filter((l) => l.qty >= minSize) : []
  asks = asks.slice(0, depth).reverse()
  bids = bids.slice(0, depth)
  const maxQty = Math.max(0.0001, ...asks.map((l) => l.qty), ...bids.map((l) => l.qty))
  const mid =
    book && book.bids[0] && book.asks[0]
      ? (book.bids[0].price + book.asks[0].price) / 2
      : null
  const spread =
    book && book.bids[0] && book.asks[0]
      ? book.asks[0].price - book.bids[0].price
      : null
  const now = Date.now()

  const row = (l: { price: number; qty: number }, side: 'ask' | 'bid') => {
    const fl = flash.current.get(l.price)
    const active = fl && fl.until > now
    const bg =
      active && fl!.side === 'refill'
        ? 'rgba(240,185,11,0.35)'
        : active && fl!.side === 'pull'
          ? 'rgba(246,70,93,0.3)'
          : side === 'ask'
            ? 'rgba(168,85,247,0.25)'
            : 'rgba(14,203,129,0.25)'
    return (
      <div key={`${side}-${l.price}`} className="relative h-[18px] flex items-center px-1.5">
        <div
          className="absolute inset-y-0 right-0"
          style={{ width: `${(l.qty / maxQty) * 100}%`, background: bg }}
        />
        <span
          className={`relative w-[64px] tabular-nums text-[11px] ${
            side === 'ask' ? 'text-[#a855f7]' : 'text-[#0ecb81]'
          }`}
        >
          {fmt(l.price)}
        </span>
        <span className="relative ml-auto text-[#eaecef] tabular-nums">{fmt(l.qty)}</span>
      </div>
    )
  }

  return (
    <div className="absolute top-2 right-2 z-[8] w-[200px] pointer-events-auto select-none">
      <div className="bg-[#0b0e11]/94 border border-[#2b3139] rounded-md overflow-hidden shadow-lg font-mono text-[11px]">
        <div className="px-1.5 py-1 border-b border-[#2b3139] flex justify-between text-[#848e9c]">
          <span className="font-semibold text-[#eaecef]">DOM</span>
          <span>{status}</span>
        </div>

        <div className="px-1.5 py-1 flex gap-1 border-b border-[#2b3139] items-center">
          <span className="text-[#5e6673]">agg</span>
          {([1, 5, 10] as TickAgg[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`px-1 rounded ${
                agg === t ? 'bg-[#f0b90b]/20 text-[#f0b90b]' : 'text-[#848e9c]'
              }`}
              onClick={() => setAgg(t)}
            >
              {t}t
            </button>
          ))}
          <span className="text-[#5e6673] ml-1">min</span>
          <input
            type="number"
            min={0}
            step="any"
            className="w-12 bg-[#12161c] border border-[#2b3139] rounded px-0.5 text-[10px]"
            value={minSize}
            onChange={(e) => setMinSize(Number(e.target.value) || 0)}
          />
        </div>

        <div className="border-b border-[#2b3139]/50">
          {asks.length === 0 ? (
            <div className="px-1.5 py-2 text-[#848e9c] text-center">—</div>
          ) : (
            asks.map((l) => row(l, 'ask'))
          )}
        </div>

        <div className="px-1.5 py-0.5 bg-[#12161c] text-center text-[#f0b90b] font-semibold tabular-nums">
          {mid != null ? fmt(mid) : '—'}
          {spread != null && (
            <span className="text-[#848e9c] font-normal ml-1">sp {fmt(spread)}</span>
          )}
        </div>

        <div>
          {bids.length === 0 ? (
            <div className="px-1.5 py-2 text-[#848e9c] text-center">—</div>
          ) : (
            bids.map((l) => row(l, 'bid'))
          )}
        </div>

        <div className="px-1.5 py-1 border-t border-[#2b3139] text-[8px] text-[#5e6673] leading-tight">
          Flash = pull/refill vs prev sample. No MBO/queue.{' '}
          {(L2_GRANULARITY_NOTES[exchange] || '').slice(0, 48)}
        </div>
      </div>
    </div>
  )
}
