/**
 * 3D trading office floor — canvas perspective, autonomous walking agents,
 * desks with live strategy screens, boss corner.
 */

import { useEffect, useRef } from 'react'
import type { AutonomyAgent, DeskSlot } from './autonomy'

type Props = {
  slots: DeskSlot[]
  agents: AutonomyAgent[]
  selectedSlotId: string | null
  onSelectSlot: (id: string) => void
}

function project(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  cam = { x: 0, y: 14, z: 16, fov: 320 }
) {
  const dx = x - cam.x
  const dy = y - cam.y
  const dz = z - cam.z
  const pitch = 0.55
  const cy = dy * Math.cos(pitch) - dz * Math.sin(pitch)
  const cz = dy * Math.sin(pitch) + dz * Math.cos(pitch)
  const depth = -cz
  if (depth < 0.5) return null
  const s = cam.fov / depth
  return {
    sx: w * 0.5 + dx * s,
    sy: h * 0.42 + cy * s,
    scale: s,
    depth,
  }
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
  shade = 1
) {
  const corners = [
    [x, y, z],
    [x + sx, y, z],
    [x + sx, y, z + sz],
    [x, y, z + sz],
    [x, y + sy, z],
    [x + sx, y + sy, z],
    [x + sx, y + sy, z + sz],
    [x, y + sy, z + sz],
  ].map(([a, b, c]) => project(a!, b!, c!, w, h))
  if (corners.some((c) => !c)) return
  const p = corners as NonNullable<(typeof corners)[0]>[]

  const face = (idx: number[], mul: number) => {
    ctx.beginPath()
    idx.forEach((i, k) => {
      const c = p[i]!
      if (k === 0) ctx.moveTo(c.sx, c.sy)
      else ctx.lineTo(c.sx, c.sy)
    })
    ctx.closePath()
    ctx.fillStyle = shadeColor(color, mul * shade)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  face([3, 2, 6, 7], 0.55)
  face([0, 3, 7, 4], 0.7)
  face([1, 2, 6, 5], 0.85)
  face([4, 5, 6, 7], 1.05)
}

function shadeColor(hex: string, m: number) {
  const n = hex.replace('#', '')
  const v = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16)
  const r = Math.min(255, Math.max(0, Math.round(((v >> 16) & 255) * m)))
  const g = Math.min(255, Math.max(0, Math.round(((v >> 8) & 255) * m)))
  const b = Math.min(255, Math.max(0, Math.round((v & 255) * m)))
  return `rgb(${r},${g},${b})`
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const tiles: { x: number; z: number; depth: number }[] = []
  for (let xi = -7; xi <= 7; xi++) {
    for (let zi = -6; zi <= 7; zi++) {
      const p = project(xi, 0, zi, w, h)
      if (p) tiles.push({ x: xi, z: zi, depth: p.depth })
    }
  }
  tiles.sort((a, b) => b.depth - a.depth)
  for (const t of tiles) {
    const c = ((t.x + t.z) & 1) === 0 ? '#3a4540' : '#323c38'
    drawBox(ctx, t.x, 0, t.z, 1, 0.08, 1, c, w, h, 1)
  }
}

function drawDesk(
  ctx: CanvasRenderingContext2D,
  slot: DeskSlot,
  agent: AutonomyAgent | undefined,
  w: number,
  h: number,
  selected: boolean
) {
  const x = slot.homeX
  const z = slot.homeZ
  drawBox(ctx, x - 0.7, 0.08, z - 0.45, 1.4, 0.55, 0.9, '#6b4f2a', w, h)
  drawBox(ctx, x - 0.35, 0.65, z - 0.35, 0.7, 0.55, 0.12, '#1a1a1a', w, h)
  const screen = project(x, 0.95, z - 0.28, w, h)
  if (screen && agent) {
    const glow =
      agent.activity === 'strategizing' || agent.activity === 'researching'
        ? agent.bias === 'bullish'
          ? '#0ecb81'
          : agent.bias === 'bearish'
            ? '#f6465d'
            : '#F4D35E'
        : '#1e3a2f'
    ctx.fillStyle = glow
    ctx.globalAlpha = 0.85
    ctx.fillRect(screen.sx - 14, screen.sy - 10, 28, 16)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#0b0e11'
    ctx.font = `${Math.max(7, screen.scale * 0.08)}px monospace`
    ctx.fillText(agent.screenLine.slice(0, 16), screen.sx - 13, screen.sy + 2)
  }
  const plate = project(x, 0.7, z + 0.5, w, h)
  if (plate) {
    ctx.fillStyle = selected ? '#F4D35E' : '#eaecef'
    ctx.font = 'bold 9px monospace'
    ctx.fillText(slot.name, plate.sx - 16, plate.sy)
    ctx.fillStyle = '#848e9c'
    ctx.font = '8px monospace'
    ctx.fillText(slot.role, plate.sx - 16, plate.sy + 10)
  }
  if (slot.isBoss) {
    drawBox(ctx, x - 1.4, 0, z - 1.2, 0.12, 2.2, 2.2, '#6E1423', w, h, 0.9)
    drawBox(ctx, x + 1.2, 0, z - 1.2, 0.12, 2.2, 2.2, '#6E1423', w, h, 0.9)
  }
}

function drawAgent(
  ctx: CanvasRenderingContext2D,
  ag: AutonomyAgent,
  w: number,
  h: number
) {
  const bob = ag.activity === 'walking' ? Math.sin(Date.now() / 120) * 0.06 : 0
  const baseY = 0.08 + bob
  drawBox(ctx, ag.x - 0.18, baseY, ag.z - 0.12, 0.36, 0.7, 0.24, ag.color, w, h)
  drawBox(ctx, ag.x - 0.14, baseY + 0.7, ag.z - 0.1, 0.28, 0.28, 0.2, '#e8c4a0', w, h)
  const p = project(ag.x, baseY + 1.2, ag.z, w, h)
  if (p) {
    const label =
      ag.activity === 'researching'
        ? 'R'
        : ag.activity === 'strategizing'
          ? 'S'
          : ag.activity === 'reporting'
            ? 'M'
            : ag.activity === 'walking'
              ? '.'
              : ''
    if (label) {
      ctx.font = '12px monospace'
      ctx.fillStyle = '#F4D35E'
      ctx.fillText(label, p.sx - 4, p.sy)
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(p.sx - 22, p.sy - 22, 44, 12)
    ctx.fillStyle = '#F4D35E'
    ctx.font = '8px monospace'
    ctx.fillText(ag.asset, p.sx - 20, p.sy - 13)
  }
}

function drawResearchWall(ctx: CanvasRenderingContext2D, w: number, h: number) {
  drawBox(ctx, -2.5, 0, 5.2, 5, 2.4, 0.2, '#2a2030', w, h)
  const p = project(0, 1.5, 5.1, w, h)
  if (p) {
    ctx.fillStyle = '#F4D35E'
    ctx.font = 'bold 11px monospace'
    ctx.fillText('RESEARCH BOARD', p.sx - 50, p.sy)
    ctx.fillStyle = '#848e9c'
    ctx.font = '9px monospace'
    ctx.fillText('multi-asset · paper only', p.sx - 50, p.sy + 12)
  }
}

function drawStrategyBoard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  drawBox(ctx, 4.2, 0, -3.2, 0.2, 2.2, 3.5, '#1e2a3a', w, h)
  const p = project(4.3, 1.4, -1.5, w, h)
  if (p) {
    ctx.fillStyle = '#3b82f6'
    ctx.font = 'bold 10px monospace'
    ctx.fillText('STRATEGIES', p.sx - 20, p.sy)
  }
}

export function Office3D({ slots, agents, selectedSlotId, onSelectSlot }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const parent = wrap.current
    if (!canvas || !parent) return
    let raf = 0
    let running = true

    const resize = () => {
      const r = parent.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(320, Math.floor(r.width * dpr))
      canvas.height = Math.max(220, Math.floor(r.height * dpr))
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    const paint = () => {
      if (!running) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const w = canvas.width
      const h = canvas.height
      ctx.fillStyle = '#0d1210'
      ctx.fillRect(0, 0, w, h)

      drawFloor(ctx, w, h)
      drawResearchWall(ctx, w, h)
      drawStrategyBoard(ctx, w, h)

      const byDepth = [...slots].sort((a, b) => b.homeZ - a.homeZ)
      for (const s of byDepth) {
        const ag = agents.find((x) => x.slotId === s.id)
        drawDesk(ctx, s, ag, w, h, selectedSlotId === s.id)
      }

      const agentsSorted = [...agents].sort((a, b) => b.z - a.z)
      for (const ag of agentsSorted) drawAgent(ctx, ag, w, h)

      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.35)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      raf = requestAnimationFrame(paint)
    }
    raf = requestAnimationFrame(paint)

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = ((e.clientX - rect.left) / rect.width) * canvas.width
      const my = ((e.clientY - rect.top) / rect.height) * canvas.height
      let best: { id: string; d: number } | null = null
      for (const s of slots) {
        const p = project(s.homeX, 0.5, s.homeZ, canvas.width, canvas.height)
        if (!p) continue
        const d = (p.sx - mx) ** 2 + (p.sy - my) ** 2
        if (!best || d < best.d) best = { id: s.id, d }
      }
      if (best && best.d < 40 * 40) onSelectSlot(best.id)
    }
    canvas.addEventListener('click', onClick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
    }
  }, [slots, agents, selectedSlotId, onSelectSlot])

  return (
    <div
      ref={wrap}
      style={{
        width: '100%',
        height: 280,
        minHeight: 220,
        background: '#0d1210',
        boxShadow: 'inset 0 0 0 2px #1a1a1a',
        position: 'relative',
      }}
    >
      <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'absolute',
          left: 8,
          top: 8,
          fontSize: 9,
          fontFamily: 'ui-monospace, monospace',
          color: '#F4D35E',
          background: 'rgba(110,20,35,0.85)',
          padding: '3px 8px',
          boxShadow: '2px 2px 0 #1a1a1a',
        }}
      >
        3D FLOOR · AUTO AGENTS
      </div>
    </div>
  )
}
