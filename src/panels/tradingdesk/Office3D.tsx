/**
 * 3D trading office — desks, chairs, monitors, coffee/water, door, chat.
 */
import { useEffect, useRef, type MutableRefObject } from 'react'
import type { AutonomyAgent, DeskSlot } from './autonomy'
import { POI_COFFEE, POI_WATER, POI_DOOR } from './autonomy'

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

function box(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, w: number, h: number, cam: Cam) {
  const p = [[x,y,z],[x+sx,y,z],[x+sx,y,z+sz],[x,y,z+sz],[x,y+sy,z],[x+sx,y+sy,z],[x+sx,y+sy,z+sz],[x,y+sy,z+sz]].map(([a,b,c]) => project(a!,b!,c!,w,h,cam))
  const face = (idx: number[], mul: number) => {
    ctx.beginPath()
    idx.forEach((i, k) => { const c = p[i]!; k === 0 ? ctx.moveTo(c.sx, c.sy) : ctx.lineTo(c.sx, c.sy) })
    ctx.closePath()
    ctx.fillStyle = shade(color, mul)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  face([3,2,6,7], 0.55); face([0,3,7,4], 0.72); face([1,2,6,5], 0.88); face([4,5,6,7], 1.08)
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam) {
  const corners = [project(FMIN,0,FMIN,w,h,cam), project(FMAX,0,FMIN,w,h,cam), project(FMAX,0,FMAX,w,h,cam), project(FMIN,0,FMAX,w,h,cam)]
  ctx.beginPath(); corners.forEach((c,i) => (i ? ctx.lineTo(c.sx,c.sy) : ctx.moveTo(c.sx,c.sy))); ctx.closePath()
  ctx.fillStyle = '#2a3330'; ctx.fill()
  for (let i = -5; i <= 5; i++) {
    const a = project(i, 0.01, FMIN, w, h, cam); const b = project(i, 0.01, FMAX, w, h, cam)
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.04)'
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
  }
  const rug = [project(-2.4,0.02,-1.6,w,h,cam), project(2.4,0.02,-1.6,w,h,cam), project(2.4,0.02,2.4,w,h,cam), project(-2.4,0.02,2.4,w,h,cam)]
  ctx.beginPath(); rug.forEach((c,i) => (i ? ctx.lineTo(c.sx,c.sy) : ctx.moveTo(c.sx,c.sy))); ctx.closePath()
  ctx.fillStyle = '#5c1a22'; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#8b2a35'; ctx.stroke()
}

function drawDoor(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam) {
  const x = POI_DOOR.x - 0.7; const z = POI_DOOR.z
  box(ctx, x, 0, z, 1.4, 2.2, 0.12, '#4a3420', w, h, cam)
  box(ctx, x + 0.08, 0.15, z - 0.02, 1.24, 1.9, 0.08, '#6b4a2a', w, h, cam)
  box(ctx, x + 1.1, 1.0, z - 0.05, 0.12, 0.08, 0.1, '#c0a060', w, h, cam)
  const p = project(x + 0.7, 2.35, z, w, h, cam)
  ctx.fillStyle = '#848e9c'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('EXIT', p.sx, p.sy); ctx.textAlign = 'left'
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam, active: boolean) {
  const x = POI_COFFEE.x - 0.35; const z = POI_COFFEE.z - 0.25
  box(ctx, x, 0, z, 0.7, 1.15, 0.5, '#2a2a2e', w, h, cam)
  box(ctx, x + 0.08, 0.7, z - 0.05, 0.54, 0.35, 0.08, active ? '#3d2a1a' : '#1a1a1a', w, h, cam)
  if (active) { const p = project(x + 0.35, 1.4, z, w, h, cam); ctx.font = '14px sans-serif'; ctx.fillText('☕', p.sx - 6, p.sy) }
}

function drawWaterCooler(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam, active: boolean) {
  const x = POI_WATER.x - 0.25; const z = POI_WATER.z - 0.25
  box(ctx, x, 0, z, 0.5, 0.9, 0.5, '#3a4550', w, h, cam)
  box(ctx, x + 0.05, 0.9, z + 0.05, 0.4, 0.55, 0.4, active ? '#4a9eff' : '#2a6080', w, h, cam)
  if (active) { const p = project(x + 0.25, 1.55, z, w, h, cam); ctx.font = '14px sans-serif'; ctx.fillText('💧', p.sx - 6, p.sy) }
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, z: number, w: number, h: number, cam: Cam, occupied: boolean) {
  box(ctx, x - 0.2, 0.02, z + 0.55, 0.4, 0.28, 0.4, occupied ? '#3a4550' : '#2a3238', w, h, cam)
  box(ctx, x - 0.2, 0.3, z + 0.83, 0.4, 0.45, 0.08, '#2a3238', w, h, cam)
}

function drawMiniChart(ctx: CanvasRenderingContext2D, left: number, top: number, bw: number, bh: number, bars: MiniBar[] | undefined, accent: string) {
  const chartTop = top + 15; const chartH = Math.max(8, bh - 20); const chartLeft = left + 3; const chartW = bw - 6
  if (!bars || bars.length < 2) {
    ctx.beginPath(); ctx.moveTo(chartLeft, chartTop + chartH * 0.6)
    for (let i = 1; i < 10; i++) { const t = i / 9; const wave = Math.sin(Date.now() / 400 + i * 0.8) * chartH * 0.25; ctx.lineTo(chartLeft + t * chartW, chartTop + chartH * 0.55 - wave) }
    ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke(); return
  }
  const slice = bars.slice(-12)
  let lo = Infinity, hi = -Infinity
  for (const b of slice) { if (b.l < lo) lo = b.l; if (b.h > hi) hi = b.h }
  const span = hi - lo || 1; const gap = chartW / slice.length; const bodyW = Math.max(1.5, gap * 0.55)
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i]!; const cx = chartLeft + i * gap + gap * 0.5
    const yH = chartTop + ((hi - b.h) / span) * chartH; const yL = chartTop + ((hi - b.l) / span) * chartH
    const yO = chartTop + ((hi - b.o) / span) * chartH; const yC = chartTop + ((hi - b.c) / span) * chartH
    const col = b.c >= b.o ? '#0ecb81' : '#f6465d'
    ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(cx, yH); ctx.lineTo(cx, yL); ctx.stroke()
    ctx.fillStyle = col; ctx.fillRect(cx - bodyW / 2, Math.min(yO, yC), bodyW, Math.max(1, Math.abs(yC - yO)))
  }
}

function drawBubble(ctx: CanvasRenderingContext2D, sx: number, sy: number, text: string) {
  if (!text) return
  const t = text.length > 42 ? text.slice(0, 40) + '…' : text
  ctx.font = '11px monospace'
  const tw = ctx.measureText(t).width + 14; const th = 22; const bx = sx - tw / 2; const by = sy - 36
  ctx.fillStyle = 'rgba(234,236,239,0.95)'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5
  ctx.fillRect(bx, by, tw, th); ctx.strokeRect(bx, by, tw, th)
  ctx.beginPath(); ctx.moveTo(sx - 4, by + th); ctx.lineTo(sx, by + th + 6); ctx.lineTo(sx + 4, by + th); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.fillText(t, sx, by + 15); ctx.textAlign = 'left'
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, slots: DeskSlot[], agents: AutonomyAgent[], selected: string | null, cam: Cam, candleMap: Record<string, MiniBar[]>) {
  ctx.fillStyle = '#0c1014'; ctx.fillRect(0, 0, w, h)
  const wall = [project(FMIN,0,FMIN,w,h,cam), project(FMAX,0,FMIN,w,h,cam), project(FMAX,3.2,FMIN,w,h,cam), project(FMIN,3.2,FMIN,w,h,cam)]
  ctx.beginPath(); wall.forEach((c,i) => (i ? ctx.lineTo(c.sx,c.sy) : ctx.moveTo(c.sx,c.sy))); ctx.closePath(); ctx.fillStyle = '#1a2228'; ctx.fill()
  drawFloor(ctx, w, h, cam); drawDoor(ctx, w, h, cam)
  drawCoffeeMachine(ctx, w, h, cam, agents.some((a) => a.activity === 'coffee'))
  drawWaterCooler(ctx, w, h, cam, agents.some((a) => a.activity === 'water'))
  box(ctx, -2.2, 0, 4.6, 4.4, 1.9, 0.2, '#3a2a40', w, h, cam)
  { const p = project(0, 1.2, 4.5, w, h, cam); ctx.fillStyle = '#F4D35E'; ctx.font = `bold ${Math.max(11, Math.round(cam.scale * 0.5))}px monospace`; ctx.fillText('RESEARCH', p.sx - 34, p.sy) }

  const sorted = [...slots].sort((a, b) => { const ra = rotXZ(a.homeX, a.homeZ, cam.yaw); const rb = rotXZ(b.homeX, b.homeZ, cam.yaw); return ra.x + ra.z - (rb.x + rb.z) })
  for (const slot of sorted) {
    const x = clamp(slot.homeX); const z = clamp(slot.homeZ)
    const ag = agents.find((a) => a.slotId === slot.id)
    const occupied = !!(ag && ag.seated)
    if (slot.isBoss) { box(ctx, x - 1.15, 0, z - 1.0, 0.1, 1.7, 1.8, '#6E1423', w, h, cam); box(ctx, x + 1.0, 0, z - 1.0, 0.1, 1.7, 1.8, '#6E1423', w, h, cam) }
    box(ctx, x - 0.65, 0.05, z - 0.4, 1.3, 0.5, 0.85, '#6b5230', w, h, cam)
    box(ctx, x - 0.08, 0.55, z - 0.15, 0.16, 0.12, 0.12, '#222', w, h, cam)
    box(ctx, x - 0.42, 0.65, z - 0.32, 0.84, 0.55, 0.1, '#111', w, h, cam)
    const scr = project(x, 0.95, z - 0.28, w, h, cam)
    const bw = Math.max(68, cam.scale * 2.7); const bh = Math.max(42, cam.scale * 1.6)
    const left = scr.sx - bw / 2; const top = scr.sy - bh / 2
    let bg = '#0a1210'; let fg = '#5e8f7a'; let label = 'idle'
    if (ag) {
      label = (ag.asset || '—').slice(0, 10)
      if (ag.activity === 'researching' || ag.activity === 'sitting') { bg = '#071a14'; fg = '#0ecb81' }
      else if (ag.activity === 'strategizing') { bg = ag.bias === 'bullish' ? '#071a12' : ag.bias === 'bearish' ? '#1a0c0a' : '#1a180a'; fg = ag.bias === 'bullish' ? '#0ecb81' : ag.bias === 'bearish' ? '#f6465d' : '#F4D35E' }
      else if (ag.activity === 'reporting') { bg = '#14101a'; fg = '#F4D35E' }
    }
    ctx.fillStyle = bg; ctx.fillRect(left, top, bw, bh); ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(left, top, bw, bh)
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(left, top, bw, 14)
    ctx.fillStyle = fg; ctx.font = `bold ${Math.max(9, Math.round(cam.scale * 0.4))}px monospace`; ctx.fillText(label, left + 4, top + 11)
    const bars = ag && candleMap ? candleMap[ag.asset] || candleMap[ag.asset?.toUpperCase?.() ?? ''] : undefined
    drawMiniChart(ctx, left, top, bw, bh, bars, fg)
    drawChair(ctx, x, z, w, h, cam, occupied)
    const plate = project(x, 0.08, z + 1.05, w, h, cam)
    const nameFs = Math.max(13, Math.round(cam.scale * 0.55)); const roleFs = Math.max(10, Math.round(cam.scale * 0.42))
    ctx.font = `bold ${nameFs}px monospace`; const nameW = ctx.measureText(slot.name).width
    ctx.font = `${roleFs}px monospace`; const roleW = ctx.measureText(slot.role).width
    const boxW = Math.max(nameW, roleW) + 18; const boxH = nameFs + roleFs + 12; const sel = selected === slot.id
    ctx.fillStyle = sel ? 'rgba(244,211,94,0.25)' : 'rgba(0,0,0,0.78)'; ctx.fillRect(plate.sx - boxW / 2, plate.sy, boxW, boxH)
    ctx.strokeStyle = sel ? '#F4D35E' : 'rgba(255,255,255,0.15)'; ctx.strokeRect(plate.sx - boxW / 2, plate.sy, boxW, boxH)
    ctx.textAlign = 'center'; ctx.fillStyle = sel ? '#F4D35E' : '#eaecef'; ctx.font = `bold ${nameFs}px monospace`; ctx.fillText(slot.name, plate.sx, plate.sy + nameFs + 2)
    ctx.fillStyle = '#a8b0b8'; ctx.font = `${roleFs}px monospace`; ctx.fillText(slot.role, plate.sx, plate.sy + nameFs + roleFs + 4); ctx.textAlign = 'left'
  }

  for (const ag of [...agents].sort((a, b) => { const ra = rotXZ(a.x, a.z, cam.yaw); const rb = rotXZ(b.x, b.z, cam.yaw); return ra.x + ra.z - (rb.x + rb.z) })) {
    const ax = clamp(ag.x); const az = clamp(ag.z)
    const seated = !!ag.seated && ['sitting','researching','strategizing','reporting','idle'].includes(ag.activity)
    const bob = ag.activity === 'walking' ? Math.sin(Date.now() / 140) * 0.04 : 0
    const bodyH = seated ? 0.38 : 0.58; const y = seated ? 0.28 + bob * 0.2 : 0.06 + bob
    if (!seated) {
      box(ctx, ax - 0.1, 0.02, az - 0.06, 0.08, 0.28, 0.1, '#2a2a40', w, h, cam)
      box(ctx, ax + 0.02, 0.02, az - 0.06, 0.08, 0.28, 0.1, '#2a2a40', w, h, cam)
    }
    box(ctx, ax - 0.14, y, az - 0.11, 0.28, bodyH, 0.22, ag.color || '#888', w, h, cam)
    box(ctx, ax - 0.11, y + bodyH, az - 0.09, 0.22, 0.22, 0.18, '#e8c4a0', w, h, cam)
    if (ag.activity === 'coffee' || ag.activity === 'water') {
      const p = project(ax, y + bodyH + 0.35, az, w, h, cam)
      ctx.font = '14px sans-serif'; ctx.fillText(ag.activity === 'coffee' ? '☕' : '💧', p.sx - 6, p.sy)
    }
    const p = project(ax, y + bodyH + 0.35, az, w, h, cam)
    if (ag.chatLine) drawBubble(ctx, p.sx, p.sy, ag.chatLine)
    else {
      ctx.font = 'bold 11px monospace'; const tw = ctx.measureText(ag.asset).width + 12
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(p.sx - tw / 2, p.sy - 18, tw, 16)
      ctx.fillStyle = '#F4D35E'; ctx.textAlign = 'center'; ctx.fillText(ag.asset, p.sx, p.sy - 6); ctx.textAlign = 'left'
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(8, h - 28, 380, 20)
  ctx.fillStyle = '#9aa3ad'; ctx.font = '11px monospace'
  ctx.fillText('drag=pan · Shift/destro=gira · wheel=zoom · dblclick=reset', 12, h - 14)
}

export function Office3D({ slots, agentsLiveRef, selectedSlotId, onSelectSlot, candleMap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef(slots)
  const selRef = useRef(selectedSlotId)
  const clickRef = useRef(onSelectSlot)
  const mapRef = useRef(candleMap || {})
  const camRef = useRef<Cam>({ ox: 0, oy: 0, scale: 28, yaw: 0 })
  slotsRef.current = slots; selRef.current = selectedSlotId; clickRef.current = onSelectSlot; mapRef.current = candleMap || {}

  useEffect(() => {
    const canvas = canvasRef.current; const parent = wrapRef.current
    if (!canvas || !parent) return
    let raf = 0; let running = true; let dragging = false; let mode: 'pan' | 'orbit' = 'pan'; let lx = 0; let ly = 0; let moved = false
    const resize = () => {
      const r = parent.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = Math.max(280, r.width || 400); const ch = Math.max(260, r.height || 320)
      const tw = Math.floor(cw * dpr); const th = Math.floor(ch * dpr)
      if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th }
      canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`
    }
    resize(); const ro = new ResizeObserver(resize); ro.observe(parent)
    const loop = () => {
      if (!running) return
      try {
        const ctx = canvas.getContext('2d')
        if (ctx && canvas.width > 8) {
          const live = (agentsLiveRef.current || []).map((a) => ({ ...a, x: clamp(a.x), z: clamp(a.z) }))
          paint(ctx, canvas.width, canvas.height, slotsRef.current, live, selRef.current, camRef.current, mapRef.current)
        }
      } catch { /* */ }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const onDown = (e: PointerEvent) => { dragging = true; moved = false; lx = e.clientX; ly = e.clientY; mode = e.button === 2 || e.shiftKey || e.altKey || e.metaKey ? 'orbit' : 'pan'; canvas.setPointerCapture(e.pointerId) }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lx; const dy = e.clientY - ly
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (mode === 'orbit') { camRef.current.yaw += dx * 0.008; camRef.current.oy += dy * dpr * 0.35 }
      else { camRef.current.ox += dx * dpr; camRef.current.oy += dy * dpr }
      lx = e.clientX; ly = e.clientY
    }
    const onUp = (e: PointerEvent) => { dragging = false; try { canvas.releasePointerCapture(e.pointerId) } catch { /* */ } }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); camRef.current.scale = Math.max(16, Math.min(52, camRef.current.scale * (e.deltaY > 0 ? 0.92 : 1.08))) }
    const onContext = (e: Event) => e.preventDefault()
    const onClick = (e: MouseEvent) => {
      if (moved) return
      const rect = canvas.getBoundingClientRect()
      const mx = ((e.clientX - rect.left) / rect.width) * canvas.width; const my = ((e.clientY - rect.top) / rect.height) * canvas.height
      let best: { id: string; d: number } | null = null
      for (const s of slotsRef.current) {
        const p = project(s.homeX, 0.5, s.homeZ, canvas.width, canvas.height, camRef.current)
        const d = (p.sx - mx) ** 2 + (p.sy - my) ** 2
        if (!best || d < best.d) best = { id: s.id, d }
      }
      if (best && best.d < 80 * 80) clickRef.current(best.id)
    }
    const onDbl = () => { camRef.current = { ox: 0, oy: 0, scale: 28, yaw: 0 } }
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('contextmenu', onContext)
    canvas.addEventListener('click', onClick); canvas.addEventListener('dblclick', onDbl)
    return () => {
      running = false; cancelAnimationFrame(raf); ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('contextmenu', onContext)
      canvas.removeEventListener('click', onClick); canvas.removeEventListener('dblclick', onDbl)
    }
  }, [agentsLiveRef])

  return (
    <div ref={wrapRef} style={{ width: '100%', height: 380, minHeight: 320, background: '#0c1014', boxShadow: 'inset 0 0 0 2px #1a1a1a', position: 'relative', overflow: 'hidden', cursor: 'grab' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', background: '#0c1014', touchAction: 'none' }} />
    </div>
  )
}
