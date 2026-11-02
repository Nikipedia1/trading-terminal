/**
 * 3D trading office — monitors show real mini candlesticks per agent asset.
 */
import { useEffect, useRef, type MutableRefObject } from 'react'
import type { AutonomyAgent, DeskSlot } from './autonomy'

type MiniBar = { o: number; h: number; l: number; c: number }

type Props = {
  slots: DeskSlot[]
  agentsLiveRef: MutableRefObject<AutonomyAgent[]>
  agents: AutonomyAgent[]
  selectedSlotId: string | null
  onSelectSlot: (id: string) => void
  candleMap?: Record<string, MiniBar[]>
}

type Cam = { ox: number; oy: number; scale: number; yaw: number }

const FMIN = -5.5
const FMAX = 5.5
const clamp = (v: number) => Math.max(FMIN, Math.min(FMAX, v))

function rotXZ(x: number, z: number, yaw: number) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: x * c - z * s, z: x * s + z * c }
}

function project(x: number, y: number, z: number, w: number, h: number, cam: Cam) {
  const r = rotXZ(x, z, cam.yaw)
  const isoX = (r.x - r.z) * cam.scale
  const isoY = (r.x + r.z) * (cam.scale * 0.5) - y * (cam.scale * 1.25)
  return { sx: w * 0.5 + cam.ox + isoX, sy: h * 0.42 + cam.oy + isoY }
}

function shade(hex: string, m: number) {
  const n = (hex || '#888').replace('#', '')
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n.padEnd(6, '0').slice(0, 6)
  const v = parseInt(full, 16)
  if (!Number.isFinite(v)) return '#666'
  const r = Math.min(255, Math.max(0, Math.round(((v >> 16) & 255) * m)))
  const g = Math.min(255, Math.max(0, Math.round(((v >> 8) & 255) * m)))
  const b = Math.min(255, Math.max(0, Math.round((v & 255) * m)))
  return `rgb(${r},${g},${b})`
}

function box(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, z: number,
  sx: number, sy: number, sz: number,
  color: string, w: number, h: number, cam: Cam
) {
  const p = [
    [x, y, z], [x + sx, y, z], [x + sx, y, z + sz], [x, y, z + sz],
    [x, y + sy, z], [x + sx, y + sy, z], [x + sx, y + sy, z + sz], [x, y + sy, z + sz],
  ].map(([a, b, c]) => project(a!, b!, c!, w, h, cam))
  const face = (idx: number[], mul: number) => {
    ctx.beginPath()
    idx.forEach((i, k) => {
      const c = p[i]!
      if (k === 0) ctx.moveTo(c.sx, c.sy)
      else ctx.lineTo(c.sx, c.sy)
    })
    ctx.closePath()
    ctx.fillStyle = shade(color, mul)
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

function drawMiniChart(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  bw: number,
  bh: number,
  bars: MiniBar[] | undefined,
  accent: string
) {
  const pad = 3
  const chartTop = top + 16
  const chartH = Math.max(8, bh - 22)
  const chartLeft = left + pad
  const chartW = bw - pad * 2
  if (!bars || bars.length < 2) {
    ctx.beginPath()
    ctx.moveTo(chartLeft, chartTop + chartH * 0.6)
    for (let i = 1; i < 10; i++) {
      const t = i / 9
      const wave = Math.sin(Date.now() / 400 + i * 0.8) * chartH * 0.25
      ctx.lineTo(chartLeft + t * chartW, chartTop + chartH * 0.55 - wave)
    }
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.2
    ctx.stroke()
    return
  }
  const slice = bars.slice(-14)
  let lo = Infinity
  let hi = -Infinity
  for (const b of slice) {
    if (b.l < lo) lo = b.l
    if (b.h > hi) hi = b.h
  }
  const span = hi - lo || 1
  const gap = chartW / slice.length
  const bodyW = Math.max(1.5, gap * 0.55)
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i]!
    const cx = chartLeft + i * gap + gap * 0.5
    const yH = chartTop + ((hi - b.h) / span) * chartH
    const yL = chartTop + ((hi - b.l) / span) * chartH
    const yO = chartTop + ((hi - b.o) / span) * chartH
    const yC = chartTop + ((hi - b.c) / span) * chartH
    const up = b.c >= b.o
    const col = up ? '#0ecb81' : '#f6465d'
    ctx.strokeStyle = col
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, yH)
    ctx.lineTo(cx, yL)
    ctx.stroke()
    const topB = Math.min(yO, yC)
    const hB = Math.max(1, Math.abs(yC - yO))
    ctx.fillStyle = col
    ctx.fillRect(cx - bodyW / 2, topB, bodyW, hB)
  }
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  slots: DeskSlot[], agents: AutonomyAgent[],
  selected: string | null, cam: Cam,
  candleMap: Record<string, MiniBar[]>
) {
  ctx.fillStyle = '#0e1412'
  ctx.fillRect(0, 0, w, h)

  const corners = [
    project(FMIN, 0, FMIN, w, h, cam),
    project(FMAX, 0, FMIN, w, h, cam),
    project(FMAX, 0, FMAX, w, h, cam),
    project(FMIN, 0, FMAX, w, h, cam),
  ]
  ctx.beginPath()
  corners.forEach((c, i) => (i ? ctx.lineTo(c.sx, c.sy) : ctx.moveTo(c.sx, c.sy)))
  ctx.closePath()
  ctx.fillStyle = '#2f3b36'
  ctx.fill()
  ctx.strokeStyle = '#1a2220'
  ctx.lineWidth = 2
  ctx.stroke()

  box(ctx, -2.2, 0, 4.6, 4.4, 1.9, 0.2, '#3a2a40', w, h, cam)
  {
    const p = project(0, 1.2, 4.5, w, h, cam)
    ctx.fillStyle = '#F4D35E'
    ctx.font = `bold ${Math.max(12, Math.round(cam.scale * 0.55))}px monospace`
    ctx.fillText('RESEARCH', p.sx - 36, p.sy)
  }
  box(ctx, 4.4, 0, -2.8, 0.2, 1.8, 3.2, '#243044', w, h, cam)

  const sorted = [...slots].sort((a, b) => {
    const ra = rotXZ(a.homeX, a.homeZ, cam.yaw)
    const rb = rotXZ(b.homeX, b.homeZ, cam.yaw)
    return ra.x + ra.z - (rb.x + rb.z)
  })
  for (const slot of sorted) {
    const x = clamp(slot.homeX)
    const z = clamp(slot.homeZ)
    if (slot.isBoss) {
      box(ctx, x - 1.15, 0, z - 1.0, 0.1, 1.7, 1.8, '#6E1423', w, h, cam)
      box(ctx, x + 1.0, 0, z - 1.0, 0.1, 1.7, 1.8, '#6E1423', w, h, cam)
    }
    box(ctx, x - 0.6, 0.05, z - 0.38, 1.2, 0.48, 0.78, '#6b5230', w, h, cam)
    box(ctx, x - 0.28, 0.55, z - 0.28, 0.56, 0.48, 0.1, '#151515', w, h, cam)

    const ag = agents.find((a) => a.slotId === slot.id)
    const scr = project(x, 0.82, z - 0.22, w, h, cam)
    const bw = Math.max(64, cam.scale * 2.6)
    const bh = Math.max(40, cam.scale * 1.55)
    const left = scr.sx - bw / 2
    const top = scr.sy - bh / 2

    let bg = '#0a1210'
    let fg = '#5e8f7a'
    let label = 'idle'
    if (ag) {
      label = (ag.asset || '—').slice(0, 10)
      if (ag.activity === 'researching') {
        bg = '#071a14'; fg = '#0ecb81'
      } else if (ag.activity === 'strategizing') {
        bg = ag.bias === 'bullish' ? '#071a12' : ag.bias === 'bearish' ? '#1a0c0a' : '#1a180a'
        fg = ag.bias === 'bullish' ? '#0ecb81' : ag.bias === 'bearish' ? '#f6465d' : '#F4D35E'
      } else if (ag.activity === 'reporting') {
        bg = '#14101a'; fg = '#F4D35E'
      } else if (ag.activity === 'walking') {
        bg = '#0e1412'; fg = '#848e9c'
      }
    }

    ctx.fillStyle = bg
    ctx.fillRect(left, top, bw, bh)
    ctx.strokeStyle = '#000'
    ctx.strokeRect(left, top, bw, bh)

    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(left, top, bw, 14)
    ctx.fillStyle = fg
    ctx.font = `bold ${Math.max(9, Math.round(cam.scale * 0.42))}px monospace`
    ctx.fillText(label, left + 4, top + 11)

    const bars =
      ag && candleMap
        ? candleMap[ag.asset] || candleMap[ag.asset?.toUpperCase?.() ?? ''] || candleMap[Object.keys(candleMap)[0] ?? '']
        : undefined
    drawMiniChart(ctx, left, top, bw, bh, bars, fg)

    const plate = project(x, 0.08, z + 0.95, w, h, cam)
    const nameFs = Math.max(14, Math.round(cam.scale * 0.6))
    const roleFs = Math.max(11, Math.round(cam.scale * 0.45))
    ctx.font = `bold ${nameFs}px monospace`
    const nameW = ctx.measureText(slot.name).width
    ctx.font = `${roleFs}px monospace`
    const roleW = ctx.measureText(slot.role).width
    const boxW = Math.max(nameW, roleW) + 20
    const boxH = nameFs + roleFs + 14
    const sel = selected === slot.id
    ctx.fillStyle = sel ? 'rgba(244,211,94,0.25)' : 'rgba(0,0,0,0.78)'
    ctx.fillRect(plate.sx - boxW / 2, plate.sy, boxW, boxH)
    ctx.strokeStyle = sel ? '#F4D35E' : 'rgba(255,255,255,0.18)'
    ctx.strokeRect(plate.sx - boxW / 2, plate.sy, boxW, boxH)
    ctx.textAlign = 'center'
    ctx.fillStyle = sel ? '#F4D35E' : '#eaecef'
    ctx.font = `bold ${nameFs}px monospace`
    ctx.fillText(slot.name, plate.sx, plate.sy + nameFs + 3)
    ctx.fillStyle = '#a8b0b8'
    ctx.font = `${roleFs}px monospace`
    ctx.fillText(slot.role, plate.sx, plate.sy + nameFs + roleFs + 5)
    ctx.textAlign = 'left'
  }

  for (const ag of [...agents].sort((a, b) => {
    const ra = rotXZ(a.x, a.z, cam.yaw)
    const rb = rotXZ(b.x, b.z, cam.yaw)
    return ra.x + ra.z - (rb.x + rb.z)
  })) {
    const ax = clamp(ag.x)
    const az = clamp(ag.z)
    const bob = ag.activity === 'walking' ? Math.sin(Date.now() / 140) * 0.04 : 0
    const y = 0.06 + bob
    box(ctx, ax - 0.14, y, az - 0.11, 0.28, 0.58, 0.22, ag.color || '#888', w, h, cam)
    box(ctx, ax - 0.11, y + 0.58, az - 0.09, 0.22, 0.22, 0.18, '#e8c4a0', w, h, cam)
    const p = project(ax, y + 1.15, az, w, h, cam)
    ctx.font = 'bold 12px monospace'
    const tw = ctx.measureText(ag.asset).width + 14
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.fillRect(p.sx - tw / 2, p.sy - 22, tw, 18)
    ctx.strokeStyle = 'rgba(244,211,94,0.45)'
    ctx.strokeRect(p.sx - tw / 2, p.sy - 22, tw, 18)
    ctx.fillStyle = '#F4D35E'
    ctx.textAlign = 'center'
    ctx.fillText(ag.asset, p.sx, p.sy - 8)
    ctx.textAlign = 'left'
  }

  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(8, h - 28, 340, 20)
  ctx.fillStyle = '#9aa3ad'
  ctx.font = '11px monospace'
  ctx.fillText('drag=pan · Shift/destro=gira · wheel=zoom · dblclick=reset', 12, h - 14)
}

export function Office3D({
  slots,
  agentsLiveRef,
  selectedSlotId,
  onSelectSlot,
  candleMap,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef(slots)
  const selRef = useRef(selectedSlotId)
  const clickRef = useRef(onSelectSlot)
  const mapRef = useRef(candleMap || {})
  const camRef = useRef<Cam>({ ox: 0, oy: 0, scale: 28, yaw: 0 })
  slotsRef.current = slots
  selRef.current = selectedSlotId
  clickRef.current = onSelectSlot
  mapRef.current = candleMap || {}

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = wrapRef.current
    if (!canvas || !parent) return
    let raf = 0
    let running = true
    let dragging = false
    let mode: 'pan' | 'orbit' = 'pan'
    let lx = 0
    let ly = 0
    let moved = false

    const resize = () => {
      const r = parent.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = Math.max(280, r.width || 400)
      const ch = Math.max(260, r.height || 320)
      const tw = Math.floor(cw * dpr)
      const th = Math.floor(ch * dpr)
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw
        canvas.height = th
      }
      canvas.style.width = `${cw}px`
      canvas.style.height = `${ch}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    const loop = () => {
      if (!running) return
      try {
        const ctx = canvas.getContext('2d')
        if (ctx && canvas.width > 8) {
          const live = (agentsLiveRef.current || []).map((a) => ({
            ...a,
            x: clamp(a.x),
            z: clamp(a.z),
          }))
          paint(ctx, canvas.width, canvas.height, slotsRef.current, live, selRef.current, camRef.current, mapRef.current)
        }
      } catch { /* keep alive */ }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onDown = (e: PointerEvent) => {
      dragging = true
      moved = false
      lx = e.clientX
      ly = e.clientY
      mode = e.button === 2 || e.shiftKey || e.altKey || e.metaKey ? 'orbit' : 'pan'
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = mode === 'orbit' ? 'grabbing' : 'move'
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lx
      const dy = e.clientY - ly
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (mode === 'orbit') {
        camRef.current.yaw += dx * 0.008
        camRef.current.oy += dy * dpr * 0.35
      } else {
        camRef.current.ox += dx * dpr
        camRef.current.oy += dy * dpr
      }
      lx = e.clientX
      ly = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
      canvas.style.cursor = 'grab'
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* */ }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camRef.current.scale = Math.max(16, Math.min(52, camRef.current.scale * (e.deltaY > 0 ? 0.92 : 1.08)))
    }
    const onContext = (e: Event) => { e.preventDefault() }
    const onClick = (e: MouseEvent) => {
      if (moved) return
      const rect = canvas.getBoundingClientRect()
      const mx = ((e.clientX - rect.left) / rect.width) * canvas.width
      const my = ((e.clientY - rect.top) / rect.height) * canvas.height
      let best: { id: string; d: number } | null = null
      for (const s of slotsRef.current) {
        const p = project(s.homeX, 0.5, s.homeZ, canvas.width, canvas.height, camRef.current)
        const d = (p.sx - mx) ** 2 + (p.sy - my) ** 2
        if (!best || d < best.d) best = { id: s.id, d }
      }
      if (best && best.d < 80 * 80) clickRef.current(best.id)
    }
    const onDbl = () => {
      camRef.current = { ox: 0, oy: 0, scale: 28, yaw: 0 }
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContext)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('dblclick', onDbl)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContext)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('dblclick', onDbl)
    }
  }, [agentsLiveRef])

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%',
        height: 360,
        minHeight: 300,
        background: '#0e1412',
        boxShadow: 'inset 0 0 0 2px #1a1a1a',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grab',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', background: '#0e1412', touchAction: 'none' }}
      />
    </div>
  )
}
