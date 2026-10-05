/**
 * Professional 3D scene — Canvas2D perspective + full drawing tools.
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
      for (const cell of m.terrain) {
        const hgt = Math.max(0.02, cell.h * 0.95)
        const cellW = (1.8 / Math.max(8, cfg.maxBars)) * 0.85
        const cellD = (1.4 / Math.max(8, cfg.priceBins)) * 0.9
        const corners = columnCorners(cell.tx, -0.85, cellW, cellD, hgt)
        const shifted = corners.map((p) => ({ ...p, z: p.z + cell.ty * 0.75 }))
        const col = cell.buyFrac >= 0.5 ? theme.buy : theme.sell
        drawPoly([shifted[4], shifted[5], shifted[6], shifted[7]], hexAlpha(col, 0.7 * op), hexAlpha(col, 0.9))
      }
    }

    if (m.mode === 'candle_columns' && m.candles.length) {
      const bw = (1.8 / Math.max(8, m.candles.length)) * 0.7
      for (const c of m.candles) {
        const yOpen = normPrice(c.open, m.priceMin, m.priceMax)
        const yClose = normPrice(c.close, m.priceMin, m.priceMax)
        const bodyLo = Math.min(yOpen, yClose)
        const bodyH = Math.max(0.02, Math.abs(yClose - yOpen))
        const col = c.bull ? theme.buy : theme.sell
        const corners = columnCorners(c.tx, bodyLo, bw, 0.15, bodyH)
        drawPoly([corners[4], corners[5], corners[6], corners[7]], hexAlpha(col, 0.85 * op), hexAlpha(col, 1))
      }
    }

    if (m.mode === 'book_depth' && m.book.length) {
      for (const bar of m.book) {
        const col = bar.isBid ? theme.buy : theme.sell
        const hgt = Math.max(0.03, bar.h * 0.9)
        const corners = columnCorners(bar.side * 0.95, -0.85, 0.08, 0.1, hgt)
        const shifted = corners.map((p) => ({ ...p, z: p.z + bar.ty * 0.5 }))
        drawPoly([shifted[4], shifted[5], shifted[6], shifted[7]], hexAlpha(col, 0.8 * op), hexAlpha(col, 1))
      }
    }

    if (m.mode === 'dom_ladder' && dom.showWalls && m.dom?.length) {
      const wallOp = (dom.wallOpacity ?? 0.75) * op
      for (const row of m.dom) {
        const y = row.ty * 0.85
        const rowH = 0.08
        if (row.bidH > 0.001) {
          const len = Math.max(0.04, row.bidH * 1.05)
          const corners = columnCorners(-len / 2 - 0.02, y - rowH / 2, len, 0.1, rowH)
          drawPoly([corners[4], corners[5], corners[6], corners[7]], hexAlpha(theme.buy, 0.8 * wallOp), hexAlpha(theme.buy, 1))
        }
        if (row.askH > 0.001) {
          const len = Math.max(0.04, row.askH * 1.05)
          const corners = columnCorners(len / 2 + 0.02, y - rowH / 2, len, 0.1, rowH)
          drawPoly([corners[4], corners[5], corners[6], corners[7]], hexAlpha(theme.sell, 0.8 * wallOp), hexAlpha(theme.sell, 1))
        }
      }
    }

    // --- Full drawings renderer ---
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
      const toScr = (time: number, price: number) =>
        project({ x: tOf(time) * 0.9, y: yOf(price), z: 0 }, cam, cx, cy)

      for (const d of dlist) {
        const col = d.style?.color ?? '#1e90ff'
        ctx.lineWidth = Math.max(1, d.style?.lineWidth ?? 1.5)
        ctx.strokeStyle = col
        ctx.fillStyle = col
        const ls = d.style?.lineStyle
        if (ls === 'dashed') ctx.setLineDash([8, 5])
        else if (ls === 'dotted') ctx.setLineDash([2, 4])
        else ctx.setLineDash([])

        const drawLine = (
          a: { x: number; y: number },
          b: { x: number; y: number },
          arrow = false
        ) => {
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          if (arrow || d.style?.lineEnd === 'arrow') {
            const ang = Math.atan2(b.y - a.y, b.x - a.x)
            ctx.beginPath()
            ctx.moveTo(b.x, b.y)
            ctx.lineTo(b.x - 10 * Math.cos(ang - 0.4), b.y - 10 * Math.sin(ang - 0.4))
            ctx.lineTo(b.x - 10 * Math.cos(ang + 0.4), b.y - 10 * Math.sin(ang + 0.4))
            ctx.closePath()
            ctx.fill()
          } else if (d.style?.lineEnd === 'circle') {
            ctx.beginPath()
            ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        if (d.tool === 'horizontal') {
          const y = yOf((d as { price: number }).price)
          const a = project({ x: -1.2, y, z: -0.35 }, cam, cx, cy)
          const b = project({ x: 1.2, y, z: 0.35 }, cam, cx, cy)
          drawLine(a, b)
          ctx.setLineDash([])
          ctx.font = '10px ui-monospace, Menlo, monospace'
          ctx.fillText((d as { price: number }).price.toPrecision(6), b.x + 4, b.y - 2)
        } else if (d.tool === 'vertical') {
          const x = tOf((d as { time: number }).time) * 0.9
          drawLine(
            project({ x, y: -0.9, z: 0 }, cam, cx, cy),
            project({ x, y: 0.9, z: 0 }, cam, cx, cy)
          )
        } else if (d.tool === 'crossline') {
          const pt = (d as { point: { time: number; price: number } }).point
          const y = yOf(pt.price)
          const x = tOf(pt.time) * 0.9
          drawLine(
            project({ x: -1.2, y, z: -0.3 }, cam, cx, cy),
            project({ x: 1.2, y, z: 0.3 }, cam, cx, cy)
          )
          drawLine(
            project({ x, y: -0.9, z: 0 }, cam, cx, cy),
            project({ x, y: 0.9, z: 0 }, cam, cx, cy)
          )
        } else if (
          d.tool === 'trendline' ||
          d.tool === 'ray' ||
          d.tool === 'arrow' ||
          d.tool === 'measure'
        ) {
          const p1 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number } }).p1
          const p2 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number } }).p2
          if (!p1 || !p2) continue
          let a = toScr(p1.time, p1.price)
          let b = toScr(p2.time, p2.price)
          if (d.tool === 'ray') {
            b = { x: b.x + (b.x - a.x) * 3, y: b.y + (b.y - a.y) * 3, depth: b.depth }
          }
          drawLine(a, b, d.tool === 'arrow')
          if (d.tool === 'measure') {
            ctx.setLineDash([])
            const dp = p2.price - p1.price
            ctx.font = '10px ui-monospace, Menlo, monospace'
            ctx.fillText(
              `${dp >= 0 ? '+' : ''}${dp.toPrecision(4)}`,
              (a.x + b.x) / 2,
              (a.y + b.y) / 2 - 6
            )
          }
        } else if (d.tool === 'rectangle' || d.tool === 'ellipse') {
          const p1 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number } }).p1
          const p2 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number } }).p2
          if (!p1 || !p2) continue
          const c1 = toScr(p1.time, p1.price)
          const c2 = toScr(p2.time, p1.price)
          const c3 = toScr(p2.time, p2.price)
          const c4 = toScr(p1.time, p2.price)
          if (d.tool === 'rectangle') {
            ctx.beginPath()
            ctx.moveTo(c1.x, c1.y)
            ctx.lineTo(c2.x, c2.y)
            ctx.lineTo(c3.x, c3.y)
            ctx.lineTo(c4.x, c4.y)
            ctx.closePath()
            ctx.globalAlpha = 0.12
            ctx.fill()
            ctx.globalAlpha = 1
            ctx.stroke()
          } else {
            const mx = (c1.x + c3.x) / 2
            const my = (c1.y + c3.y) / 2
            const rx = Math.max(2, Math.abs(c3.x - c1.x) / 2)
            const ry = Math.max(2, Math.abs(c3.y - c1.y) / 2)
            ctx.beginPath()
            ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2)
            ctx.globalAlpha = 0.12
            ctx.fill()
            ctx.globalAlpha = 1
            ctx.stroke()
          }
        } else if (d.tool === 'triangle' || d.tool === 'channel') {
          const p1 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number }; p3: { time: number; price: number } }).p1
          const p2 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number }; p3: { time: number; price: number } }).p2
          const p3 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number }; p3: { time: number; price: number } }).p3
          if (!p1 || !p2 || !p3) continue
          const a = toScr(p1.time, p1.price)
          const b = toScr(p2.time, p2.price)
          const c = toScr(p3.time, p3.price)
          if (d.tool === 'triangle') {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.lineTo(c.x, c.y)
            ctx.closePath()
            ctx.globalAlpha = 0.12
            ctx.fill()
            ctx.globalAlpha = 1
            ctx.stroke()
          } else {
            drawLine(a, b)
            drawLine(
              { x: a.x + (c.x - a.x), y: a.y + (c.y - a.y) },
              { x: b.x + (c.x - a.x), y: b.y + (c.y - a.y) }
            )
          }
        } else if (d.tool === 'fib_retracement' || d.tool === 'fib_extension') {
          const p1 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number } }).p1
          const p2 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number } }).p2
          if (!p1 || !p2) continue
          const levels =
            d.tool === 'fib_retracement'
              ? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
              : [0, 0.618, 1, 1.272, 1.618, 2.618]
          for (const lv of levels) {
            const price = p1.price + (p2.price - p1.price) * lv
            const y = yOf(price)
            drawLine(
              project({ x: -1.1, y, z: -0.3 }, cam, cx, cy),
              project({ x: 1.1, y, z: 0.3 }, cam, cx, cy)
            )
            ctx.setLineDash([])
            ctx.font = '9px ui-monospace, Menlo, monospace'
            const b = project({ x: 1.1, y, z: 0.3 }, cam, cx, cy)
            ctx.fillText(`${(lv * 100).toFixed(1)}%`, b.x + 3, b.y - 1)
          }
        } else if (d.tool === 'long_position' || d.tool === 'short_position') {
          const p1 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number }; p3: { time: number; price: number } }).p1
          const p2 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number }; p3: { time: number; price: number } }).p2
          const p3 = (d as { p1: { time: number; price: number }; p2: { time: number; price: number }; p3: { time: number; price: number } }).p3
          if (!p1 || !p2 || !p3) continue
          ctx.strokeStyle = d.tool === 'long_position' ? '#0ecb81' : '#f6465d'
          ctx.fillStyle = ctx.strokeStyle
          const entry = toScr(p1.time, p1.price)
          const stop = toScr(p2.time, p2.price)
          const tgt = toScr(p3.time, p3.price)
          drawLine(entry, stop)
          drawLine(entry, tgt)
          ctx.setLineDash([])
          ctx.font = '9px ui-monospace, Menlo, monospace'
          ctx.fillText('E', entry.x + 3, entry.y)
          ctx.fillText('S', stop.x + 3, stop.y)
          ctx.fillText('T', tgt.x + 3, tgt.y)
        } else if (d.tool === 'polyline') {
          const pts = (d as { points: { time: number; price: number }[] }).points ?? []
          if (pts.length < 2) continue
          ctx.beginPath()
          pts.forEach((pt, i) => {
            const s = toScr(pt.time, pt.price)
            if (i === 0) ctx.moveTo(s.x, s.y)
            else ctx.lineTo(s.x, s.y)
          })
          ctx.stroke()
        } else if (d.tool === 'text') {
          const pt = (d as { point: { time: number; price: number }; text: string }).point
          const text = (d as { text: string }).text ?? ''
          const s = toScr(pt.time, pt.price)
          ctx.setLineDash([])
          ctx.font = `${d.style?.fontSize ?? 12}px sans-serif`
          ctx.fillText(text, s.x, s.y)
        }
        ctx.setLineDash([])
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
      onCameraChange?.({
        zoom: Math.max(0.45, Math.min(2.4, z * (e.deltaY > 0 ? 0.92 : 1.08))),
      })
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
