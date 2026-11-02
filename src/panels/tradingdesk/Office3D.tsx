/**
 * 3D trading office — isometric floor, readable monitors, drag/zoom explore.
 */

import { useEffect, useRef, type MutableRefObject } from 'react'
import type { AutonomyAgent, DeskSlot } from './autonomy'

type Props = {
  slots: DeskSlot[]
  agentsLiveRef: MutableRefObject<AutonomyAgent[]>
  agents: AutonomyAgent[]
  selectedSlotId: string | null
  onSelectSlot: (id: string) => void
}

type Cam = { ox: number; oy: number; scale: number }

const FLOOR_MIN = -5.5
const FLOOR_MAX = 5.5

function clampFloor(v: number) {
  return Math.max(FLOOR_MIN, Math.min(FLOOR_MAX, v))
}

function project(x: number, y: number, z: number, w: number, h: number, cam: Cam) {
  const isoX = (x - z) * cam.scale
  const isoY = (x + z) * (cam.scale * 0.5) - y * (cam.scale * 1.25)
  return {
    sx: w * 0.5 + cam.ox + isoX,
    sy: h * 0.42 + cam.oy + isoY,
    depth: x + z + y * 0.02,
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
  h: number,
  cam: Cam
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
  ].map(([a, b, c]) => project(a!, b!, c!, w, h, cam))

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
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  face([3, 2, 6, 7], 0.55)
  face([0, 3, 7, 4], 0.72)
  face([1, 2, 6, 5], 0.88)
  face([4, 5, 6, 7], 1.08)
}

function drawCarpet(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam) {
  const corners = [
    project(FLOOR_MIN, 0, FLOOR_MIN, w, h, cam),
    project(FLOOR_MAX, 0, FLOOR_MIN, w, h, cam),
    project(FLOOR_MAX, 0, FLOOR_MAX, w, h, cam),
    project(FLOOR_MIN, 0, FLOOR_MAX, w, h, cam),
  ]
  ctx.beginPath()
  corners.forEach((c, i) => (i === 0 ? ctx.moveTo(c.sx, c.sy) : ctx.lineTo(c.sx, c.sy)))
  ctx.closePath()
  ctx.fillStyle = '#2f3b36'
  ctx.fill()
  ctx.strokeStyle = '#1a2220'
  ctx.lineWidth = 2
  ctx.stroke()

  const rug = [
    project(-2.2, 0.02, -1.5, w, h, cam),
    project(2.2, 0.02, -1.5, w, h, cam),
    project(2.2, 0.02, 2.2, w, h, cam),
    project(-2.2, 0.02, 2.2, w, h, cam),
  ]
  ctx.beginPath()
  rug.forEach((c, i) => (i === 0 ? ctx.moveTo(c.sx, c.sy) : ctx.lineTo(c.sx, c.sy)))
  ctx.closePath()
  ctx.fillStyle = '#6E1423'
  ctx.globalAlpha = 0.35
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawMonitor(
  ctx: CanvasRenderingContext2D,
  x: number,
  z: number,
  ag: AutonomyAgent | undefined,
  w: number,
  h: number,
  cam: Cam
) {
  drawBox(ctx, x - 0.28, 0.55, z - 0.28, 0.56, 0.48, 0.1, '#151515', w, h, cam)
  const scr = project(x, 0.82, z - 0.22, w, h, cam)
  const bw = Math.max(36, cam.scale * 1.7)
  const bh = Math.max(22, cam.scale * 1.05)

  let bg = '#0d1a18'
  let fg = '#5e8f7a'
  let line1 = 'idle'
  let line2 = ''

  if (ag) {
    line1 = (ag.asset || '—').slice(0, 10)
    if (ag.activity === 'researching') {
      bg = '#0a1f18'
      fg = '#0ecb81'
      line2 = (ag.screenLine || 'scan…').slice(0, 14)
    } else if (ag.activity === 'strategizing') {
      bg =
        ag.bias === 'bullish' ? '#0a2018' : ag.bias === 'bearish' ? '#20100e' : '#1a180a'
      fg =
        ag.bias === 'bullish' ? '#0ecb81' : ag.bias === 'bearish' ? '#f6465d' : '#F4D35E'
      line2 = (ag.screenLine || ag.strategyNote || 'probe').slice(0, 14)
    } else if (ag.activity === 'reporting') {
      bg = '#1a1520'
      fg = '#F4D35E'
      line2 = 'report → boss'
    } else if (ag.activity === 'walking') {
      bg = '#121818'
      fg = '#848e9c'
      line2 = 'moving…'
    } else {
      line2 = (ag.screenLine || 'desk').slice(0, 14)
    }
  }

  ctx.fillStyle = bg
  ctx.fillRect(scr.sx - bw / 2, scr.sy - bh / 2, bw, bh)
  ctx.strokeStyle = '#000'
  ctx.strokeRect(scr.sx - bw / 2, scr.sy - bh / 2, bw, bh)

  if (ag && (ag.activity === 'researching' || ag.activity === 'strategizing')) {
    ctx.beginPath()
    const baseY = scr.sy + 2
    ctx.moveTo(scr.sx - bw / 2 + 3, baseY)
    for (let i = 1; i < 8; i++) {
      const t = i / 7
      const wave =
        Math.sin(Date.now() / 280 + i * 0.9 + (ag.x || 0)) *
        (ag.bias === 'bearish' ? -6 : 6)
      ctx.lineTo(scr.sx - bw / 2 + 3 + t * (bw - 6), baseY - wave - t * 4)
    }
    ctx.strokeStyle = fg
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  ctx.fillStyle = fg
  ctx.font = `bold ${Math.max(8, Math.round(cam.scale * 0.42))}px monospace`
  ctx.fillText(line1, scr.sx - bw / 2 + 3, scr.sy - bh / 2 + 11)
  ctx.font = `${Math.max(7, Math.round(cam.scale * 0.36))}px monospace`
  ctx.fillStyle = '#c8cdd3'
  ctx.fillText(line2, scr.sx - bw / 2 + 3, scr.sy - bh / 2 + 21)
}

function paintScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  slots: DeskSlot[],
  agents: AutonomyAgent[],
  selectedSlotId: string | null,
  cam: Cam
) {
  ctx.fillStyle = '#0e1412'
  ctx.fillRect(0, 0, w, h)

  drawCarpet(ctx, w, h, cam)

  drawBox(ctx, -2.2, 0, 4.6, 4.4, 1.9, 0.2, '#3a2a40', w, h, cam)
  {
    const p = project(0, 1.2, 4.5, w, h, cam)
    ctx.fillStyle = '#F4D35E'
    ctx.font = `bold ${Math.max(10, Math.round(cam.scale * 0.5))}px monospace`
    ctx.fillText('RESEARCH', p.sx - 32, p.sy)
  }

  drawBox(ctx, 4.4, 0, -2.8, 0.2, 1.8, 3.2, '#243044', w, h, cam)
  {
    const p = project(4.5, 1.1, -1.2, w, h, cam)
    ctx.fillStyle = '#6ea8fe'
    ctx.font = `bold ${Math.max(9, Math.round(cam.scale * 0.45))}px monospace`
    ctx.fillText('STRAT', p.sx - 14, p.sy)
  }

  const sortedSlots = [...slots].sort((a, b) => a.homeX + a.homeZ - (b.homeX + b.homeZ))
  for (const slot of sortedSlots) {
    const x = clampFloor(slot.homeX)
    const z = clampFloor(slot.homeZ)
    if (slot.isBoss) {
      drawBox(ctx, x - 1.15, 0, z - 1.0, 0.1, 1.7, 1.8, '#6E1423', w, h, cam)
      drawBox(ctx, x + 1.0, 0, z - 1.0, 0.1, 1.7, 1.8, '#6E1423', w, h, cam)
    }
    drawBox(ctx, x - 0.6, 0.05, z - 0.38, 1.2, 0.48, 0.78, '#6b5230', w, h, cam)
    const ag = agents.find((a) => a.slotId === slot.id)
    drawMonitor(ctx, x, z, ag, w, h, cam)

    const plate = project(x, 0.58, z + 0.5, w, h, cam)
    ctx.fillStyle = selectedSlotId === slot.id ? '#F4D35E' : '#eaecef'
    ctx.font = `bold ${Math.max(9, Math.round(cam.scale * 0.42))}px monospace`
    ctx.fillText(slot.name, plate.sx - 16, plate.sy)
    ctx.fillStyle = '#8b949e'
    ctx.font = `${Math.max(8, Math.round(cam.scale * 0.36))}px monospace`
    ctx.fillText(slot.role, plate.sx - 16, plate.sy + 11)
  }

  const sortedAg = [...agents].sort((a, b) => a.x + a.z - (b.x + b.z))
  for (const ag of sortedAg) {
    const ax = clampFloor(ag.x)
    const az = clampFloor(ag.z)
    const bob = ag.activity === 'walking' ? Math.sin(Date.now() / 140) * 0.04 : 0
    const y = 0.06 + bob
    drawBox(ctx, ax - 0.14, y, az - 0.11, 0.28, 0.58, 0.22, ag.color || '#888', w, h, cam)
    drawBox(ctx, ax - 0.11, y + 0.58, az - 0.09, 0.22, 0.22, 0.18, '#e8c4a0', w, h, cam)
    const p = project(ax, y + 1.05, az, w, h, cam)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    const label = `${ag.asset}`
    ctx.font = '8px monospace'
    const tw = ctx.measureText(label).width + 6
    ctx.fillRect(p.sx - tw / 2, p.sy - 14, tw, 11)
    ctx.fillStyle = '#F4D35E'
    ctx.fillText(label, p.sx - tw / 2 + 3, p.sy - 6)
  }

  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(8, h - 22, 210, 16)
  ctx.fillStyle = '#848e9c'
  ctx.font = '9px monospace'
  ctx.fillText('drag = pan · wheel = zoom · click desk', 12, h - 11)
}

export function Office3D({
  slots,
  agentsLiveRef,
  selectedSlotId,
  onSelectSlot,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef(slots)
  const selRef = useRef(selectedSlotId)
  const clickRef = useRef(onSelectSlot)
  const camRef = useRef<Cam>({ ox: 0, oy: 0, scale: 26 })
  slotsRef.current = slots
  selRef.current = selectedSlotId
  clickRef.current = onSelectSlot

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = wrapRef.current
    if (!canvas || !parent) return

    let raf = 0
    let running = true
    let dragging = false
    let lastX = 0
    let lastY = 0

    const resize = () => {
      const r = parent.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = Math.max(280, r.width || 400)
      const cssH = Math.max(220, r.height || 280)
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
              ? agentsLiveRef.current.map((a) => ({
                  ...a,
                  x: clampFloor(a.x),
                  z: clampFloor(a.z),
                }))
              : []
          paintScene(
            ctx,
            canvas.width,
            canvas.height,
            slotsRef.current,
            live,
            selRef.current,
            camRef.current
          )
        }
      } catch {
        /* keep panel alive */
      }
      raf = requestAnimationFrame(paint)
    }
    raf = requestAnimationFrame(paint)

    const onDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      camRef.current.ox += (e.clientX - lastX) * dpr
      camRef.current.oy += (e.clientY - lastY) * dpr
      lastX = e.clientX
      lastY = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* */
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const next = camRef.current.scale * (e.deltaY > 0 ? 0.92 : 1.08)
      camRef.current.scale = Math.max(14, Math.min(48, next))
    }
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / Math.max(1, rect.width)
      const scaleY = canvas.height / Math.max(1, rect.height)
      const mx = (e.clientX - rect.left) * scaleX
      const my = (e.clientY - rect.top) * scaleY
      const cam = camRef.current
      let best: { id: string; d: number } | null = null
      for (const s of slotsRef.current) {
        const p = project(s.homeX, 0.5, s.homeZ, canvas.width, canvas.height, cam)
        const d = (p.sx - mx) ** 2 + (p.sy - my) ** 2
        if (!best || d < best.d) best = { id: s.id, d }
      }
      if (best && best.d < 70 * 70) clickRef.current(best.id)
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('click', onClick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('click', onClick)
    }
  }, [agentsLiveRef])

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%',
        height: 300,
        minHeight: 240,
        background: '#0e1412',
        boxShadow: 'inset 0 0 0 2px #1a1a1a',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grab',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          background: '#0e1412',
          touchAction: 'none',
        }}
      />
    </div>
  )
}
