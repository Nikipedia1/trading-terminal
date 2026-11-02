/**
 * 3D trading office — mount-once canvas; live agent positions via ref (no grey flash).
 */

import { useEffect, useRef, type MutableRefObject } from 'react'
import type { AutonomyAgent, DeskSlot } from './autonomy'

type Props = {
  slots: DeskSlot[]
  /** Live positions — updated every RAF by parent; not React state. */
  agentsLiveRef: MutableRefObject<AutonomyAgent[]>
  /** Snapshot for labels / hire UI (throttled ok). */
  agents: AutonomyAgent[]
  selectedSlotId: string | null
  onSelectSlot: (id: string) => void
}

function project(x: number, y: number, z: number, w: number, h: number) {
  const isoX = (x - z) * 22
  const isoY = (x + z) * 11 - y * 28
  return {
    sx: w * 0.5 + isoX,
    sy: h * 0.38 + isoY,
    depth: x + z + y * 0.01,
  }
}

function shadeColor(hex: string, m: number) {
  const n = (hex || '#888888').replace('#', '')
  const full =
    n.length === 3
      ? n
          .split('')
          .map((c) => c + c)
          .join('')
      : n.padEnd(6, '0').slice(0, 6)
  const v = parseInt(full, 16)
  if (!Number.isFinite(v)) return '#666666'
  const r = Math.min(255, Math.max(0, Math.round(((v >> 16) & 255) * m)))
  const g = Math.min(255, Math.max(0, Math.round(((v >> 8) & 255) * m)))
  const b = Math.min(255, Math.max(0, Math.round((v & 255) * m)))
  return `rgb(${r},${g},${b})`
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: string,
  w: number,
  h: number
) {
  const pts = [
    [x, y, z],
    [x + sx, y, z],
    [x + sx, y, z + sz],
    [x, y, z + sz],
    [x, y + sy, z],
    [x + sx, y + sy, z],
    [x + sx, y + sy, z + sz],
    [x, y + sy, z + sz],
  ].map(([a, b, c]) => project(a!, b!, c!, w, h))

  const face = (idx: number[], mul: number) => {
    ctx.beginPath()
    idx.forEach((i, k) => {
      const c = pts[i]!
      if (k === 0) ctx.moveTo(c.sx, c.sy)
      else ctx.lineTo(c.sx, c.sy)
    })
    ctx.closePath()
    ctx.fillStyle = shadeColor(color, mul)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  face([3, 2, 6, 7], 0.55)
  face([0, 3, 7, 4], 0.72)
  face([1, 2, 6, 5], 0.88)
  face([4, 5, 6, 7], 1.08)
}

function paintScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  slots: DeskSlot[],
  agents: AutonomyAgent[],
  selectedSlotId: string | null
) {
  ctx.fillStyle = '#12181a'
  ctx.fillRect(0, 0, w, h)

  for (let xi = -6; xi <= 6; xi++) {
    for (let zi = -5; zi <= 6; zi++) {
      const c = ((xi + zi) & 1) === 0 ? '#3d4a44' : '#344038'
      drawBox(ctx, xi, 0, zi, 1, 0.06, 1, c, w, h)
    }
  }

  drawBox(ctx, -2.5, 0, 5.5, 5, 2.2, 0.25, '#3a2a40', w, h)
  {
    const p = project(0, 1.4, 5.4, w, h)
    ctx.fillStyle = '#F4D35E'
    ctx.font = `bold ${Math.max(11, Math.round(w / 80))}px monospace`
    ctx.fillText('RESEARCH', p.sx - 36, p.sy)
  }

  drawBox(ctx, 5, 0, -3, 0.25, 2, 3.5, '#243044', w, h)

  const sortedSlots = [...slots].sort((a, b) => a.homeX + a.homeZ - (b.homeX + b.homeZ))
  for (const slot of sortedSlots) {
    const x = slot.homeX
    const z = slot.homeZ
    if (slot.isBoss) {
      drawBox(ctx, x - 1.3, 0, z - 1.1, 0.12, 2, 2, '#6E1423', w, h)
      drawBox(ctx, x + 1.1, 0, z - 1.1, 0.12, 2, 2, '#6E1423', w, h)
    }
    drawBox(ctx, x - 0.65, 0.06, z - 0.4, 1.3, 0.5, 0.85, '#7a5a30', w, h)
    drawBox(ctx, x - 0.32, 0.58, z - 0.32, 0.64, 0.5, 0.12, '#1a1a1a', w, h)

    const ag = agents.find((a) => a.slotId === slot.id)
    const scr = project(x, 0.9, z - 0.25, w, h)
    if (ag) {
      const glow =
        ag.activity === 'researching' || ag.activity === 'strategizing'
          ? ag.bias === 'bullish'
            ? '#0ecb81'
            : ag.bias === 'bearish'
              ? '#f6465d'
              : '#F4D35E'
          : '#1a3030'
      ctx.fillStyle = glow
      ctx.fillRect(scr.sx - 16, scr.sy - 11, 32, 18)
      ctx.fillStyle = '#0b0e11'
      ctx.font = '9px monospace'
      ctx.fillText((ag.screenLine || ag.asset || '...').slice(0, 14), scr.sx - 14, scr.sy + 2)
    }

    const plate = project(x, 0.65, z + 0.55, w, h)
    ctx.fillStyle = selectedSlotId === slot.id ? '#F4D35E' : '#eaecef'
    ctx.font = 'bold 10px monospace'
    ctx.fillText(slot.name, plate.sx - 18, plate.sy)
    ctx.fillStyle = '#9aa3ad'
    ctx.font = '9px monospace'
    ctx.fillText(slot.role, plate.sx - 18, plate.sy + 11)
  }

  const sortedAg = [...agents].sort((a, b) => a.x + a.z - (b.x + b.z))
  for (const ag of sortedAg) {
    const bob = ag.activity === 'walking' ? Math.sin(Date.now() / 140) * 0.05 : 0
    const y = 0.08 + bob
    drawBox(ctx, ag.x - 0.16, y, ag.z - 0.12, 0.32, 0.65, 0.24, ag.color || '#888', w, h)
    drawBox(ctx, ag.x - 0.12, y + 0.65, ag.z - 0.1, 0.24, 0.26, 0.2, '#e8c4a0', w, h)
    const p = project(ag.x, y + 1.15, ag.z, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(p.sx - 24, p.sy - 20, 48, 14)
    ctx.fillStyle = '#F4D35E'
    ctx.font = '9px monospace'
    ctx.fillText(`${ag.asset} ${ag.activity.slice(0, 4)}`, p.sx - 22, p.sy - 10)
  }

  ctx.fillStyle = 'rgba(110,20,35,0.92)'
  ctx.fillRect(0, 0, w, 28)
  ctx.fillStyle = '#F4D35E'
  ctx.font = 'bold 11px monospace'
  ctx.fillText(`3D FLOOR  ·  ${agents.length} agents  ·  ${slots.length} desks`, 12, 18)
}

export function Office3D({
  slots,
  agentsLiveRef,
  agents,
  selectedSlotId,
  onSelectSlot,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef(slots)
  const selRef = useRef(selectedSlotId)
  const clickRef = useRef(onSelectSlot)
  slotsRef.current = slots
  selRef.current = selectedSlotId
  clickRef.current = onSelectSlot

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = wrapRef.current
    if (!canvas || !parent) return

    let raf = 0
    let running = true

    const resize = () => {
      const r = parent.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = Math.max(280, r.width || 400)
      const cssH = Math.max(200, r.height || 260)
      const tw = Math.floor(cssW * dpr)
      const th = Math.floor(cssH * dpr)
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw
        canvas.height = th
      }
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    const paint = () => {
      if (!running) return
      try {
        const ctx = canvas.getContext('2d')
        if (ctx && canvas.width > 8 && canvas.height > 8) {
          const live =
            agentsLiveRef.current && agentsLiveRef.current.length > 0
              ? agentsLiveRef.current
              : []
          paintScene(ctx, canvas.width, canvas.height, slotsRef.current, live, selRef.current)
        }
      } catch {
        /* never blank the panel on draw errors */
      }
      raf = requestAnimationFrame(paint)
    }
    raf = requestAnimationFrame(paint)

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / Math.max(1, rect.width)
      const scaleY = canvas.height / Math.max(1, rect.height)
      const mx = (e.clientX - rect.left) * scaleX
      const my = (e.clientY - rect.top) * scaleY
      let best: { id: string; d: number } | null = null
      for (const s of slotsRef.current) {
        const p = project(s.homeX, 0.5, s.homeZ, canvas.width, canvas.height)
        const d = (p.sx - mx) ** 2 + (p.sy - my) ** 2
        if (!best || d < best.d) best = { id: s.id, d }
      }
      if (best && best.d < 60 * 60) clickRef.current(best.id)
    }
    canvas.addEventListener('click', onClick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
    }
  }, [agentsLiveRef])

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%',
        height: 280,
        minHeight: 220,
        background: '#12181a',
        boxShadow: 'inset 0 0 0 2px #1a1a1a',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', background: '#12181a' }}
      />
    </div>
  )
}
