/**
 * Order Book widget – Dribbble-inspired movable card UI for the terminal.
 * Layout: solid filled depth mountain + Size | Bid | Ask | Size ladder.
 * Real L2 data only (from marketStore / shared orderBookFeed).
 */

import { useMemo, useRef, useEffect } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import type { OrderBook } from '@/types'
import { LargeTradesPanel } from '@/analysis/deepTrades/LargeTradesPanel'
import { useLayoutStore } from '@/stores/layoutStore'

const DEPTH = 8
const CHART_H = 88
const LERP_SPEED = 0.18

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

function fmtSize(n: number): string {
  if (n >= 1000) return n.toFixed(0)
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(4)
}

function DepthChart({ book }: { book: OrderBook | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !book) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const w = c.width
    const h = c.height
    ctx.clearRect(0, 0, w, h)
    const bids = book.bids.slice(0, DEPTH)
    const asks = book.asks.slice(0, DEPTH)
    const maxQty = Math.max(
      1,
      ...bids.map((b) => b[1]),
      ...asks.map((a) => a[1])
    )
    const mid = w / 2
    const rowH = h / DEPTH
    bids.forEach((b, i) => {
      const bw = (b[1] / maxQty) * (mid - 4)
      ctx.fillStyle = 'rgba(14, 203, 129, 0.35)'
      ctx.fillRect(mid - bw, i * rowH + 1, bw, rowH - 2)
    })
    asks.forEach((a, i) => {
      const aw = (a[1] / maxQty) * (mid - 4)
      ctx.fillStyle = 'rgba(246, 70, 93, 0.35)'
      ctx.fillRect(mid, i * rowH + 1, aw, rowH - 2)
    })
  }, [book])
  return <canvas ref={canvasRef} width={280} height={CHART_H} className="w-full" style={{ height: CHART_H }} />
}

function LevelRow({
  bid,
  ask,
  maxQty,
}: {
  bid?: [number, number]
  ask?: [number, number]
  maxQty: number
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_1fr] gap-x-1 items-center text-[11px] font-mono tabular-nums leading-5">
      <span className="text-right pr-1 text-[#848e9c]">{bid ? fmtSize(bid[1]) : ''}</span>
      <span className="text-right min-w-[52px] text-[#0ecb81]">{bid ? fmtPrice(bid[0]) : ''}</span>
      <span className="text-left min-w-[52px] text-[#f6465d]">{ask ? fmtPrice(ask[0]) : ''}</span>
      <span className="text-left pl-1 text-[#848e9c]">{ask ? fmtSize(ask[1]) : ''}</span>
    </div>
  )
}

export function OrderBookWidget() {
  const book = useMarketStore((s) => s.orderBook)
  const bids = book?.bids?.slice(0, DEPTH) ?? []
  const asks = book?.asks?.slice(0, DEPTH) ?? []
  const maxQty = useMemo(() => {
    let m = 1
    for (const b of bids) m = Math.max(m, b[1])
    for (const a of asks) m = Math.max(m, a[1])
    return m
  }, [bids, asks])
  const rows = Array.from({ length: DEPTH }, (_, i) => ({
    bid: bids[i] as [number, number] | undefined,
    ask: asks[i] as [number, number] | undefined,
  }))
  const mid =
    bids[0] && asks[0] ? (bids[0][0] + asks[0][0]) / 2 : null

  return (
    <div className="h-full flex flex-col bg-[#0b0e11] text-[#eaecef]">
      <div className="px-3 py-1.5 border-b border-[#2b3139] flex items-center justify-between shrink-0">
        <span className="text-[11px] font-semibold tracking-wide text-[#848e9c]">ORDER BOOK</span>
        <div className="text-[10px] text-[#848e9c]">
          {mid != null && (
            <span className="tabular-nums text-[#eaecef] font-medium">{fmtPrice(mid)}</span>
          )}
        </div>
      </div>
      <div className="border-b border-[#2b3139]/60 shrink-0">
        <DepthChart book={book} />
      </div>
      <div className="grid grid-cols-[1fr_auto_auto_1fr] gap-x-1 px-3 py-1.5 text-[10px] text-[#848e9c] border-b border-[#2b3139]/40 shrink-0">
        <span className="text-right pr-1">Size</span>
        <span className="text-right min-w-[52px] text-[#0ecb81]">Bid</span>
        <span className="text-left min-w-[52px] text-[#f6465d]">Ask</span>
        <span className="text-left pl-1">Size</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-0.5">
        {rows.map((r, i) => (
          <LevelRow key={i} bid={r.bid} ask={r.ask} maxQty={maxQty} />
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-[#2b3139] text-[9px] text-[#5e6673] shrink-0">
        L2 · live · {(book?.bids?.length ?? 0)}+{(book?.asks?.length ?? 0)} levels
      </div>
    </div>
  )
}

/** Large trades widget – primary chart instrument from layout store. */
export function LargeTradesWidget() {
  const primary = useLayoutStore(
    (s) => s.panels.find((p) => p.id === s.primaryPanelId) ?? s.panels[0]
  )
  if (!primary) {
    return (
      <div className="h-full flex items-center justify-center text-[11px] text-[#5e6673]">
        No chart panel
      </div>
    )
  }
  return (
    <LargeTradesPanel
      exchange={primary.exchange}
      symbol={primary.symbol}
      interval={primary.interval}
      candles={[]}
    />
  )
}
