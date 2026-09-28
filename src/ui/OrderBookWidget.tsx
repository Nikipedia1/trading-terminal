/**
 * Order Book widget – Dribbble-inspired movable card UI for the terminal.
 * Layout: mini depth chart + Size | Bid | Ask | Size ladder.
 * Real L2 data only (from marketStore / shared orderBookFeed).
 */

import { useMemo, useRef, useEffect } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import type { OrderBook } from '@/types'

const DEPTH = 8
const CHART_H = 72

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

/** Cumulative depth curve for the mini chart (bids left → mid → asks right). */
function DepthChart({ book }: { book: OrderBook }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const bids = book.bids.slice(0, DEPTH)
    const asks = book.asks.slice(0, DEPTH)
    if (bids.length === 0 && asks.length === 0) return

    // Cumulative size from mid outward
    let bidCum = 0
    const bidPts: { x: number; y: number }[] = []
    for (let i = 0; i < bids.length; i++) {
      bidCum += bids[i].qty
      bidPts.push({ x: i, y: bidCum })
    }
    let askCum = 0
    const askPts: { x: number; y: number }[] = []
    for (let i = 0; i < asks.length; i++) {
      askCum += asks[i].qty
      askPts.push({ x: i, y: askCum })
    }

    const maxCum = Math.max(bidCum, askCum, 0.0001)
    const midX = w / 2
    const padY = 6

    // Bid side (left, teal/green) – from mid leftward
    if (bidPts.length > 0) {
      ctx.beginPath()
      ctx.moveTo(midX, h - padY)
      for (let i = 0; i < bidPts.length; i++) {
        const t = (i + 1) / Math.max(bidPts.length, 1)
        const x = midX - t * (midX - 8)
        const y = h - padY - (bidPts[i].y / maxCum) * (h - padY * 2)
        ctx.lineTo(x, y)
      }
      // Close area under curve
      const last = bidPts[bidPts.length - 1]
      const lastX = midX - (bidPts.length / Math.max(bidPts.length, 1)) * (midX - 8)
      ctx.lineTo(lastX, h - padY)
      ctx.closePath()
      const grad = ctx.createLinearGradient(midX, 0, 0, 0)
      grad.addColorStop(0, 'rgba(14, 203, 129, 0.35)')
      grad.addColorStop(1, 'rgba(14, 203, 129, 0.05)')
      ctx.fillStyle = grad
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(midX, h - padY)
      for (let i = 0; i < bidPts.length; i++) {
        const t = (i + 1) / Math.max(bidPts.length, 1)
        const x = midX - t * (midX - 8)
        const y = h - padY - (bidPts[i].y / maxCum) * (h - padY * 2)
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = '#0ecb81'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Ask side (right, red/orange)
    if (askPts.length > 0) {
      ctx.beginPath()
      ctx.moveTo(midX, h - padY)
      for (let i = 0; i < askPts.length; i++) {
        const t = (i + 1) / Math.max(askPts.length, 1)
        const x = midX + t * (midX - 8)
        const y = h - padY - (askPts[i].y / maxCum) * (h - padY * 2)
        ctx.lineTo(x, y)
      }
      const lastX = midX + (askPts.length / Math.max(askPts.length, 1)) * (midX - 8)
      ctx.lineTo(lastX, h - padY)
      ctx.closePath()
      const grad = ctx.createLinearGradient(midX, 0, w, 0)
      grad.addColorStop(0, 'rgba(246, 70, 93, 0.35)')
      grad.addColorStop(1, 'rgba(246, 70, 93, 0.05)')
      ctx.fillStyle = grad
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(midX, h - padY)
      for (let i = 0; i < askPts.length; i++) {
        const t = (i + 1) / Math.max(askPts.length, 1)
        const x = midX + t * (midX - 8)
        const y = h - padY - (askPts[i].y / maxCum) * (h - padY * 2)
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = '#f6465d'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Mid vertical guide
    ctx.beginPath()
    ctx.moveTo(midX, padY)
    ctx.lineTo(midX, h - padY)
    ctx.strokeStyle = 'rgba(132, 142, 156, 0.35)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }, [book])

  const bestBid = book.bids[0]?.price
  const bestAsk = book.asks[0]?.price
  const mid =
    bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : bestBid ?? bestAsk ?? null
  const low = book.bids[DEPTH - 1]?.price ?? bestBid
  const high = book.asks[DEPTH - 1]?.price ?? bestAsk

  return (
    <div className="relative px-3 pt-2 pb-1">
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: CHART_H }}
      />
      <div className="flex justify-between text-[10px] text-[#848e9c] font-mono-nums mt-0.5 px-0.5">
        <span>{low != null ? fmtPrice(low) : '—'}</span>
        <span className="text-[#eaecef] font-medium">{mid != null ? fmtPrice(mid) : '—'}</span>
        <span>{high != null ? fmtPrice(high) : '—'}</span>
      </div>
    </div>
  )
}

function LevelRow({
  bid,
  ask,
  maxQty,
}: {
  bid?: { price: number; qty: number }
  ask?: { price: number; qty: number }
  maxQty: number
}) {
  const bidPct = bid ? Math.min(100, (bid.qty / maxQty) * 100) : 0
  const askPct = ask ? Math.min(100, (ask.qty / maxQty) * 100) : 0

  return (
    <div className="grid grid-cols-[1fr_auto_auto_1fr] gap-x-1 items-center h-6 text-[11px] font-mono-nums relative">
      {/* Bid size bar (grows right toward center) */}
      <div className="relative h-full flex items-center justify-end pr-1">
        {bid && (
          <>
            <div
              className="absolute inset-y-0.5 right-0 rounded-l-sm"
              style={{
                width: `${bidPct}%`,
                background: 'rgba(14, 203, 129, 0.22)',
              }}
            />
            <span className="relative text-[#848e9c] tabular-nums">{fmtSize(bid.qty)}</span>
          </>
        )}
      </div>

      {/* Bid price */}
      <div className="text-right min-w-[52px]">
        {bid ? (
          <span className="text-[#0ecb81] tabular-nums">{fmtPrice(bid.price)}</span>
        ) : (
          <span className="text-[#5e6673]">—</span>
        )}
      </div>

      {/* Ask price */}
      <div className="text-left min-w-[52px]">
        {ask ? (
          <span className="text-[#f6465d] tabular-nums">{fmtPrice(ask.price)}</span>
        ) : (
          <span className="text-[#5e6673]">—</span>
        )}
      </div>

      {/* Ask size bar (grows left toward center) */}
      <div className="relative h-full flex items-center justify-start pl-1">
        {ask && (
          <>
            <div
              className="absolute inset-y-0.5 left-0 rounded-r-sm"
              style={{
                width: `${askPct}%`,
                background: 'rgba(246, 70, 93, 0.22)',
              }}
            />
            <span className="relative text-[#848e9c] tabular-nums">{fmtSize(ask.qty)}</span>
          </>
        )}
      </div>
    </div>
  )
}

export function OrderBookWidget() {
  const book = useMarketStore((s) => s.orderBook)
  const status = useMarketStore((s) => s.status)

  const { rows, maxQty, mid, spread } = useMemo(() => {
    if (!book) {
      return { rows: [] as { bid?: { price: number; qty: number }; ask?: { price: number; qty: number } }[], maxQty: 1, mid: null as number | null, spread: null as number | null }
    }
    const bids = book.bids.slice(0, DEPTH)
    const asks = book.asks.slice(0, DEPTH)
    const n = Math.max(bids.length, asks.length)
    const rows = Array.from({ length: n }, (_, i) => ({
      bid: bids[i],
      ask: asks[i],
    }))
    const maxQty = Math.max(
      ...bids.map((l) => l.qty),
      ...asks.map((l) => l.qty),
      0.0001
    )
    const mid =
      bids[0] && asks[0] ? (bids[0].price + asks[0].price) / 2 : null
    const spread =
      bids[0] && asks[0] ? asks[0].price - bids[0].price : null
    return { rows, maxQty, mid, spread }
  }, [book])

  if (!book) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-terminal-muted text-sm gap-2">
        <span>No order book</span>
        <span className="text-xxs opacity-70">{status}</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2b3139] shrink-0">
        <span className="text-xs font-semibold text-[#eaecef] tracking-wide">Order Book</span>
        <div className="flex items-center gap-2 text-[10px] text-[#848e9c]">
          {spread != null && (
            <span className="tabular-nums">
              sp <span className="text-[#f0b90b]">{fmtPrice(spread)}</span>
            </span>
          )}
          {mid != null && (
            <span className="tabular-nums text-[#eaecef] font-medium">{fmtPrice(mid)}</span>
          )}
        </div>
      </div>

      {/* Mini depth chart */}
      <div className="border-b border-[#2b3139]/60 shrink-0">
        <DepthChart book={book} />
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_1fr] gap-x-1 px-3 py-1.5 text-[10px] text-[#848e9c] border-b border-[#2b3139]/40 shrink-0">
        <span className="text-right pr-1">Size</span>
        <span className="text-right min-w-[52px] text-[#0ecb81]">Bid</span>
        <span className="text-left min-w-[52px] text-[#f6465d]">Ask</span>
        <span className="text-left pl-1">Size</span>
      </div>

      {/* Levels */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-0.5">
        {rows.map((r, i) => (
          <LevelRow key={i} bid={r.bid} ask={r.ask} maxQty={maxQty} />
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[#2b3139] text-[9px] text-[#5e6673] shrink-0">
        L2 · live · {book.bids.length}+{book.asks.length} levels
      </div>
    </div>
  )
}
