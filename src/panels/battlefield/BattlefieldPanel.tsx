/**
 * BTC Battlefield — order-book walls + bull/bear units on isometric terrain.
 * Driven by live orderBook + trades from marketStore (no mock market data).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMarketStore } from '@/stores/marketStore'

interface Unit {
  id: number
  side: 'bull' | 'bear'
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  size: number
  kind: 'infantry' | 'tank' | 'heavy'
  age: number
}

interface Explosion {
  x: number
  y: number
  t: number
  r: number
}

interface FeedItem {
  id: string
  text: string
  side: 'bull' | 'bear' | 'liq'
  time: number
}

function sumNotional(levels: { price: number; qty: number }[], n: number): number {
  let s = 0
  for (let i = 0; i < Math.min(n, levels.length); i++) {
    s += levels[i].price * levels[i].qty
  }
  return s
}

function isoProject(x: number, y: number, z: number, w: number, h: number) {
  const sx = (x - y) * 0.866
  const sy = (x + y) * 0.5 - z
  return {
    px: w * 0.5 + sx * (w * 0.038),
    py: h * 0.62 + sy * (h * 0.028),
  }
}

function terrainHeight(
  x: number,
  y: number,
  midX: number,
  sellStrength: number,
  buyStrength: number
): number {
  const distSide = Math.abs(x - midX)
  const wall = x < midX ? sellStrength : buyStrength
  const ridge = Math.max(0, (distSide - 2) / 10)
  const noise =
    Math.sin(x * 0.7 + y * 0.4) * 0.35 + Math.sin(x * 1.3 - y * 0.9) * 0.2
  return ridge * wall * 4.5 + noise * 0.4
}

export function BattlefieldPanel() {
  const orderBook = useMarketStore((s) => s.orderBook)
  const trades = useMarketStore((s) => s.trades)
  const ticker = useMarketStore((s) => s.ticker)
  const symbol = useMarketStore((s) => s.symbol)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const unitsRef = useRef<Unit[]>([])
  const explRef = useRef<Explosion[]>([])
  const feedRef = useRef<FeedItem[]>([])
  const lastTradeId = useRef<string>('')
  const uid = useRef(1)
  const [feedTick, setFeedTick] = useState(0)

  const walls = useMemo(() => {
    const bids = orderBook?.bids ?? []
    const asks = orderBook?.asks ?? []
    const buy = sumNotional(bids, 25)
    const sell = sumNotional(asks, 25)
    return { buy, sell, bids, asks }
  }, [orderBook])

  const price = ticker?.lastPrice ?? orderBook?.bids?.[0]?.price ?? 0
  const chg = ticker?.priceChangePercent ?? 0

  useEffect(() => {
    if (!trades.length) return
    const recent = trades.slice(0, 12)
    for (const tr of recent) {
      if (tr.id === lastTradeId.current) break
      const quote = tr.price * tr.qty
      if (quote < 8_000) continue
      const isBuy = !tr.isBuyerMaker
      const side: 'bull' | 'bear' = isBuy ? 'bull' : 'bear'
      const kind: Unit['kind'] =
        quote > 200_000 ? 'heavy' : quote > 50_000 ? 'tank' : 'infantry'
      const size = kind === 'heavy' ? 3.2 : kind === 'tank' ? 2.4 : 1.4
      const baseX = side === 'bull' ? 14 + Math.random() * 4 : 2 + Math.random() * 4
      const baseY = 4 + Math.random() * 10
      unitsRef.current.push({
        id: uid.current++,
        side,
        x: baseX,
        y: baseY,
        vx: side === 'bull' ? -0.04 - Math.random() * 0.03 : 0.04 + Math.random() * 0.03,
        vy: (Math.random() - 0.5) * 0.02,
        hp: kind === 'heavy' ? 5 : kind === 'tank' ? 3 : 1,
        size,
        kind,
        age: 0,
      })
      feedRef.current.unshift({
        id: tr.id + String(Date.now()),
        text: `${kind === 'heavy' ? 'Large' : 'Agg'} ${isBuy ? 'buy' : 'sell'} · $${(quote / 1000).toFixed(1)}K`,
        side,
        time: Date.now(),
      })
      if (feedRef.current.length > 18) feedRef.current.pop()
      if (quote > 100_000) {
        explRef.current.push({
          x: baseX + (side === 'bull' ? -1 : 1),
          y: baseY,
          t: 0,
          r: 1.2,
        })
      }
    }
    lastTradeId.current = recent[0]?.id ?? lastTradeId.current
    setFeedTick((x) => x + 1)
    if (unitsRef.current.length > 80) {
      unitsRef.current = unitsRef.current.slice(-80)
    }
  }, [trades])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const canvas = canvasRef.current
      if (canvas) draw(canvas)
      raf = requestAnimationFrame(loop)
    }

    const draw = (canvas: HTMLCanvasElement) => {
      const parent = canvas.parentElement
      const w = parent?.clientWidth || 800
      const h = Math.max(320, parent?.clientHeight || 420)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#0a1210')
      g.addColorStop(1, '#0d1a12')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      const midX = 10
      const sellS = Math.min(1.4, walls.sell / 80_000_000)
      const buyS = Math.min(1.4, walls.buy / 80_000_000)

      const grid = 20
      for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
          const x0 = gx
          const y0 = gy
          const z00 = terrainHeight(x0, y0, midX, sellS, buyS)
          const z10 = terrainHeight(x0 + 1, y0, midX, sellS, buyS)
          const z01 = terrainHeight(x0, y0 + 1, midX, sellS, buyS)
          const z11 = terrainHeight(x0 + 1, y0 + 1, midX, sellS, buyS)
          const p00 = isoProject(x0, y0, z00, w, h)
          const p10 = isoProject(x0 + 1, y0, z10, w, h)
          const p01 = isoProject(x0, y0 + 1, z01, w, h)
          const p11 = isoProject(x0 + 1, y0 + 1, z11, w, h)
          const onSell = x0 + 0.5 < midX
          const base = onSell ? [34, 72, 48] : [42, 88, 52]
          const shade = 0.85 + (z00 + z11) * 0.04
          ctx.fillStyle = `rgb(${base[0] * shade},${base[1] * shade},${base[2] * shade})`
          ctx.beginPath()
          ctx.moveTo(p00.px, p00.py)
          ctx.lineTo(p10.px, p10.py)
          ctx.lineTo(p11.px, p11.py)
          ctx.lineTo(p01.px, p01.py)
          ctx.closePath()
          ctx.fill()
        }
      }

      ctx.strokeStyle = 'rgba(60,70,55,0.9)'
      ctx.lineWidth = 6
      const roadPts: { px: number; py: number }[] = []
      for (let y = 0; y <= 20; y += 0.5) {
        const z = terrainHeight(midX, y, midX, sellS, buyS) * 0.3
        roadPts.push(isoProject(midX, y, z + 0.05, w, h))
      }
      ctx.beginPath()
      roadPts.forEach((p, i) => (i ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py)))
      ctx.stroke()
      ctx.setLineDash([8, 8])
      ctx.strokeStyle = 'rgba(200,200,180,0.35)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])

      for (let i = 0; i < 40; i++) {
        const tx = (i * 7.3) % 19 + 0.5
        const ty = (i * 3.7) % 18 + 1
        if (Math.abs(tx - midX) < 1.2) continue
        const tz = terrainHeight(tx, ty, midX, sellS, buyS)
        const p = isoProject(tx, ty, tz, w, h)
        ctx.fillStyle = '#1a3d28'
        ctx.beginPath()
        ctx.moveTo(p.px, p.py - 8)
        ctx.lineTo(p.px - 4, p.py)
        ctx.lineTo(p.px + 4, p.py)
        ctx.fill()
      }

      for (const pond of [
        { x: 4, y: 6 },
        { x: 16, y: 12 },
      ]) {
        const z = terrainHeight(pond.x, pond.y, midX, sellS, buyS) * 0.5
        const p = isoProject(pond.x, pond.y, z, w, h)
        ctx.fillStyle = 'rgba(40,90,140,0.55)'
        ctx.beginPath()
        ctx.ellipse(p.px, p.py, 18, 10, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      const units = unitsRef.current
      for (const u of units) {
        u.x += u.vx
        u.y += u.vy
        u.age += 1
        const targetX = midX + (u.side === 'bull' ? -0.8 : 0.8)
        u.vx += (targetX - u.x) * 0.0015
        u.vx *= 0.98
        if (u.y < 1) u.vy = Math.abs(u.vy)
        if (u.y > 18) u.vy = -Math.abs(u.vy)
      }

      for (let i = 0; i < units.length; i++) {
        for (let j = i + 1; j < units.length; j++) {
          const a = units[i]
          const b = units[j]
          if (a.side === b.side) continue
          const dx = a.x - b.x
          const dy = a.y - b.y
          if (dx * dx + dy * dy < 0.55) {
            a.hp -= 0.04
            b.hp -= 0.04
            if (Math.random() < 0.02) {
              explRef.current.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0, r: 0.8 })
            }
          }
        }
      }
      unitsRef.current = units.filter((u) => u.hp > 0 && u.age < 900 && u.x > -2 && u.x < 22)

      for (const u of unitsRef.current) {
        const z = terrainHeight(u.x, u.y, midX, sellS, buyS)
        const p = isoProject(u.x, u.y, z + 0.3, w, h)
        const col = u.side === 'bull' ? '#0ecb81' : '#f6465d'
        ctx.fillStyle = col
        if (u.kind === 'heavy') {
          ctx.fillRect(p.px - 5, p.py - 5, 10, 8)
          ctx.fillStyle = '#111'
          ctx.fillRect(p.px - 2, p.py - 8, 4, 4)
        } else if (u.kind === 'tank') {
          ctx.beginPath()
          ctx.ellipse(p.px, p.py, 6, 4, 0, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(p.px, p.py, 2.5 * u.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      explRef.current = explRef.current
        .map((e) => ({ ...e, t: e.t + 0.05 }))
        .filter((e) => e.t < 1)
      for (const e of explRef.current) {
        const z = terrainHeight(e.x, e.y, midX, sellS, buyS)
        const p = isoProject(e.x, e.y, z, w, h)
        const alpha = 1 - e.t
        ctx.strokeStyle = `rgba(255,180,40,${alpha})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(p.px, p.py, 4 + e.t * 16 * e.r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = `rgba(255,100,20,${alpha * 0.4})`
        ctx.beginPath()
        ctx.arc(p.px, p.py, 2 + e.t * 8, 0, Math.PI * 2)
        ctx.fill()
      }

      const bearL = isoProject(4, 2, terrainHeight(4, 2, midX, sellS, buyS) + 1, w, h)
      const bullL = isoProject(16, 2, terrainHeight(16, 2, midX, sellS, buyS) + 1, w, h)
      ctx.font = 'bold 12px ui-sans-serif, system-ui'
      ctx.fillStyle = '#f6465d'
      ctx.fillText('Bears', bearL.px - 18, bearL.py - 8)
      ctx.fillStyle = '#0ecb81'
      ctx.fillText('Bulls', bullL.px - 14, bullL.py - 8)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [walls.buy, walls.sell])

  const contested =
    walls.buy > 0 && walls.sell > 0
      ? Math.abs(walls.buy - walls.sell) / Math.max(walls.buy, walls.sell) < 0.25
        ? 'Contested'
        : walls.buy > walls.sell
          ? 'Bulls press'
          : 'Bears press'
      : '—'

  const fmtM = (n: number) =>
    n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`

  const depthCanvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = depthCanvasRef.current
    if (!canvas) return
    const w = canvas.parentElement?.clientWidth || 220
    const h = 90
    const dpr = devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0b0e11'
    ctx.fillRect(0, 0, w, h)
    const bids = walls.bids.slice(0, 30)
    const asks = walls.asks.slice(0, 30)
    let cumB = 0
    let cumA = 0
    const maxQ = Math.max(
      bids.reduce((s, l) => s + l.qty, 0),
      asks.reduce((s, l) => s + l.qty, 0),
      1
    )
    const mid = w / 2
    ctx.strokeStyle = '#0ecb81'
    ctx.beginPath()
    bids.forEach((l, i) => {
      cumB += l.qty
      const x = mid - ((i + 1) / 30) * (mid - 8)
      const y = h - 8 - (cumB / maxQ) * (h - 16)
      if (i === 0) ctx.moveTo(mid, h - 8)
      ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.fillStyle = 'rgba(14,203,129,0.15)'
    ctx.lineTo(8, h - 8)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#f6465d'
    ctx.beginPath()
    asks.forEach((l, i) => {
      cumA += l.qty
      const x = mid + ((i + 1) / 30) * (mid - 8)
      const y = h - 8 - (cumA / maxQ) * (h - 16)
      if (i === 0) ctx.moveTo(mid, h - 8)
      ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.fillStyle = '#848e9c'
    ctx.font = '9px monospace'
    ctx.fillText('AGGREGATED SPOT DEPTH', 8, 12)
  }, [walls])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0a0f0c] text-[#eaecef]">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-[#1e2a22] shrink-0">
        <div>
          <div className="text-[9px] text-[#5e6673] uppercase tracking-wider">
            {symbol} · AGGREGATED SPOT
          </div>
          <div className="text-lg font-mono font-bold tabular-nums">
            {price ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
          </div>
        </div>
        <div className={`text-[11px] font-mono ${chg >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
          {chg >= 0 ? '+' : ''}
          {chg.toFixed(2)}%
        </div>
        <div className="ml-auto flex items-center gap-4 text-[11px]">
          <div className="text-right">
            <div className="text-[9px] text-[#f6465d] uppercase">Sell wall</div>
            <div className="font-mono font-semibold text-[#f6465d]">{fmtM(walls.sell)}</div>
          </div>
          <div className="px-2 py-0.5 rounded border border-[#2b3139] text-[#f0b90b] text-[10px] font-semibold">
            {contested}
          </div>
          <div className="text-left">
            <div className="text-[9px] text-[#0ecb81] uppercase">Buy wall</div>
            <div className="font-mono font-semibold text-[#0ecb81]">{fmtM(walls.buy)}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[240px] relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-[#1e2a22] shrink-0 max-h-[140px]">
        <div className="p-2 border-r border-[#1e2a22]">
          <canvas ref={depthCanvasRef} className="w-full block" />
        </div>
        <div className="p-2 overflow-y-auto text-[10px] font-mono">
          <div className="text-[9px] text-[#5e6673] uppercase mb-1">Market feed · LIVE</div>
          {feedTick >= 0 && feedRef.current.length === 0 ? (
            <div className="text-[#5e6673]">Waiting for large trades…</div>
          ) : (
            feedRef.current.slice(0, 8).map((f) => (
              <div
                key={f.id}
                className={`py-0.5 ${
                  f.side === 'bull'
                    ? 'text-[#0ecb81]'
                    : f.side === 'bear'
                      ? 'text-[#f6465d]'
                      : 'text-[#f0b90b]'
                }`}
              >
                ● {f.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
