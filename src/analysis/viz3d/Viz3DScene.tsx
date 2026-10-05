/**
 * Professional 3D scene — Canvas2D perspective.
 * Deep DOM: liquidity walls + aggressor trade bubbles (Deep Chart style).
 */

import { useCallback, useEffect, useRef } from 'react'
import type { Viz3DConfig, Viz3DModel } from './types'
import { DEFAULT_DOM3D_OPTIONS } from './types'
import { project, columnCorners, type Camera3D, type Vec3 } from './math3d'
import { VIZ3D_THEMES } from './themes'
import type { Drawing } from '@/drawings/types'

interface Viz3DSceneProps {
  model: Viz3DModel
  config: Viz3DConfig
  drawings?: Drawing[]
  onCameraChange?: (patch: Partial<Viz3DConfig>) => void
  className?: string
}

const THEMES = VIZ3D_THEMES

function normPrice(p: number, min: number, max: number) {
  if (!(max > min)) return 0
  return ((p - min) / (max - min)) * 1.6 - 0.8
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

function fmtQuote(q: number): string {
  if (q >= 1_000_000) return (q / 1_000_000).toFixed(1) + 'M'
  if (q >= 1_000) return (q / 1_000).toFixed(1) + 'k'
  return q.toFixed(0)
}

export function Viz3DScene({
  model,
  config,
  drawings = [],
  onCameraChange,
  className = '',
}: Viz3DSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)
  const cfgRef = useRef(config)
  cfgRef.current = config
  const modelRef = useRef(model)
  modelRef.current = model
  const drawingsRef = useRef(drawings)
  drawingsRef.current = drawings

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
    const theme = THEMES[cfg.theme as keyof typeof THEMES] ?? THEMES.desk
    const dom = cfg.dom ?? DEFAULT_DOM3D_OPTIONS
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, w, h)

    const cam: Camera3D = { yaw: cfg.yaw, pitch: cfg.pitch, zoom: cfg.zoom, focal: 3.2 }
    const cx = w * 0.5
    const cy = h * 0.55
    const op = Math.max(0.25, Math.min(1, cfg.opacity))

    const drawPoly = (pts: Vec3[], fill: string, stroke?: string) => {
      const scr = pts.map((p) => project(p, cam, cx, cy))
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

    if (cfg.showGrid && m.mode !== 'dom_ladder') {
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
      const cells = [...m.terrain].sort((a, b) => {
        const da = project({ x: a.tx, y: -0.8 + a.h * 0.9, z: a.ty * 0.7 }, cam, cx, cy).depth
        const db = project({ x: b.tx, y: -0.8 + b.h * 0.9, z: b.ty * 0.7 }, cam, cx, cy).depth
        return db - da
      })
      const cellW = (1.8 / Math.max(8, cfg.maxBars)) * 0.85
      const cellD = (1.4 / Math.max(8, cfg.priceBins)) * 0.9
      for (const cell of cells) {
        const hgt = Math.max(0.02, cell.h * 0.95)
        const corners = columnCorners(cell.tx, -0.85, cellW, cellD, hgt)
        const shifted = corners.map((p) => ({ ...p, z: p.z + cell.ty * 0.75 }))
        const col = cell.buyFrac >= 0.5 ? theme.buy : theme.sell
        drawPoly([shifted[1], shifted[2], shifted[6], shifted[5]], hexAlpha(col, 0.25 * op))
        drawPoly([shifted[0], shifted[1], shifted[5], shifted[4]], hexAlpha(col, 0.4 * op))
        drawPoly([shifted[4], shifted[5], shifted[6], shifted[7]], hexAlpha(col, 0.7 * op), hexAlpha(col, 0.9))
      }
    }

    if (m.mode === 'candle_columns' && m.candles.length) {
      const sorted = [...m.candles].sort((a, b) => {
        const da = project({ x: a.tx, y: 0, z: 0 }, cam, cx, cy).depth
        const db = project({ x: b.tx, y: 0, z: 0 }, cam, cx, cy).depth
        return db - da
      })
      const bw = (1.8 / Math.max(8, sorted.length)) * 0.7
      for (const c of sorted) {
        const yOpen = normPrice(c.open, m.priceMin, m.priceMax)
        const yClose = normPrice(c.close, m.priceMin, m.priceMax)
        const yHigh = normPrice(c.high, m.priceMin, m.priceMax)
        const yLow = normPrice(c.low, m.priceMin, m.priceMax)
        const bodyLo = Math.min(yOpen, yClose)
        const bodyH = Math.max(0.02, Math.abs(yClose - yOpen))
        const col = c.bull ? theme.buy : theme.sell
        const wickTop = project({ x: c.tx, y: yHigh, z: 0 }, cam, cx, cy)
        const wickBot = project({ x: c.tx, y: yLow, z: 0 }, cam, cx, cy)
        ctx.strokeStyle = theme.wick
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(wickTop.x, wickTop.y)
        ctx.lineTo(wickBot.x, wickBot.y)
        ctx.stroke()
        const volH = (c.volume / m.volMax) * 0.35
        const corners = columnCorners(c.tx, bodyLo, bw, 0.12 + volH * 0.5, bodyH)
        drawPoly([corners[1], corners[2], corners[6], corners[5]], hexAlpha(col, 0.35 * op))
        drawPoly([corners[0], corners[1], corners[5], corners[4]], hexAlpha(col, 0.55 * op))
        drawPoly([corners[4], corners[5], corners[6], corners[7]], hexAlpha(col, 0.85 * op), hexAlpha(col, 1))
      }
    }

    if (m.mode === 'book_depth' && m.book.length) {
      for (const bar of m.book) {
        const col = bar.isBid ? theme.buy : theme.sell
        const hgt = Math.max(0.03, bar.h * 0.9)
        const corners = columnCorners(bar.side * 0.95, -0.85, 0.08, 0.1, hgt)
        const shifted = corners.map((p) => ({ ...p, z: p.z + bar.ty * 0.5 }))
        drawPoly([shifted[0], shifted[1], shifted[5], shifted[4]], hexAlpha(col, 0.45 * op))
        drawPoly([shifted[4], shifted[5], shifted[6], shifted[7]], hexAlpha(col, 0.8 * op), hexAlpha(col, 1))
      }
    }

    if (m.mode === 'dom_ladder') {
      const wallOp = (dom.wallOpacity ?? 0.75) * op
      if (dom.showWalls && m.dom?.length) {
        for (const row of m.dom) {
          const y = row.ty * 0.85
          const rowH = 0.08
          if (row.bidH > 0.001) {
            const len = Math.max(0.04, row.bidH * 1.05)
            const corners = columnCorners(-len / 2 - 0.02, y - rowH / 2, len, 0.1, rowH)
            drawPoly([corners[0], corners[1], corners[5], corners[4]], hexAlpha(theme.buy, 0.45 * wallOp))
            drawPoly([corners[4], corners[5], corners[6], corners[7]], hexAlpha(theme.buy, 0.8 * wallOp), hexAlpha(theme.buy, 1))
          }
          if (row.askH > 0.001) {
            const len = Math.max(0.04, row.askH * 1.05)
            const corners = columnCorners(len / 2 + 0.02, y - rowH / 2, len, 0.1, rowH)
            drawPoly([corners[0], corners[1], corners[5], corners[4]], hexAlpha(theme.sell, 0.45 * wallOp))
            drawPoly([corners[4], corners[5], corners[6], corners[7]], hexAlpha(theme.sell, 0.8 * wallOp), hexAlpha(theme.sell, 1))
          }
        }
      }
    }

    // --- Drawings (horizontal / trendline) in world space ---
    const dlist = drawingsRef.current ?? []
    if (dlist.length && m.priceMax > m.priceMin) {
      const yOf = (price: number) =>
        (((price - m.priceMin) / (m.priceMax - m.priceMin)) * 2 - 1) * 0.85
      const tOf = (time: number) => {
        const bars = m.candles
        if (bars && bars.length >= 2) {
          const t0 = bars[0].time
          const t1 = bars[bars.length - 1].time
          if (t1 > t0) return ((time - t0) / (t1 - t0)) * 2 - 1
        }
        return 0
      }
      for (const d of dlist) {
        ctx.lineWidth = Math.max(1, d.style?.lineWidth ?? 1.5)
        ctx.strokeStyle = d.style?.color ?? '#1e90ff'
        ctx.fillStyle = d.style?.color ?? '#1e90ff'
        if (d.tool === 'horizontal') {
          const y = yOf((d as { price: number }).price)
          const a = project({ x: -1.15, y, z: -0.4 }, cam, cx, cy)
          const b = project({ x: 1.15, y, z: 0.4 }, cam, cx, cy)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          ctx.font = '10px ui-monospace, Menlo, monospace'
          ctx.textAlign = 'left'
          ctx.fillText((d as { price: number }).price.toPrecision(6), b.x + 4, b.y - 2)
        } else if (d.tool === 'trendline' || d.tool === 'ray' || d.tool === 'arrow') {
          const p1 = (d as { p1?: { time: number; price: number }; p2?: { time: number; price: number } }).p1
          const p2 = (d as { p1?: { time: number; price: number }; p2?: { time: number; price: number } }).p2
          if (!p1 || !p2) continue
          const a = project({ x: tOf(p1.time) * 0.9, y: yOf(p1.price), z: 0 }, cam, cx, cy)
          const b = project({ x: tOf(p2.time) * 0.9, y: yOf(p2.price), z: 0 }, cam, cx, cy)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(a.x, a.y, 3, 0, Math.PI * 2)
          ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    if (cfg.showLabels) {
      ctx.fillStyle = 'rgba(11,14,17,0.75)'
      ctx.fillRect(8, 8, Math.min(380, w - 16), 36)
      ctx.font = '11px ui-monospace, Menlo, monospace'
      ctx.fillStyle = theme.accent
      ctx.textAlign = 'left'
      ctx.fillText(m.note, 14, 22)
      ctx.fillStyle = theme.label
      ctx.fillText(
        `yaw ${cfg.yaw.toFixed(0)} · pitch ${cfg.pitch.toFixed(0)} · zoom ${cfg.zoom.toFixed(2)}`,
        14,
        36
      )
    }
  }, [])

  useEffect(() => {
    paint()
  }, [model, config, drawings, paint])

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
      dragRef.current = { x: e.clientX, y: e.clientY, yaw: cfgRef.current.yaw, pitch: cfgRef.current.pitch }
    }
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      onCameraChange?.({
        yaw: d.yaw + (e.clientX - d.x) * 0.35,
        pitch: Math.max(5, Math.min(80, d.pitch + (e.clientY - d.y) * 0.25)),
      })
    }
    const onUp = () => {
      dragRef.current = null
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const z = cfgRef.current.zoom
      onCameraChange?.({ zoom: Math.max(0.45, Math.min(2.4, z * (e.deltaY > 0 ? 0.92 : 1.08))) })
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
