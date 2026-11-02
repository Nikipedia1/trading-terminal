/**
 * 3D trading office — carpet floor, readable nameplates, pan/zoom.
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

const FMIN = -5.5
const FMAX = 5.5
const clamp = (v: number) => Math.max(FMIN, Math.min(FMAX, v))

function project(x: number, y: number, z: number, w: number, h: number, cam: Cam) {
  const isoX = (x - z) * cam.scale
  const isoY = (x + z) * (cam.scale * 0.5) - y * (cam.scale * 1.25)
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

function paint(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  slots: DeskSlot[], agents: AutonomyAgent[],
  selected: string | null, cam: Cam
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

  const sorted = [...slots].sort((a, b) => a.homeX + a.homeZ - (b.homeX + b.homeZ))
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
    const bw = Math.max(56, cam.scale * 2.3)
    const bh = Math.max(32, cam.scale * 1.35)
    let bg = '#0d1a18'
    let fg = '#5e8f7a'
    let l1 = 'idle'
    let l2 = ''
    if (ag) {
      l1 = (ag.asset || '—').slice(0, 10)
      if (ag.activity === 'researching') {
        bg = '#0a1f18'; fg = '#0ecb81'; l2 = (ag.screenLine || 'scan').slice(0, 14)
      } else if (ag.activity === 'strategizing') {
        bg = ag.bias === 'bullish' ? '#0a2018' : ag.bias === 'bearish' ? '#20100e' : '#1a180a'
        fg = ag.bias === 'bullish' ? '#0ecb81' : ag.bias === 'bearish' ? '#f6465d' : '#F4D35E'
        l2 = (ag.screenLine || 'probe').slice(0, 14)
      } else if (ag.activity === 'reporting') {
        bg = '#1a1520'; fg = '#F4D35E'; l2 = 'report → boss'
      } else if (ag.activity === 'walking') {
        bg = '#121818'; fg = '#848e9c'; l2 = 'moving…'
      } else l2 = (ag.screenLine || 'desk').slice(0, 14)
    }
    ctx.fillStyle = bg
    ctx.fillRect(scr.sx - bw / 2, scr.sy - bh / 2, bw, bh)
    ctx.strokeStyle = '#000'
    ctx.strokeRect(scr.sx - bw / 2, scr.sy - bh / 2, bw, bh)
    if (ag && (ag.activity === 'researching' || ag.activity === 'strategizing')) {
      ctx.beginPath()
      const by = scr.sy + 4
      ctx.moveTo(scr.sx - bw / 2 + 4, by)
      for (let i = 1; i < 8; i++) {
        const t = i / 7
        const wave = Math.sin(Date.now() / 280 + i + (ag.x || 0)) * (ag.bias === 'bearish' ? -7 : 7)
        ctx.lineTo(scr.sx - bw / 2 + 4 + t * (bw - 8), by - wave - t * 5)
      }
      ctx.strokeStyle = fg
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    ctx.fillStyle = fg
    ctx.font = `bold ${Math.max(11, Math.round(cam.scale * 0.5))}px monospace`
    ctx.fillText(l1, scr.sx - bw / 2 + 5, scr.sy - bh / 2 + 15)
    ctx.fillStyle = '#c8cdd3'
    ctx.font = `${Math.max(10, Math.round(cam.scale * 0.42))}px monospace`
    ctx.fillText(l2, scr.sx - bw / 2 + 5, scr.sy - bh / 2 + 28)

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

  for (const ag of [...agents].sort((a, b) => a.x + a.z - (b.x + b.z))) {
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

  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(8, h - 24, 240, 18)
  ctx.fillStyle = '#9aa3ad'
  ctx.font = '11px monospace'
  ctx.fillText('drag = pan  ·  wheel = zoom  ·  click desk', 12, h - 11)
}

export function Office3D({ slots, agentsLiveRef, selectedSlotId, onSelectSlot }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef(slots)
  const selRef = useRef(selectedSlotId)
  const clickRef = useRef(onSelectSlot)
  const camRef = useRef<Cam>({ ox: 0, oy: 0, scale: 28 })
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
    let lx = 0
    let ly = 0

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
          paint(ctx, canvas.width, canvas.height, slotsRef.current, live, selRef.current, camRef.current)
        }
      } catch { /* keep alive */ }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onDown = (e: PointerEvent) => {
      dragging = true
      lx = e.clientX
      ly = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      camRef.current.ox += (e.clientX - lx) * dpr
      camRef.current.oy += (e.clientY - ly) * dpr
      lx = e.clientX
      ly = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* */ }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camRef.current.scale = Math.max(16, Math.min(52, camRef.current.scale * (e.deltaY > 0 ? 0.92 : 1.08)))
    }
    const onClick = (e: MouseEvent) => {
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
