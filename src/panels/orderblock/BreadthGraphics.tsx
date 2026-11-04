/**
 * X-Ray breadth graphics — sector strip, rank bars, multi-line flow.
 * Style aligned to institutional terminal reference.
 */
import { useEffect, useRef } from 'react'
import type { RankedAsset } from './types'

function fmtPct(n: number) {
  const s = n >= 0 ? '+' : ''
  return `${s}${n.toFixed(2)}%`
}

export function SectorStrip({
  assets,
  leading,
  lagging,
}: {
  assets: RankedAsset[]
  leading: string | null
  lagging: string | null
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c || !assets.length) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth || 360
    const h = c.clientHeight || 72
    c.width = Math.floor(w * dpr)
    c.height = Math.floor(h * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#06090d'
    ctx.fillRect(0, 0, w, h)

    const midY = h * 0.55
    const railGrad = ctx.createLinearGradient(12, 0, w - 12, 0)
    railGrad.addColorStop(0, 'rgba(246,70,93,0.55)')
    railGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)')
    railGrad.addColorStop(1, 'rgba(14,203,129,0.55)')
    ctx.strokeStyle = railGrad
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(16, midY)
    ctx.lineTo(w - 16, midY)
    ctx.stroke()

    const glow = ctx.createLinearGradient(12, 0, w - 12, 0)
    glow.addColorStop(0, 'rgba(246,70,93,0.08)')
    glow.addColorStop(0.5, 'transparent')
    glow.addColorStop(1, 'rgba(14,203,129,0.08)')
    ctx.fillStyle = glow
    ctx.fillRect(16, midY - 14, w - 32, 28)

    const sorted = [...assets].sort((a, b) => a.changePct - b.changePct)
    const maxAbs = Math.max(1.5, ...sorted.map((a) => Math.abs(a.changePct)))

    sorted.forEach((a, i) => {
      const t = i / Math.max(1, sorted.length - 1)
      const x = 20 + t * (w - 40)
      const y = midY - (a.changePct / maxAbs) * 10
      const r = a.isPick ? 5.5 : 2.2 + Math.min(2.5, a.absStrength * 2.5)
      const up = a.changePct >= 0

      if (a.isPick) {
        ctx.shadowColor = up ? '#0ecb81' : '#f6465d'
        ctx.shadowBlur = 10
      }
      ctx.beginPath()
      ctx.fillStyle = up ? '#0ecb81' : '#f6465d'
      ctx.globalAlpha = a.isPick ? 1 : 0.55 + a.absStrength * 0.35
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0

      if (a.isPick) {
        ctx.strokeStyle = '#F4D35E'
        ctx.lineWidth = 1.4
        ctx.stroke()
      }
    })

    ctx.fillStyle = '#f6465d'
    ctx.beginPath()
    ctx.arc(16, midY, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0ecb81'
    ctx.beginPath()
    ctx.arc(w - 16, midY, 4, 0, Math.PI * 2)
    ctx.fill()
  }, [assets])

  return (
    <div className="rounded-xl border border-[#1a2230] overflow-hidden" style={{ background: '#06090d' }}>
      <div className="flex items-center justify-between px-3 pt-2 text-[9px] font-mono tracking-wide">
        <span>
          <span className="text-[#5e6673]">LAGGING SECTOR </span>
          <span className="text-[#f6465d] font-bold">{lagging ?? '—'}</span>
        </span>
        <span>
          <span className="text-[#5e6673]">LEADING SECTOR </span>
          <span className="text-[#0ecb81] font-bold">{leading ?? '—'}</span>
        </span>
      </div>
      <canvas ref={ref} className="w-full h-[72px]" />
    </div>
  )
}

export function SectorRankList({
  sectors,
}: {
  sectors: { sector: string; changePct: number; bullish: number; bearish: number }[]
}) {
  const maxAbs = Math.max(0.5, ...sectors.map((s) => Math.abs(s.changePct)))
  return (
    <div
      className="rounded-xl border border-[#1a2230] p-2 space-y-1 min-h-0 overflow-y-auto"
      style={{ background: '#080c12' }}
    >
      {sectors.map((s) => {
        const up = s.changePct >= 0
        const w = Math.min(100, (Math.abs(s.changePct) / maxAbs) * 100)
        return (
          <div key={s.sector} className="flex items-center gap-2 py-0.5">
            <span
              className="w-[72px] shrink-0 text-[10px] font-bold tracking-wide truncate"
              style={{ color: up ? '#0ecb81' : '#f6465d' }}
            >
              {s.sector.toUpperCase()}
            </span>
            <div className="flex-1 h-[8px] rounded-sm bg-[#121820] overflow-hidden relative">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${w}%`,
                  background: up
                    ? 'linear-gradient(90deg,#0a3d2c,#0ecb81)'
                    : 'linear-gradient(90deg,#4a1520,#f6465d)',
                  boxShadow: up
                    ? '0 0 8px rgba(14,203,129,0.35)'
                    : '0 0 8px rgba(246,70,93,0.35)',
                }}
              />
            </div>
            <span
              className="w-[52px] text-right text-[10px] font-mono font-bold"
              style={{ color: up ? '#0ecb81' : '#f6465d' }}
            >
              {fmtPct(s.changePct)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function SectorFlowChart({
  sectors,
}: {
  sectors: { sector: string; changePct: number }[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c || !sectors.length) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth || 280
    const h = c.clientHeight || 200
    c.width = Math.floor(w * dpr)
    c.height = Math.floor(h * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#06090d'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(14,203,129,0.06)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 8; i++) {
      const y = (h * i) / 8
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    for (let i = 0; i <= 10; i++) {
      const x = (w * i) / 10
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }

    const mid = h * 0.55
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(0, mid)
    ctx.lineTo(w, mid)
    ctx.stroke()
    ctx.setLineDash([])

    const maxAbs = Math.max(1, ...sectors.map((s) => Math.abs(s.changePct)))
    const pts = 48
    const top = [...sectors].sort((a, b) => b.changePct - a.changePct).slice(0, 8)

    top.forEach((s, si) => {
      const up = s.changePct >= 0
      const seed = s.sector.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) + si * 17
      const endY = mid - (s.changePct / maxAbs) * (h * 0.38)

      ctx.beginPath()
      for (let i = 0; i < pts; i++) {
        const t = i / (pts - 1)
        const x = 8 + t * (w - 16)
        const wave =
          Math.sin(t * 6 + seed) * (h * 0.04) * (1 - t) +
          Math.sin(t * 13 + seed * 0.3) * (h * 0.02) * (1 - t * 0.7)
        const y = mid + (endY - mid) * (t * t) + wave
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      const alpha = 0.35 + (1 - si / top.length) * 0.55
      ctx.strokeStyle = up ? `rgba(14,203,129,${alpha})` : `rgba(246,70,93,${alpha})`
      ctx.lineWidth = si === 0 ? 2.2 : 1.3
      ctx.stroke()

      ctx.beginPath()
      ctx.fillStyle = up ? '#0ecb81' : '#f6465d'
      ctx.shadowColor = up ? '#0ecb81' : '#f6465d'
      ctx.shadowBlur = 6
      ctx.arc(w - 8, endY, si === 0 ? 3.5 : 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    })

    ctx.strokeStyle = 'rgba(14,203,129,0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(w * 0.72, 8, w * 0.26, h - 16)
  }, [sectors])

  return (
    <canvas
      ref={ref}
      className="w-full h-full min-h-[180px] rounded-xl border border-[#1a2230]"
      style={{ background: '#06090d' }}
    />
  )
}
