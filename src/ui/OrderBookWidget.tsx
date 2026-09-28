/**
 * Order Book widget – Dribbble-inspired movable card UI for the terminal.
 * Layout: animated depth mountain chart + Size | Bid | Ask | Size ladder.
 * Real L2 data only (from marketStore / shared orderBookFeed).
 */

import { useMemo, useRef, useEffect } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import type { OrderBook } from '@/types'

const DEPTH = 8
const CHART_H = 88
const LERP_SPEED = 0.18 // higher = snappier mountain morph

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

/** Build cumulative depth samples: left bids (outer→mid), right asks (mid→outer). */
function buildMountain(book: OrderBook): { xs: number[]; ys: number[]; midIdx: number } {
  const bids = book.bids.slice(0, DEPTH)
  const asks = book.asks.slice(0, DEPTH)

  // cumulative from best outward
  const bidCums: number[] = []
  let c = 0
  for (const l of bids) {
    c += l.qty
    bidCums.push(c)
  }
  const askCums: number[] = []
  c = 0
  for (const l of asks) {
    c += l.qty
    askCums.push(c)
  }

  const maxCum = Math.max(
    bidCums[bidCums.length - 1] ?? 0,
    askCums[askCums.length - 1] ?? 0,
    0.0001
  )

  // Path: deepest bid (left) → best bid → mid valley (0) → best ask → deepest ask (right)
  // Normalized x in [0,1], y in [0,1] where 1 = max height (outer edges)
  const xs: number[] = []
  const ys: number[] = []

  // Bids reversed: outer → best (left half)
  for (let i = bidCums.length - 1; i >= 0; i--) {
    const t = bidCums.length <= 1 ? 0 : (bidCums.length - 1 - i) / (bidCums.length)
    xs.push(t * 0.48) // 0 .. ~0.48
    ys.push(bidCums[i] / maxCum)
  }
  // Valley at mid
  xs.push(0.5)
  ys.push(0.02) // slight floor so the valley is visible
  const midIdx = xs.length - 1

  // Asks: best → outer (right half)
  for (let i = 0; i < askCums.length; i++) {
    const t = askCums.length <= 1 ? 1 : (i + 1) / askCums.length
    xs.push(0.52 + t * 0.48) // ~0.52 .. 1
    ys.push(askCums[i] / maxCum)
  }

  // Ensure at least 3 points
  if (xs.length < 3) {
    return { xs: [0, 0.5, 1], ys: [0.6, 0.02, 0.6], midIdx: 1 }
  }
  return { xs, ys, midIdx }
}

/** Animated depth mountain: continuous green→red U-curve, lerps on book updates. */
function DepthChart({ book }: { book: OrderBook }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetRef = useRef(buildMountain(book))
  const currentRef = useRef(buildMountain(book))
  const rafRef = useRef(0)

  // Push new target whenever book changes
  useEffect(() => {
    targetRef.current = buildMountain(book)
  }, [book])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w <= 0 || h <= 0) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const target = targetRef.current
      const cur = currentRef.current

      // Align lengths (pad with last value)
      const n = Math.max(cur.xs.length, target.xs.length)
      while (cur.xs.length < n) {
        cur.xs.push(cur.xs[cur.xs.length - 1] ?? 0.5)
        cur.ys.push(cur.ys[cur.ys.length - 1] ?? 0)
      }
      while (target.xs.length < n) {
        target.xs.push(target.xs[target.xs.length - 1] ?? 0.5)
        target.ys.push(target.ys[target.ys.length - 1] ?? 0)
      }

      // Lerp toward target
      let moving = false
      for (let i = 0; i < n; i++) {
        const dx = target.xs[i] - cur.xs[i]
        const dy = target.ys[i] - cur.ys[i]
        if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) moving = true
        cur.xs[i] += dx * LERP_SPEED
        cur.ys[i] += dy * LERP_SPEED
      }
      cur.midIdx = target.midIdx

      const padX = 4
      const padY = 8
      const plotW = w - padX * 2
      const plotH = h - padY * 2

      const toX = (t: number) => padX + t * plotW
      // y=1 at top of mountain (outer edges), y=0 at valley bottom
      const toY = (v: number) => padY + plotH - v * plotH

      // --- Fill under mountain (split gradient at mid) ---
      const midX = toX(0.5)

      // Left (bid) fill
      ctx.beginPath()
      ctx.moveTo(toX(cur.xs[0]), h - padY)
      for (let i = 0; i < cur.xs.length; i++) {
        if (cur.xs[i] > 0.5) break
        const x = toX(cur.xs[i])
        const y = toY(cur.ys[i])
        if (i === 0) ctx.lineTo(x, y)
        else {
          // smooth step
          const px = toX(cur.xs[i - 1])
          const py = toY(cur.ys[i - 1])
          const cpx = (px + x) / 2
          ctx.quadraticCurveTo(cpx, py, x, y)
        }
      }
      ctx.lineTo(midX, h - padY)
      ctx.closePath()
      const gL = ctx.createLinearGradient(0, 0, midX, 0)
      gL.addColorStop(0, 'rgba(14, 203, 129, 0.28)')
      gL.addColorStop(1, 'rgba(14, 203, 129, 0.06)')
      ctx.fillStyle = gL
      ctx.fill()

      // Right (ask) fill
      ctx.beginPath()
      ctx.moveTo(midX, h - padY)
      let started = false
      for (let i = 0; i < cur.xs.length; i++) {
        if (cur.xs[i] < 0.5) continue
        const x = toX(cur.xs[i])
        const y = toY(cur.ys[i])
        if (!started) {
          ctx.lineTo(x, y)
          started = true
        } else {
          const px = toX(cur.xs[i - 1])
          const py = toY(cur.ys[i - 1])
          const cpx = (px + x) / 2
          ctx.quadraticCurveTo(cpx, py, x, y)
        }
      }
      ctx.lineTo(toX(cur.xs[cur.xs.length - 1]), h - padY)
      ctx.closePath()
      const gR = ctx.createLinearGradient(midX, 0, w, 0)
      gR.addColorStop(0, 'rgba(246, 70, 93, 0.06)')
      gR.addColorStop(1, 'rgba(246, 70, 93, 0.28)')
      ctx.fillStyle = gR
      ctx.fill()

      // --- Stroke: continuous mountain line, color splits at mid ---
      // Green half
      ctx.beginPath()
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      let first = true
      for (let i = 0; i < cur.xs.length; i++) {
        if (cur.xs[i] > 0.5) break
        const x = toX(cur.xs[i])
        const y = toY(cur.ys[i])
        if (first) {
          ctx.moveTo(x, y)
          first = false
        } else {
          const px = toX(cur.xs[i - 1])
          const py = toY(cur.ys[i - 1])
          ctx.quadraticCurveTo((px + x) / 2, py, x, y)
        }
      }
      // connect into valley
      ctx.lineTo(midX, toY(0.02))
      ctx.strokeStyle = '#0ecb81'
      ctx.stroke()

      // Red half
      ctx.beginPath()
      ctx.moveTo(midX, toY(0.02))
      first = true
      for (let i = 0; i < cur.xs.length; i++) {
        if (cur.xs[i] < 0.5) continue
        const x = toX(cur.xs[i])
        const y = toY(cur.ys[i])
        if (first) {
          ctx.lineTo(x, y)
          first = false
        } else {
          const px = toX(cur.xs[i - 1])
          const py = toY(cur.ys[i - 1])
          ctx.quadraticCurveTo((px + x) / 2, py, x, y)
        }
      }
      ctx.strokeStyle = '#f6465d'
      ctx.stroke()

      // Soft glow on peak edges
      ctx.globalCompositeOperation = 'lighter'
      ctx.beginPath()
      ctx.arc(toX(cur.xs[0]), toY(cur.ys[0]), 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(14, 203, 129, 0.35)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(toX(cur.xs[cur.xs.length - 1]), toY(cur.ys[cur.ys.length - 1]), 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(246, 70, 93, 0.35)'
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const bestBid = book.bids[0]?.price
  const bestAsk = book.asks[0]?.price
  const mid =
    bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : bestBid ?? bestAsk ?? null
  const low = book.bids[Math.min(DEPTH, book.bids.length) - 1]?.price ?? bestBid
  const high = book.asks[Math.min(DEPTH, book.asks.length) - 1]?.price ?? bestAsk

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
      <div className="relative h-full flex items-center justify-end pr-1">
        {bid && (
          <>
            <div
              className="absolute inset-y-0.5 right-0 rounded-l-sm transition-[width] duration-150"
              style={{
                width: `${bidPct}%`,
                background: 'rgba(14, 203, 129, 0.22)',
              }}
            />
            <span className="relative text-[#848e9c] tabular-nums">{fmtSize(bid.qty)}</span>
          </>
        )}
      </div>

      <div className="text-right min-w-[52px]">
        {bid ? (
          <span className="text-[#0ecb81] tabular-nums">{fmtPrice(bid.price)}</span>
        ) : (
          <span className="text-[#5e6673]">—</span>
        )}
      </div>

      <div className="text-left min-w-[52px]">
        {ask ? (
          <span className="text-[#f6465d] tabular-nums">{fmtPrice(ask.price)}</span>
        ) : (
          <span className="text-[#5e6673]">—</span>
        )}
      </div>

      <div className="relative h-full flex items-center justify-start pl-1">
        {ask && (
          <>
            <div
              className="absolute inset-y-0.5 left-0 rounded-r-sm transition-[width] duration-150"
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
      return {
        rows: [] as { bid?: { price: number; qty: number }; ask?: { price: number; qty: number } }[],
        maxQty: 1,
        mid: null as number | null,
        spread: null as number | null,
      }
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
        L2 · live · {book.bids.length}+{book.asks.length} levels
      </div>
    </div>
  )
}
