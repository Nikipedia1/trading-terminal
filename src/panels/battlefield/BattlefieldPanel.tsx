/**
 * Battlefield panel — Depth Chart (cumulative) + advancement bar.
 * 3D Arena in follow-up modules.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'

function sumNotional(
  levels: { price: number; qty: number }[] | undefined,
  n: number
): number {
  if (!levels?.length) return 0
  let s = 0
  for (let i = 0; i < Math.min(n, levels.length); i++) {
    s += levels[i]!.price * levels[i]!.qty
  }
  return s
}

function fmtM(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function DepthChart2D({
  bids,
  asks,
  midPrice,
}: {
  bids: { price: number; qty: number }[]
  asks: { price: number; qty: number }[]
  midPrice: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const parent = c.parentElement
    if (!parent) return

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cssW = parent.clientWidth || 640
      const cssH = parent.clientHeight || 320
      if (cssW < 2 || cssH < 2) return
      c.width = Math.floor(cssW * dpr)
      c.height = Math.floor(cssH * dpr)
      c.style.width = `${cssW}px`
      c.style.height = `${cssH}px`
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const W = cssW
      const H = cssH
      const padL = 44
      const padR = 12
      const padT = 32
      const padB = 28
      const plotW = W - padL - padR
      const plotH = H - padT - padB

      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, W, H)

      const n = Math.min(40, Math.max(bids.length, asks.length))
      if (n < 1) {
        ctx.fillStyle = '#5e6673'
        ctx.font = '12px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('Waiting for order book…', W / 2, H / 2)
        return
      }

      const bidLevels = bids.slice(0, n)
      const askLevels = asks.slice(0, n)
      let cumB = 0
      const bidCum: { price: number; cum: number }[] = []
      for (const l of bidLevels) {
        cumB += l.qty
        bidCum.push({ price: l.price, cum: cumB })
      }
      let cumA = 0
      const askCum: { price: number; cum: number }[] = []
      for (const l of askLevels) {
        cumA += l.qty
        askCum.push({ price: l.price, cum: cumA })
      }

      const maxCum = Math.max(cumB, cumA, 1e-9)
      const prices = [...bidCum.map((x) => x.price), ...askCum.map((x) => x.price)]
      const minP = Math.min(...prices)
      const maxP = Math.max(...prices)
      const mid =
        midPrice > 0
          ? midPrice
          : bidLevels[0] && askLevels[0]
            ? (bidLevels[0].price + askLevels[0].price) / 2
            : (minP + maxP) / 2
      const span = Math.max(mid - minP, maxP - mid, 1e-8)
      const xMin = mid - span * 1.05
      const xMax = mid + span * 1.05

      const xOf = (p: number) => padL + ((p - xMin) / (xMax - xMin)) * plotW
      const yOf = (cum: number) => padT + plotH - (cum / maxCum) * plotH

      ctx.strokeStyle = 'rgba(43,49,57,0.55)'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = padT + (plotH * i) / 4
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(padL + plotW, y)
        ctx.stroke()
      }

      if (bidCum.length) {
        const rev = [...bidCum].reverse()
        ctx.beginPath()
        ctx.moveTo(xOf(xMin), yOf(0))
        ctx.lineTo(xOf(xMin), yOf(rev[0]!.cum))
        for (const pt of rev) ctx.lineTo(xOf(pt.price), yOf(pt.cum))
        ctx.lineTo(xOf(mid), yOf(0))
        ctx.closePath()
        const g = ctx.createLinearGradient(0, padT, 0, padT + plotH)
        g.addColorStop(0, 'rgba(14, 203, 129, 0.55)')
        g.addColorStop(1, 'rgba(14, 203, 129, 0.12)')
        ctx.fillStyle = g
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(xOf(xMin), yOf(rev[0]!.cum))
        for (const pt of rev) ctx.lineTo(xOf(pt.price), yOf(pt.cum))
        ctx.lineTo(xOf(mid), yOf(0))
        ctx.strokeStyle = '#0ecb81'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      if (askCum.length) {
        const last = askCum[askCum.length - 1]!
        ctx.beginPath()
        ctx.moveTo(xOf(mid), yOf(0))
        for (const pt of askCum) ctx.lineTo(xOf(pt.price), yOf(pt.cum))
        ctx.lineTo(xOf(xMax), yOf(last.cum))
        ctx.lineTo(xOf(xMax), yOf(0))
        ctx.closePath()
        const g = ctx.createLinearGradient(0, padT, 0, padT + plotH)
        g.addColorStop(0, 'rgba(246, 70, 93, 0.55)')
        g.addColorStop(1, 'rgba(246, 70, 93, 0.12)')
        ctx.fillStyle = g
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(xOf(mid), yOf(0))
        for (const pt of askCum) ctx.lineTo(xOf(pt.price), yOf(pt.cum))
        ctx.lineTo(xOf(xMax), yOf(last.cum))
        ctx.strokeStyle = '#f6465d'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      const mx = xOf(mid)
      ctx.beginPath()
      ctx.moveTo(mx, padT)
      ctx.lineTo(mx, padT + plotH)
      ctx.strokeStyle = 'rgba(240, 185, 11, 0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      const midLabel =
        mid >= 1000 ? mid.toFixed(2) : mid >= 1 ? mid.toFixed(4) : mid.toPrecision(4)
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'center'
      const tw = ctx.measureText(midLabel).width
      ctx.fillStyle = 'rgba(11, 14, 17, 0.85)'
      ctx.fillRect(mx - tw / 2 - 8, 6, tw + 16, 18)
      ctx.strokeStyle = 'rgba(240, 185, 11, 0.4)'
      ctx.strokeRect(mx - tw / 2 - 8, 6, tw + 16, 18)
      ctx.fillStyle = '#eaecef'
      ctx.fillText(midLabel, mx, 19)
      ctx.font = '9px monospace'
      ctx.fillStyle = '#848e9c'
      ctx.fillText('Mid Market Price', mx, padT - 4)

      ctx.font = '9px monospace'
      ctx.fillStyle = '#5e6673'
      ctx.textAlign = 'left'
      ctx.fillText(xMin >= 1000 ? xMin.toFixed(0) : xMin.toFixed(2), padL, H - 8)
      ctx.textAlign = 'right'
      ctx.fillText(xMax >= 1000 ? xMax.toFixed(0) : xMax.toFixed(2), padL + plotW, H - 8)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#0ecb81'
      ctx.fillText(`Σ bid ${cumB.toFixed(cumB >= 10 ? 1 : 3)}`, padL, padT + 12)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#f6465d'
      ctx.fillText(`Σ ask ${cumA.toFixed(cumA >= 10 ? 1 : 3)}`, padL + plotW, padT + 12)

      ctx.fillStyle = '#5e6673'
      ctx.textAlign = 'right'
      ctx.font = '8px monospace'
      for (let i = 0; i <= 4; i++) {
        const v = (maxCum * (4 - i)) / 4
        const y = padT + (plotH * i) / 4
        ctx.fillText(v >= 100 ? v.toFixed(0) : v.toFixed(2), padL - 4, y + 3)
      }
    }

    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(parent)
    return () => ro.disconnect()
  }, [bids, asks, midPrice])

  return <canvas ref={canvasRef} className="w-full h-full block" style={{ minHeight: 200 }} />
}

export function BattlefieldPanel() {
  const orderBook = useMarketStore((s) => s.orderBook)
  const trades = useMarketStore((s) => s.trades)
  const ticker = useMarketStore((s) => s.ticker)
  const symbol = useMarketStore((s) => s.symbol)

  const feedRef = useRef<{ id: string; text: string; side: 'bull' | 'bear' | 'liq' }[]>([])
  const lastTradeId = useRef('')
  const [feedTick, setFeedTick] = useState(0)

  const walls = useMemo(() => {
    const buy = sumNotional(orderBook?.bids, 25)
    const sell = sumNotional(orderBook?.asks, 25)
    return { buy, sell }
  }, [orderBook])

  const imbalance =
    walls.buy + walls.sell > 0 ? (walls.buy - walls.sell) / (walls.buy + walls.sell) : 0
  const bullStrength = Math.max(0, Math.min(1, 0.5 + imbalance / 2))
  const contested =
    imbalance > 0.12 ? 'BULLS ADVANCING' : imbalance < -0.12 ? 'BEARS ADVANCING' : 'CONTESTED'
  const contestedCls =
    imbalance > 0.12
      ? 'border-[#0ecb81]/50 text-[#0ecb81] bg-[#0ecb81]/10'
      : imbalance < -0.12
        ? 'border-[#f6465d]/50 text-[#f6465d] bg-[#f6465d]/10'
        : 'border-[#f0b90b]/40 text-[#f0b90b] bg-transparent'

  const price = ticker?.lastPrice ?? orderBook?.bids?.[0]?.price ?? 0
  const chg = ticker?.priceChangePercent ?? 0
  const midPrice =
    ticker?.lastPrice ??
    (orderBook?.bids?.[0] && orderBook?.asks?.[0]
      ? (orderBook.bids[0].price + orderBook.asks[0].price) / 2
      : price)

  useEffect(() => {
    if (!trades.length) return
    for (const tr of trades.slice(0, 16)) {
      if (tr.id === lastTradeId.current) break
      const notional = tr.price * tr.qty
      if (notional < 8_000) continue
      const bull = !tr.isBuyerMaker
      const kind = notional > 250_000 ? 'HEAVY' : notional > 50_000 ? 'TANK' : 'INFANTRY'
      feedRef.current = [
        {
          id: `${tr.id}-${Date.now()}`,
          text: `${bull ? 'BULL' : 'BEAR'} ${kind} · $${(notional / 1000).toFixed(1)}k @ ${tr.price.toFixed(2)}`,
          side: bull ? 'bull' : 'bear',
        },
        ...feedRef.current,
      ].slice(0, 24)
      setFeedTick((t) => t + 1)
    }
    if (trades[0]) lastTradeId.current = trades[0].id
  }, [trades])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#040608] text-[#eaecef] select-none">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2 border-b border-[#1e2a22] shrink-0 bg-[#0a0f0c]/95">
        <div>
          <div className="text-[9px] text-[#5e6673] uppercase tracking-wider">
            {symbol} · Battlefield
          </div>
          <div className="text-lg font-mono font-bold tabular-nums">
            {price
              ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              : '—'}
          </div>
        </div>
        <div className={`text-[11px] font-mono ${chg >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
          {chg >= 0 ? '+' : ''}
          {chg.toFixed(2)}%
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          <div className="text-right">
            <div className="text-[9px] text-[#f6465d] uppercase">Sell wall</div>
            <div className="font-mono font-semibold text-[#f6465d]">{fmtM(walls.sell)}</div>
          </div>
          <div className={`px-2 py-0.5 rounded border text-[10px] font-semibold tracking-wide ${contestedCls}`}>
            {contested}
          </div>
          <div className="text-left">
            <div className="text-[9px] text-[#0ecb81] uppercase">Buy wall</div>
            <div className="font-mono font-semibold text-[#0ecb81]">{fmtM(walls.buy)}</div>
          </div>
        </div>
      </div>

      <div className="px-3 py-1.5 border-b border-[#1e2a22] shrink-0 bg-[#080b09]">
        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider mb-1">
          <span className="text-[#0ecb81]">Bulls {(bullStrength * 100).toFixed(0)}%</span>
          <span className="text-[#848e9c]">Front line</span>
          <span className="text-[#f6465d]">Bears {((1 - bullStrength) * 100).toFixed(0)}%</span>
        </div>
        <div className="relative h-2.5 rounded-full overflow-hidden bg-[#1e2329] border border-[#2b3139]">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#0ecb81] to-[#0a8f5a] transition-all duration-500 ease-out"
            style={{ width: `${bullStrength * 100}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-[#f6465d] to-[#a83242] transition-all duration-500 ease-out"
            style={{ width: `${(1 - bullStrength) * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1 h-4 rounded-sm bg-[#f0b90b] shadow-[0_0_8px_#f0b90b] transition-all duration-500 ease-out z-10"
            style={{ left: `calc(${bullStrength * 100}% - 2px)` }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-[220px] relative">
        <DepthChart2D
          bids={(orderBook?.bids ?? []).slice(0, 40)}
          asks={(orderBook?.asks ?? []).slice(0, 40)}
          midPrice={midPrice}
        />
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 text-[9px] font-mono pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40">
            ● GREEN = cumulative bids
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/40">
            ● RED = cumulative asks
          </span>
        </div>
      </div>

      <div className="border-t border-[#1e2a22] shrink-0 max-h-[110px] overflow-y-auto p-2 text-[10px] font-mono bg-[#080b09]">
        <div className="text-[9px] text-[#5e6673] uppercase mb-1">Combat feed · LIVE</div>
        {feedTick >= 0 && feedRef.current.length === 0 ? (
          <div className="text-[#5e6673]">Waiting for large tape hits — Start Live…</div>
        ) : (
          feedRef.current.slice(0, 10).map((f) => (
            <div
              key={f.id}
              className={
                f.side === 'bull'
                  ? 'text-[#0ecb81] py-0.5'
                  : f.side === 'bear'
                    ? 'text-[#f6465d] py-0.5'
                    : 'text-[#f0b90b] py-0.5'
              }
            >
              ● {f.text}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
