/**
 * 3D trading office — reference-style ambient + human-like seated traders.
 */
import { useEffect, useRef, type MutableRefObject } from 'react'
import type { AutonomyAgent, DeskSlot } from './autonomy'
import { POI_COFFEE, POI_WATER, POI_DOOR } from './autonomy'

type MiniBar = { o: number; h: number; l: number; c: number }

function symbolFallback(map: Record<string, MiniBar[]>): MiniBar[] | undefined {
  const keys = Object.keys(map)
  return keys.length ? map[keys[0]!] : undefined
}

type Props = {
  slots: DeskSlot[]
  agentsLiveRef: MutableRefObject<AutonomyAgent[]>
  agents: AutonomyAgent[]
  selectedSlotId: string | null
  onSelectSlot: (id: string) => void
  candleMap?: Record<string, MiniBar[]>
  interval?: string
  exchange?: string
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
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex
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
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  face([3,2,6,7], 0.55); face([0,3,7,4], 0.72); face([1,2,6,5], 0.88); face([4,5,6,7], 1.05)
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam) {
  const corners = [project(FMIN,0,FMIN,w,h,cam), project(FMAX,0,FMIN,w,h,cam), project(FMAX,0,FMAX,w,h,cam), project(FMIN,0,FMAX,w,h,cam)]
  ctx.beginPath(); corners.forEach((c,i) => (i ? ctx.lineTo(c.sx,c.sy) : ctx.moveTo(c.sx,c.sy))); ctx.closePath()
  ctx.fillStyle = '#3a4248'; ctx.fill()
  for (let i = -5; i <= 5; i++) {
    const a = project(i, 0.01, FMIN, w, h, cam); const b = project(i, 0.01, FMAX, w, h, cam)
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.03)'
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
  }
  const rug = [project(-2.4,0.02,-1.6,w,h,cam), project(2.4,0.02,-1.6,w,h,cam), project(2.4,0.02,2.4,w,h,cam), project(-2.4,0.02,2.4,w,h,cam)]
  ctx.beginPath(); rug.forEach((c,i) => (i ? ctx.lineTo(c.sx,c.sy) : ctx.moveTo(c.sx,c.sy))); ctx.closePath()
  ctx.fillStyle = '#2a3238'; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#3a4550'; ctx.stroke()
}

function drawDoor(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam) {
  const x = POI_DOOR.x - 0.7; const z = POI_DOOR.z
  box(ctx, x, 0, z, 1.4, 2.2, 0.12, '#4a3420', w, h, cam)
  box(ctx, x + 0.08, 0.15, z - 0.02, 1.24, 1.9, 0.08, '#6b4a2a', w, h, cam)
  box(ctx, x + 1.1, 1.0, z - 0.05, 0.12, 0.08, 0.1, '#c0a060', w, h, cam)
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
  const col = occupied ? '#3d4a58' : '#2a343e'
  box(ctx, x - 0.22, 0.22, z + 0.45, 0.44, 0.1, 0.4, col, w, h, cam)
  box(ctx, x - 0.22, 0.32, z + 0.75, 0.44, 0.5, 0.08, col, w, h, cam)
  box(ctx, x - 0.04, 0.02, z + 0.58, 0.08, 0.22, 0.08, '#1a1a1e', w, h, cam)
  box(ctx, x - 0.18, 0.0, z + 0.5, 0.36, 0.04, 0.3, '#1a1a1e', w, h, cam)
}

function drawProMonitor(
  ctx: CanvasRenderingContext2D,
  left: number, top: number, bw: number, bh: number,
  asset: string, bars: MiniBar[] | undefined,
  interval: string, exchange: string,
  agentName: string, bias: string
) {
  ctx.fillStyle = '#06080c'
  ctx.fillRect(left - 1, top - 1, bw + 2, bh + 2)
  ctx.fillStyle = '#0b0f14'
  ctx.fillRect(left, top, bw, bh)
  ctx.strokeStyle = '#1e2630'
  ctx.lineWidth = 1.5
  ctx.strokeRect(left + 0.5, top + 0.5, bw - 1, bh - 1)

  const pad = 3
  const headerH = 15
  const subH = 11
  const footerH = 11
  const volH = Math.max(8, Math.round(bh * 0.14))
  const chartTop = top + headerH + subH + 2
  const chartBot = top + bh - footerH - volH - 2
  const chartH = Math.max(8, chartBot - chartTop)
  const chartLeft = left + pad
  const chartW = bw - pad * 2 - 18
  const priceX = left + bw - 16

  const last = bars && bars.length ? bars[bars.length - 1]! : null
  const prev = bars && bars.length > 1 ? bars[bars.length - 2]! : last
  let chg = 0
  if (last && prev && prev.c) chg = ((last.c - prev.c) / prev.c) * 100
  const up = chg >= 0
  const priceCol = up ? '#0ecb81' : '#f6465d'
  const dec = last ? (last.c >= 1000 ? 1 : last.c >= 10 ? 2 : last.c >= 1 ? 4 : 5) : 2

  const hdrGrad = ctx.createLinearGradient(left, top, left, top + headerH)
  hdrGrad.addColorStop(0, '#141a22')
  hdrGrad.addColorStop(1, '#0e1319')
  ctx.fillStyle = hdrGrad
  ctx.fillRect(left, top, bw, headerH)

  ctx.fillStyle = '#eaecef'
  ctx.font = `bold ${Math.max(9, Math.min(12, Math.round(bw * 0.095)))}px ui-monospace, monospace`
  ctx.fillText(asset, left + 4, top + 11)

  if (last) {
    const priceStr = last.c.toFixed(dec)
    ctx.fillStyle = priceCol
    ctx.font = `bold ${Math.max(9, Math.min(11, Math.round(bw * 0.085)))}px ui-monospace, monospace`
    ctx.fillText(priceStr, left + bw - ctx.measureText(priceStr).width - 4, top + 11)
  }

  ctx.fillStyle = '#0c1016'
  ctx.fillRect(left, top + headerH, bw, subH)
  const exLabel = (exchange || 'binance').toUpperCase().replace(/_/g, ' ')
  const tfLabel = (interval || '15m').toUpperCase()
  ctx.fillStyle = '#6b7280'
  ctx.font = `${Math.max(7, Math.min(9, Math.round(bw * 0.065)))}px ui-monospace, monospace`
  ctx.fillText(`${tfLabel} · ${exLabel}`, left + 4, top + headerH + 9)
  if (last) {
    const chgStr = `${up ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}%`
    ctx.fillStyle = priceCol
    ctx.fillText(chgStr, left + bw - ctx.measureText(chgStr).width - 4, top + headerH + 9)
  }

  ctx.fillStyle = '#080c11'
  ctx.fillRect(chartLeft, chartTop, chartW, chartH + volH + 2)

  if (!bars || bars.length < 2) {
    ctx.fillStyle = '#3a4250'
    ctx.font = '9px monospace'
    ctx.fillText('loading…', chartLeft + 8, chartTop + chartH / 2)
  } else {
    const slice = bars.slice(-Math.min(24, bars.length))
    let lo = Infinity
    let hi = -Infinity
    for (const b of slice) {
      if (b.l < lo) lo = b.l
      if (b.h > hi) hi = b.h
    }
    const padR = (hi - lo) * 0.06 || last!.c * 0.002
    lo -= padR
    hi += padR
    const span = hi - lo || 1
    const gap = chartW / slice.length
    const bodyW = Math.max(1.2, gap * 0.62)
    const yAt = (price: number) => chartTop + ((hi - price) / span) * chartH

    const levels = 4
    ctx.font = `${Math.max(6, Math.min(8, Math.round(bw * 0.055)))}px ui-monospace, monospace`
    for (let g = 0; g <= levels; g++) {
      const price = hi - (span * g) / levels
      const gy = yAt(price)
      ctx.strokeStyle = g === 0 || g === levels ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(chartLeft, gy)
      ctx.lineTo(chartLeft + chartW, gy)
      ctx.stroke()
      ctx.fillStyle = '#4a5568'
      const lbl = price >= 1000 ? price.toFixed(0) : price >= 10 ? price.toFixed(1) : price.toFixed(dec)
      ctx.fillText(lbl, priceX - 2, gy + 3)
    }

    if (slice.length >= 5) {
      const period = Math.min(8, slice.length)
      ctx.beginPath()
      let started = false
      for (let i = period - 1; i < slice.length; i++) {
        let sum = 0
        for (let j = i - period + 1; j <= i; j++) sum += slice[j]!.c
        const ma = sum / period
        const cx = chartLeft + i * gap + gap * 0.5
        const cy = yAt(ma)
        if (!started) { ctx.moveTo(cx, cy); started = true }
        else ctx.lineTo(cx, cy)
      }
      ctx.strokeStyle = 'rgba(244, 211, 94, 0.55)'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    ctx.beginPath()
    for (let i = 0; i < slice.length; i++) {
      const cx = chartLeft + i * gap + gap * 0.5
      const cy = yAt(slice[i]!.c)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    }
    ctx.lineTo(chartLeft + (slice.length - 1) * gap + gap * 0.5, chartTop + chartH)
    ctx.lineTo(chartLeft + gap * 0.5, chartTop + chartH)
    ctx.closePath()
    const areaGrad = ctx.createLinearGradient(0, chartTop, 0, chartTop + chartH)
    areaGrad.addColorStop(0, up ? 'rgba(14,203,129,0.14)' : 'rgba(246,70,93,0.14)')
    areaGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = areaGrad
    ctx.fill()

    for (let i = 0; i < slice.length; i++) {
      const b = slice[i]!
      const cx = chartLeft + i * gap + gap * 0.5
      const yH = yAt(b.h)
      const yL = yAt(b.l)
      const yO = yAt(b.o)
      const yC = yAt(b.c)
      const bull = b.c >= b.o
      const col = bull ? '#0ecb81' : '#f6465d'
      const bodyTop = Math.min(yO, yC)
      const bodyBot = Math.max(yO, yC)
      const bodyH = Math.max(1.2, bodyBot - bodyTop)

      ctx.strokeStyle = col
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx, yH)
      ctx.lineTo(cx, yL)
      ctx.stroke()

      if (bull) {
        ctx.fillStyle = col
        ctx.globalAlpha = 0.9
        ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bodyH)
        ctx.globalAlpha = 1
        ctx.strokeStyle = col
        ctx.strokeRect(cx - bodyW / 2, bodyTop, bodyW, bodyH)
      } else {
        ctx.fillStyle = '#0b0f14'
        ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bodyH)
        ctx.strokeStyle = col
        ctx.lineWidth = 1.2
        ctx.strokeRect(cx - bodyW / 2, bodyTop, bodyW, bodyH)
      }
    }

    if (last) {
      const ly = yAt(last.c)
      ctx.strokeStyle = priceCol
      ctx.globalAlpha = 0.55
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(chartLeft, ly)
      ctx.lineTo(chartLeft + chartW, ly)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      ctx.fillStyle = priceCol
      ctx.fillRect(priceX - 4, ly - 6, 18, 11)
      ctx.fillStyle = '#0b0e11'
      ctx.font = `bold ${Math.max(6, Math.min(8, Math.round(bw * 0.055)))}px monospace`
      const short = last.c >= 1000 ? last.c.toFixed(0) : last.c.toFixed(Math.min(2, dec))
      ctx.fillText(short.slice(0, 5), priceX - 2, ly + 2)
    }

    const volTop = chartBot + 2
    let maxRange = 0
    const ranges = slice.map((b) => {
      const r = Math.abs(b.h - b.l) || Math.abs(b.c - b.o) || 1e-8
      if (r > maxRange) maxRange = r
      return r
    })
    for (let i = 0; i < slice.length; i++) {
      const b = slice[i]!
      const cx = chartLeft + i * gap + gap * 0.5
      const vh = Math.max(1, (ranges[i]! / maxRange) * volH * 0.9)
      const bull = b.c >= b.o
      ctx.fillStyle = bull ? 'rgba(14,203,129,0.35)' : 'rgba(246,70,93,0.35)'
      ctx.fillRect(cx - bodyW / 2, volTop + volH - vh, bodyW, vh)
    }
  }

  ctx.fillStyle = '#0a0e14'
  ctx.fillRect(left, top + bh - footerH, bw, footerH)
  ctx.fillStyle = '#8b939e'
  ctx.font = `${Math.max(7, Math.min(9, Math.round(bw * 0.06)))}px ui-monospace, monospace`
  ctx.fillText(agentName, left + 4, top + bh - 3)
  if (bias && bias !== 'neutral') {
    const bcol = bias === 'bullish' ? '#0ecb81' : '#f6465d'
    ctx.fillStyle = bcol
    const bl = bias === 'bullish' ? 'LONG' : 'SHORT'
    ctx.fillText(bl, left + bw - ctx.measureText(bl).width - 4, top + bh - 3)
  }
}

function drawBubble(ctx: CanvasRenderingContext2D, sx: number, sy: number, text: string) {
  if (!text) return
  const t = text.length > 42 ? text.slice(0, 40) + '…' : text
  ctx.font = '11px monospace'
  const tw = ctx.measureText(t).width + 14
  const th = 22
  const bx = sx - tw / 2
  const by = sy - 36
  ctx.fillStyle = 'rgba(234,236,239,0.95)'
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1.5
  ctx.fillRect(bx, by, tw, th)
  ctx.strokeRect(bx, by, tw, th)
  ctx.beginPath()
  ctx.moveTo(sx - 4, by + th)
  ctx.lineTo(sx, by + th + 6)
  ctx.lineTo(sx + 4, by + th)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.textAlign = 'center'
  ctx.fillText(t, sx, by + 15)
  ctx.textAlign = 'left'
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  slots: DeskSlot[], agents: AutonomyAgent[],
  selected: string | null, cam: Cam,
  candleMap: Record<string, MiniBar[]>,
  interval: string,
  exchange: string
) {
  ctx.fillStyle = '#0c1014'
  ctx.fillRect(0, 0, w, h)

  const wall = [
    project(FMIN, 0, FMIN, w, h, cam),
    project(FMAX, 0, FMIN, w, h, cam),
    project(FMAX, 3.4, FMIN, w, h, cam),
    project(FMIN, 3.4, FMIN, w, h, cam),
  ]
  ctx.beginPath()
  wall.forEach((c, i) => (i ? ctx.lineTo(c.sx, c.sy) : ctx.moveTo(c.sx, c.sy)))
  ctx.closePath()
  ctx.fillStyle = '#1c242c'
  ctx.fill()
  for (let wi = 0; wi < 4; wi++) {
    const wx0 = FMIN + 0.4 + wi * 2.6
    const wx1 = wx0 + 2.2
    const panes = [
      project(wx0, 0.6, FMIN + 0.05, w, h, cam),
      project(wx1, 0.6, FMIN + 0.05, w, h, cam),
      project(wx1, 3.1, FMIN + 0.05, w, h, cam),
      project(wx0, 3.1, FMIN + 0.05, w, h, cam),
    ]
    ctx.beginPath()
    panes.forEach((c, i) => (i ? ctx.lineTo(c.sx, c.sy) : ctx.moveTo(c.sx, c.sy)))
    ctx.closePath()
    const g = ctx.createLinearGradient(panes[0]!.sx, panes[0]!.sy, panes[0]!.sx, panes[2]!.sy)
    g.addColorStop(0, '#3a5070')
    g.addColorStop(0.5, '#2a3a50')
    g.addColorStop(1, '#1a2838')
    ctx.fillStyle = g
    ctx.fill()
    for (let b = 0; b < 5; b++) {
      const bx = wx0 + 0.15 + b * 0.4
      const bh = 0.8 + (b % 3) * 0.5
      const bp = [
        project(bx, 0.7, FMIN + 0.08, w, h, cam),
        project(bx + 0.28, 0.7, FMIN + 0.08, w, h, cam),
        project(bx + 0.28, 0.7 + bh, FMIN + 0.08, w, h, cam),
        project(bx, 0.7 + bh, FMIN + 0.08, w, h, cam),
      ]
      ctx.beginPath()
      bp.forEach((c, i) => (i ? ctx.lineTo(c.sx, c.sy) : ctx.moveTo(c.sx, c.sy)))
      ctx.closePath()
      ctx.fillStyle = b % 2 ? 'rgba(20,30,45,0.55)' : 'rgba(30,45,65,0.45)'
      ctx.fill()
    }
  }

  drawFloor(ctx, w, h, cam)
  drawDoor(ctx, w, h, cam)
  drawCoffeeMachine(ctx, w, h, cam, agents.some((a) => a.activity === 'coffee'))
  drawWaterCooler(ctx, w, h, cam, agents.some((a) => a.activity === 'water'))

  box(ctx, -2.2, 0, 4.6, 4.4, 1.9, 0.2, '#3a2a40', w, h, cam)
  {
    const p = project(0, 1.2, 4.5, w, h, cam)
    ctx.fillStyle = '#F4D35E'
    ctx.font = `bold ${Math.max(11, Math.round(cam.scale * 0.5))}px monospace`
    ctx.fillText('RESEARCH', p.sx - 34, p.sy)
  }

  const sorted = [...slots].sort((a, b) => {
    const ra = rotXZ(a.homeX, a.homeZ, cam.yaw)
    const rb = rotXZ(b.homeX, b.homeZ, cam.yaw)
    return ra.x + ra.z - (rb.x + rb.z)
  })

  for (const slot of sorted) {
    const x = clamp(slot.homeX)
    const z = clamp(slot.homeZ)
    const ag = agents.find((a) => a.slotId === slot.id)
    const occupied = !!(ag && ag.seated)

    if (slot.isBoss) {
      box(ctx, x - 1.15, 0, z - 1.0, 0.1, 1.7, 1.8, '#6E1423', w, h, cam)
      box(ctx, x + 1.0, 0, z - 1.0, 0.1, 1.7, 1.8, '#6E1423', w, h, cam)
    }

    box(ctx, x - 0.85, 0.02, z - 0.5, 1.7, 0.48, 1.05, '#4a5560', w, h, cam)
    box(ctx, x - 0.85, 0.5, z - 0.5, 1.7, 0.04, 1.05, '#6a7580', w, h, cam)
    box(ctx, x - 0.4, 0.54, z - 0.2, 0.12, 0.18, 0.1, '#2a2a2e', w, h, cam)
    box(ctx, x + 0.25, 0.54, z - 0.2, 0.12, 0.18, 0.1, '#2a2a2e', w, h, cam)
    box(ctx, x - 0.82, 0.7, z - 0.38, 0.78, 0.62, 0.1, '#0a0a0c', w, h, cam)
    box(ctx, x + 0.05, 0.7, z - 0.38, 0.78, 0.62, 0.1, '#0a0a0c', w, h, cam)
    box(ctx, x - 0.25, 0.54, z + 0.15, 0.55, 0.03, 0.22, '#1a1a1e', w, h, cam)
    box(ctx, x + 0.55, 0.54, z + 0.2, 0.08, 0.35, 0.08, '#c8b090', w, h, cam)
    box(ctx, x + 0.48, 0.88, z + 0.12, 0.22, 0.08, 0.2, '#e8d8b0', w, h, cam)
    box(ctx, x - 0.7, 0.54, z + 0.25, 0.14, 0.22, 0.14, '#d0d0d0', w, h, cam)
    box(ctx, x - 0.68, 0.76, z + 0.27, 0.1, 0.12, 0.1, '#e8e8e8', w, h, cam)

    const assetKey = (ag?.asset || 'BTCUSDT').toUpperCase()
    const bars =
      candleMap[assetKey] ||
      (ag ? candleMap[ag.asset] : undefined) ||
      symbolFallback(candleMap)

    const scr1 = project(x - 0.35, 0.98, z - 0.3, w, h, cam)
    const bw = Math.max(78, cam.scale * 2.75)
    const bh = Math.max(58, cam.scale * 2.05)
    drawProMonitor(
      ctx, scr1.sx - bw / 2, scr1.sy - bh / 2, bw, bh,
      assetKey, bars, interval, exchange,
      ag?.name || slot.name, ag?.bias || 'neutral'
    )

    const scr2 = project(x + 0.38, 0.98, z - 0.3, w, h, cam)
    const bw2 = Math.max(64, cam.scale * 2.25)
    const bh2 = Math.max(52, cam.scale * 1.85)
    drawProMonitor(
      ctx, scr2.sx - bw2 / 2, scr2.sy - bh2 / 2, bw2, bh2,
      assetKey, bars ? bars.slice(-10) : undefined, interval, exchange,
      'DEPTH', ag?.bias || 'neutral'
    )

    drawChair(ctx, x, z, w, h, cam, occupied)

    const plate = project(x, 0.08, z + 1.15, w, h, cam)
    const nameFs = Math.max(13, Math.round(cam.scale * 0.55))
    const roleFs = Math.max(10, Math.round(cam.scale * 0.42))
    ctx.font = `bold ${nameFs}px monospace`
    const nameW = ctx.measureText(slot.name).width
    ctx.font = `${roleFs}px monospace`
    const roleW = ctx.measureText(slot.role).width
    const boxW = Math.max(nameW, roleW) + 18
    const boxH = nameFs + roleFs + 12
    const sel = selected === slot.id
    ctx.fillStyle = sel ? 'rgba(244,211,94,0.25)' : 'rgba(0,0,0,0.78)'
    ctx.fillRect(plate.sx - boxW / 2, plate.sy, boxW, boxH)
    ctx.strokeStyle = sel ? '#F4D35E' : 'rgba(255,255,255,0.15)'
    ctx.strokeRect(plate.sx - boxW / 2, plate.sy, boxW, boxH)
    ctx.textAlign = 'center'
    ctx.fillStyle = sel ? '#F4D35E' : '#eaecef'
    ctx.font = `bold ${nameFs}px monospace`
    ctx.fillText(slot.name, plate.sx, plate.sy + nameFs + 2)
    ctx.fillStyle = '#a8b0b8'
    ctx.font = `${roleFs}px monospace`
    ctx.fillText(slot.role, plate.sx, plate.sy + nameFs + roleFs + 4)
    ctx.textAlign = 'left'
  }

  for (const ag of [...agents].sort((a, b) => {
    const ra = rotXZ(a.x, a.z, cam.yaw)
    const rb = rotXZ(b.x, b.z, cam.yaw)
    return ra.x + ra.z - (rb.x + rb.z)
  })) {
    const ax = clamp(ag.x)
    const az = clamp(ag.z)
    const seated =
      !!ag.seated &&
      ['sitting', 'researching', 'strategizing', 'reporting', 'idle'].includes(ag.activity)
    const bob = ag.activity === 'walking' ? Math.sin(Date.now() / 140) * 0.03 : 0
    const skin = '#c9a882'
    const skinDark = '#b08a68'
    const hair = '#6b4a2a'
    const shirt = '#f2f2f0'
    const coat = '#ebe8e0'
    const pants = '#2a2e38'
    const tie = '#1a1a1a'
    const accent = ag.color || '#3a4555'

    if (seated) {
      const yb = bob * 0.12
      box(ctx, ax - 0.14, 0.02, az + 0.18, 0.11, 0.26, 0.14, pants, w, h, cam)
      box(ctx, ax + 0.03, 0.02, az + 0.18, 0.11, 0.26, 0.14, pants, w, h, cam)
      box(ctx, ax - 0.15, 0.0, az + 0.28, 0.12, 0.05, 0.1, '#1a1a1a', w, h, cam)
      box(ctx, ax + 0.03, 0.0, az + 0.28, 0.12, 0.05, 0.1, '#1a1a1a', w, h, cam)
      box(ctx, ax - 0.18, 0.26 + yb, az + 0.06, 0.36, 0.44, 0.22, coat, w, h, cam)
      box(ctx, ax - 0.1, 0.3 + yb, az + 0.04, 0.2, 0.36, 0.06, shirt, w, h, cam)
      box(ctx, ax - 0.03, 0.42 + yb, az + 0.03, 0.06, 0.22, 0.04, tie, w, h, cam)
      box(ctx, ax - 0.1, 0.64 + yb, az + 0.05, 0.2, 0.05, 0.06, shirt, w, h, cam)
      box(ctx, ax - 0.2, 0.58 + yb, az + 0.08, 0.1, 0.12, 0.14, coat, w, h, cam)
      box(ctx, ax + 0.1, 0.58 + yb, az + 0.08, 0.1, 0.12, 0.14, coat, w, h, cam)
      box(ctx, ax - 0.26, 0.42 + yb, az + 0.0, 0.1, 0.14, 0.18, coat, w, h, cam)
      box(ctx, ax + 0.16, 0.42 + yb, az + 0.0, 0.1, 0.14, 0.18, coat, w, h, cam)
      box(ctx, ax - 0.24, 0.48 + yb, az - 0.12, 0.1, 0.07, 0.26, coat, w, h, cam)
      box(ctx, ax + 0.14, 0.48 + yb, az - 0.12, 0.1, 0.07, 0.26, coat, w, h, cam)
      box(ctx, ax - 0.22, 0.52 + yb, az - 0.18, 0.09, 0.05, 0.1, skin, w, h, cam)
      box(ctx, ax + 0.13, 0.52 + yb, az - 0.18, 0.09, 0.05, 0.1, skin, w, h, cam)
      box(ctx, ax - 0.06, 0.68 + yb, az + 0.1, 0.12, 0.08, 0.1, skinDark, w, h, cam)
      box(ctx, ax - 0.11, 0.74 + yb, az + 0.08, 0.22, 0.24, 0.2, skin, w, h, cam)
      box(ctx, ax - 0.09, 0.74 + yb, az + 0.06, 0.18, 0.08, 0.04, skinDark, w, h, cam)
      box(ctx, ax - 0.12, 0.94 + yb, az + 0.07, 0.24, 0.08, 0.22, hair, w, h, cam)
      box(ctx, ax - 0.13, 0.8 + yb, az + 0.16, 0.06, 0.16, 0.1, hair, w, h, cam)
      box(ctx, ax + 0.07, 0.8 + yb, az + 0.16, 0.06, 0.16, 0.1, hair, w, h, cam)
      box(ctx, ax - 0.13, 0.86 + yb, az + 0.04, 0.26, 0.035, 0.05, '#1a1a1a', w, h, cam)
      box(ctx, ax - 0.11, 0.855 + yb, az + 0.03, 0.1, 0.04, 0.03, 'rgba(180,200,220,0.35)', w, h, cam)
      box(ctx, ax + 0.01, 0.855 + yb, az + 0.03, 0.1, 0.04, 0.03, 'rgba(180,200,220,0.35)', w, h, cam)
      box(ctx, ax - 0.14, 0.84 + yb, az + 0.12, 0.04, 0.08, 0.04, skinDark, w, h, cam)
      box(ctx, ax + 0.1, 0.84 + yb, az + 0.12, 0.04, 0.08, 0.04, skinDark, w, h, cam)
    } else {
      box(ctx, ax - 0.11, 0.02 + bob, az - 0.05, 0.1, 0.34, 0.12, pants, w, h, cam)
      box(ctx, ax + 0.01, 0.02 - bob, az - 0.05, 0.1, 0.34, 0.12, pants, w, h, cam)
      box(ctx, ax - 0.12, 0.0, az + 0.05, 0.11, 0.05, 0.1, '#1a1a1a', w, h, cam)
      box(ctx, ax + 0.01, 0.0, az + 0.05, 0.11, 0.05, 0.1, '#1a1a1a', w, h, cam)
      box(ctx, ax - 0.17, 0.34, az - 0.1, 0.34, 0.42, 0.2, coat, w, h, cam)
      box(ctx, ax - 0.09, 0.38, az - 0.12, 0.18, 0.34, 0.06, shirt, w, h, cam)
      box(ctx, ax - 0.03, 0.48, az - 0.13, 0.06, 0.2, 0.04, tie, w, h, cam)
      box(ctx, ax - 0.22, 0.4, az - 0.08, 0.08, 0.28, 0.1, coat, w, h, cam)
      box(ctx, ax + 0.14, 0.4, az - 0.08, 0.08, 0.28, 0.1, coat, w, h, cam)
      box(ctx, ax - 0.06, 0.74, az - 0.08, 0.12, 0.08, 0.1, skinDark, w, h, cam)
      box(ctx, ax - 0.11, 0.8, az - 0.1, 0.22, 0.24, 0.2, skin, w, h, cam)
      box(ctx, ax - 0.12, 1.0, az - 0.1, 0.24, 0.08, 0.22, hair, w, h, cam)
      box(ctx, ax - 0.13, 0.92, az - 0.14, 0.26, 0.035, 0.05, '#1a1a1a', w, h, cam)
    }

    const headY = seated ? 1.12 + bob * 0.12 : 1.12
    const p = project(ax, headY, az + (seated ? 0.12 : -0.05), w, h, cam)
    if (ag.activity === 'coffee' || ag.activity === 'water') {
      ctx.font = '14px sans-serif'
      ctx.fillText(ag.activity === 'coffee' ? '☕' : '💧', p.sx - 6, p.sy - 30)
    }
    {
      const tag = (ag.asset || '—').toUpperCase()
      ctx.font = 'bold 11px monospace'
      const tw = ctx.measureText(tag).width + 14
      ctx.fillStyle = 'rgba(0,0,0,0.88)'
      ctx.fillRect(p.sx - tw / 2, p.sy - 30, tw, 16)
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.5
      ctx.strokeRect(p.sx - tw / 2, p.sy - 30, tw, 16)
      ctx.fillStyle = '#F4D35E'
      ctx.textAlign = 'center'
      ctx.fillText(tag, p.sx, p.sy - 18)
      ctx.textAlign = 'left'
    }
    if (ag.chatLine) drawBubble(ctx, p.sx, p.sy - 34, ag.chatLine)
  }

  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(8, h - 28, 420, 20)
  ctx.fillStyle = '#9aa3ad'
  ctx.font = '11px monospace'
  ctx.fillText(
    `drag=pan · Shift=gira · zoom · ${interval} · ${(exchange || 'binance').toUpperCase()}`,
    12,
    h - 14
  )
}

export function Office3D({
  slots,
  agentsLiveRef,
  selectedSlotId,
  onSelectSlot,
  candleMap,
  interval = '15m',
  exchange = 'binance',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef(slots)
  const selRef = useRef(selectedSlotId)
  const clickRef = useRef(onSelectSlot)
  const mapRef = useRef(candleMap || {})
  const metaRef = useRef({ interval, exchange })
  const camRef = useRef<Cam>({ ox: 0, oy: 0, scale: 30, yaw: 0 })
  slotsRef.current = slots
  selRef.current = selectedSlotId
  clickRef.current = onSelectSlot
  mapRef.current = candleMap || {}
  metaRef.current = { interval, exchange }

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
      const ch = Math.max(280, r.height || 340)
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
          paint(
            ctx, canvas.width, canvas.height,
            slotsRef.current, live, selRef.current, camRef.current,
            mapRef.current, metaRef.current.interval, metaRef.current.exchange
          )
        }
      } catch { /* */ }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onDown = (e: PointerEvent) => {
      dragging = true; moved = false; lx = e.clientX; ly = e.clientY
      mode = e.button === 2 || e.shiftKey || e.altKey || e.metaKey ? 'orbit' : 'pan'
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lx; const dy = e.clientY - ly
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (mode === 'orbit') {
        camRef.current.yaw += dx * 0.008
        camRef.current.oy += dy * dpr * 0.35
      } else {
        camRef.current.ox += dx * dpr
        camRef.current.oy += dy * dpr
      }
      lx = e.clientX; ly = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* */ }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camRef.current.scale = Math.max(16, Math.min(55, camRef.current.scale * (e.deltaY > 0 ? 0.92 : 1.08)))
    }
    const onContext = (e: Event) => e.preventDefault()
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
    const onDbl = () => { camRef.current = { ox: 0, oy: 0, scale: 30, yaw: 0 } }

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
        height: 400,
        minHeight: 340,
        background: '#0c1014',
        boxShadow: 'inset 0 0 0 2px #1a1a1a',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grab',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', background: '#0c1014', touchAction: 'none' }}
      />
    </div>
  )
}
