/**
 * Professional 3D scene renderer — pure Canvas2D perspective.
 * Orbit: drag · Zoom: wheel · Real data only.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { Viz3DConfig, Viz3DModel } from './types'
import { project, columnCorners, type Camera3D, type Vec3 } from './math3d'

interface Viz3DSceneProps {
  model: Viz3DModel
  config: Viz3DConfig
  onCameraChange?: (patch: Partial<Viz3DConfig>) => void
  className?: string
}

const THEMES = {
  desk: {
    bg: '#0b0e11',
    grid: 'rgba(43,49,57,0.55)',
    buy: '#0ecb81',
    sell: '#f6465d',
    wick: '#848e9c',
    label: '#5e6673',
    accent: '#f0b90b',
    face: 'rgba(30,35,41,0.9)',
  },
  neon: {
    bg: '#05070a',
    grid: 'rgba(96,165,250,0.25)',
    buy: '#22d3ee',
    sell: '#e879f9',
    wick: '#64748b',
    label: '#94a3b8',
    accent: '#60a5fa',
    face: 'rgba(15,23,42,0.85)',
  },
  mono: {
    bg: '#0c0c0c',
    grid: 'rgba(80,80,80,0.4)',
    buy: '#eaecef',
    sell: '#848e9c',
    wick: '#5e6673',
    label: '#5e6673',
    accent: '#eaecef',
    face: 'rgba(28,28,28,0.9)',
  },
}

function normPrice(p: number, min: number, max: number) {
  if (!(max > min)) return 0
  return ((p - min) / (max - min)) * 1.6 - 0.8
}

export function Viz3DScene({
  model,
  config,
  onCameraChange,
  className = '',
}: Viz3DSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(
    null
  )
  const cfgRef = useRef(config)
  cfgRef.current = config
  const modelRef = useRef(model)
  modelRef.current = model

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    const w = parent?.clientWidth ?? canvas.clientWidth
    const h = parent?.clientHeight ?? canvas.clientHeight
    if (w < 8 || h < 8) return
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cfg = cfgRef.current
    const m = modelRef.current
    const theme = THEMES[cfg.theme] ?? THEMES.desk
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, w, h)

    const cam: Camera3D = {
      yaw: cfg.yaw,
      pitch: cfg.pitch,
      zoom: cfg.zoom,
      focal: 3.2,
    }
    const cx = w * 0.5
    const cy = h * 0.55
    const op = Math.max(0.25, Math.min(1, cfg.opacity))

    const drawPoly = (pts: Vec3[], fill: string, stroke?: string) => {
      const scr = pts.map((p) => project(p, cam, cx, cy))
      // back-face approx by average depth
      scr.sort(() => 0) // keep order
      ctx.beginPath()
      scr.forEach((s, i) => {
        if (i === 0) ctx.moveTo(s.x, s.y)
        else ctx.lineTo(s.x, s.y)
      })
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }

    // Grid floor
    if (cfg.showGrid) {
      ctx.strokeStyle = theme.grid
      ctx.lineWidth = 1
      for (let i = -5; i <= 5; i++) {
        const a = project({ x: i * 0.22, y: -0.85, z: -1.1 }, cam, cx, cy)
        const b = project({ x: i * 0.22, y: -0.85, z: 1.1 }, cam, cx, cy)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        const c = project({ x: -1.1, y: -0.85, z: i * 0.22 }, cam, cx, cy)
        const d = project({ x: 1.1, y: -0.85, z: i * 0.22 }, cam, cx, cy)
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(d.x, d.y)
        ctx.stroke()
      }
    }

    if (!m.ready) {
      ctx.fillStyle = theme.label
      ctx.font = '12px ui-monospace, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(m.note || 'No data', w / 2, h / 2)
      return
    }

    if (m.mode === 'volume_terrain' && m.terrain.length) {
      // Sort by depth for painter's algorithm
      const cells = [...m.terrain].sort((a, b) => {
        const da = project({ x: a.tx, y: -0.8 + a.h * 0.9, z: a.ty * 0.7 }, cam, cx, cy)
          .depth
        const db = project({ x: b.tx, y: -0.8 + b.h * 0.9, z: b.ty * 0.7 }, cam, cx, cy)
          .depth
        return db - da
      })
      const cellW = 1.8 / Math.max(8, cfg.maxBars) * 0.85
      const cellD = 1.4 / Math.max(8, cfg.priceBins) * 0.9
      for (const cell of cells) {
        const base = -0.85
        const hgt = Math.max(0.02, cell.h * 0.95)
        const corners = columnCorners(cell.tx, base, cellW, cellD, hgt)
        // shift Z by ty
        const shifted = corners.map((p) => ({ ...p, z: p.z + cell.ty * 0.75 }))
        const buy = cell.buyFrac >= 0.5
        const col = buy ? theme.buy : theme.sell
        // top face brighter
        const top = [shifted[4], shifted[5], shifted[6], shifted[7]]
        const front = [shifted[0], shifted[1], shifted[5], shifted[4]]
        const side = [shifted[1], shifted[2], shifted[6], shifted[5]]
        drawPoly(side, hexAlpha(col, 0.25 * op))
        drawPoly(front, hexAlpha(col, 0.4 * op))
        drawPoly(top, hexAlpha(col, 0.7 * op), hexAlpha(col, 0.9))
      }
    }

    if (m.mode === 'candle_columns' && m.candles.length) {
      const sorted = [...m.candles].sort((a, b) => {
        const da = project({ x: a.tx, y: 0, z: 0 }, cam, cx, cy).depth
        const db = project({ x: b.tx, y: 0, z: 0 }, cam, cx, cy).depth
        return db - da
      })
      const bw = 1.8 / Math.max(8, sorted.length) * 0.7
      for (const c of sorted) {
        const yOpen = normPrice(c.open, m.priceMin, m.priceMax)
        const yClose = normPrice(c.close, m.priceMin, m.priceMax)
        const yHigh = normPrice(c.high, m.priceMin, m.priceMax)
        const yLow = normPrice(c.low, m.priceMin, m.priceMax)
        const bodyLo = Math.min(yOpen, yClose)
        const bodyHi = Math.max(yOpen, yClose)
        const bodyH = Math.max(0.02, bodyHi - bodyLo)
        const col = c.bull ? theme.buy : theme.sell
        // wick
        const wickTop = project({ x: c.tx, y: yHigh, z: 0 }, cam, cx, cy)
        const wickBot = project({ x: c.tx, y: yLow, z: 0 }, cam, cx, cy)
        ctx.strokeStyle = theme.wick
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(wickTop.x, wickTop.y)
        ctx.lineTo(wickBot.x, wickBot.y)
        ctx.stroke()
        // body column
        const volH = (c.volume / m.volMax) * 0.35
        const corners = columnCorners(c.tx, bodyLo, bw, 0.12 + volH * 0.5, bodyH)
        const top = [corners[4], corners[5], corners[6], corners[7]]
        const front = [corners[0], corners[1], corners[5], corners[4]]
        const side = [corners[1], corners[2], corners[6], corners[5]]
        drawPoly(side, hexAlpha(col, 0.35 * op))
        drawPoly(front, hexAlpha(col, 0.55 * op))
        drawPoly(top, hexAlpha(col, 0.85 * op), hexAlpha(col, 1))
      }
    }

    if (m.mode === 'book_depth' && m.book.length) {
      const sorted = [...m.book].sort((a, b) => {
        const da = project({ x: a.side, y: a.ty, z: 0 }, cam, cx, cy).depth
        const db = project({ x: b.side, y: b.ty, z: 0 }, cam, cx, cy).depth
        return db - da
      })
      for (const bar of sorted) {
        const col = bar.isBid ? theme.buy : theme.sell
        const hgt = Math.max(0.03, bar.h * 0.9)
        const corners = columnCorners(bar.side * 0.95, -0.85, 0.08, 0.1, hgt)
        const shifted = corners.map((p) => ({ ...p, z: p.z + bar.ty * 0.5 }))
        const top = [shifted[4], shifted[5], shifted[6], shifted[7]]
        const front = [shifted[0], shifted[1], shifted[5], shifted[4]]
        drawPoly(front, hexAlpha(col, 0.45 * op))
        drawPoly(top, hexAlpha(col, 0.8 * op), hexAlpha(col, 1))
      }
      // mid line
      const midA = project({ x: 0, y: -0.85, z: -0.9 }, cam, cx, cy)
      const midB = project({ x: 0, y: -0.85, z: 0.9 }, cam, cx, cy)
      ctx.strokeStyle = theme.accent
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(midA.x, midA.y)
      ctx.lineTo(midB.x, midB.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // HUD
    if (cfg.showLabels) {
      ctx.fillStyle = 'rgba(11,14,17,0.75)'
      ctx.fillRect(8, 8, Math.min(320, w - 16), 36)
      ctx.font = '11px ui-monospace, Menlo, monospace'
      ctx.fillStyle = theme.accent
      ctx.textAlign = 'left'
      ctx.fillText(m.note, 14, 22)
      ctx.fillStyle = theme.label
      ctx.fillText(
        `yaw ${cfg.yaw.toFixed(0)}° · pitch ${cfg.pitch.toFixed(0)}° · zoom ${cfg.zoom.toFixed(2)} · drag orbit · wheel zoom`,
        14,
        36
      )
    }
  }, [])

  useEffect(() => {
    paint()
  }, [model, config, paint])

  useEffect(() => {
    if (!config.autoRotate) return
    let raf = 0
    const tick = () => {
      const c = cfgRef.current
      onCameraChange?.({ yaw: (c.yaw + c.autoRotateSpeed) % 360 })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [config.autoRotate, config.autoRotateSpeed, onCameraChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        yaw: cfgRef.current.yaw,
        pitch: cfgRef.current.pitch,
      }
    }
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dyaw = (e.clientX - d.x) * 0.35
      const dpitch = (e.clientY - d.y) * 0.25
      onCameraChange?.({
        yaw: d.yaw + dyaw,
        pitch: Math.max(5, Math.min(80, d.pitch + dpitch)),
      })
    }
    const onUp = () => {
      dragRef.current = null
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const z = cfgRef.current.zoom
      const next = Math.max(0.45, Math.min(2.4, z * (e.deltaY > 0 ? 0.92 : 1.08)))
      onCameraChange?.({ zoom: next })
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(() => paint())
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      ro.disconnect()
    }
  }, [onCameraChange, paint])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full touch-none cursor-grab active:cursor-grabbing ${className}`}
      aria-label="3D market scene"
    />
  )
}

function hexAlpha(hex: string, a: number): string {
  if (hex.startsWith('rgba')) return hex
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${a})`
}
