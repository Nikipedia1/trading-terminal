/**
 * Professional 3D scene — solid boxes, real candles (body+wick), Canvas2D perspective.
 * Drawings use drawingStore tool ids: trendline, horizontal, vertical, … + p1/p2.
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

function shadeHex(hex: string, factor: number, a: number): string {
  if (hex.startsWith('rgba')) return hex
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * factor)))
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * factor)))
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * factor)))
  return `rgba(${r},${g},${b},${a})`
}

/** Face indices into columnCorners() result (bottom 0-3, top 4-7). */
const BOX_FACES: { idx: number[]; shade: number }[] = [
  { idx: [0, 1, 2, 3], shade: 0.35 },
  { idx: [0, 1, 5, 4], shade: 0.55 },
  { idx: [1, 2, 6, 5], shade: 0.72 },
  { idx: [2, 3, 7, 6], shade: 0.48 },
  { idx: [3, 0, 4, 7], shade: 0.62 },
  { idx: [4, 5, 6, 7], shade: 1.0 },
]

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

    const drawPoly = (pts: Vec3[], fill: string, stroke?: string, lineW = 0.8) => {
      const scr = pts.map((p) => project(p, cam, cx, cy))
      let area = 0
      for (let i = 0; i < scr.length; i++) {
        const a = scr[i]!
        const b = scr[(i + 1) % scr.length]!
        area += a.x * b.y - b.x * a.y
      }
      if (area > 80) return
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
        ctx.lineWidth = lineW
        ctx.stroke()
      }
    }

    const drawSolidBox = (
      corners: Vec3[],
      color: string,
      alpha: number,
      edgeAlpha = 0.55
    ) => {
      const faces = BOX_FACES.map((f) => {
        const pts = f.idx.map((i) => corners[i]!)
        const mid = {
          x: (pts[0]!.x + pts[1]!.x + pts[2]!.x + pts[3]!.x) / 4,
          y: (pts[0]!.y + pts[1]!.y + pts[2]!.y + pts[3]!.y) / 4,
          z: (pts[0]!.z + pts[1]!.z + pts[2]!.z + pts[3]!.z) / 4,
        }
        const pr = project(mid, cam, cx, cy)
        return { pts, shade: f.shade, depth: pr.depth }
      })
      faces.sort((a, b) => b.depth - a.depth)
      for (const f of faces) {
        drawPoly(
          f.pts,
          shadeHex(color, f.shade, alpha),
          shadeHex(color, Math.min(1, f.shade + 0.15), alpha * edgeAlpha),
          0.7
        )
      }
    }

    if (cfg.showGrid && m.mode !== 'dom_ladder') {
      const floor = [
        { x: -1.15, y: -0.88, z: -1.2 },
        { x: 1.15, y: -0.88, z: -1.2 },
        { x: 1.15, y: -0.88, z: 1.2 },
        { x: -1.15, y: -0.88, z: 1.2 },
      ]
      drawPoly(floor, hexAlpha(theme.grid, 0.12), hexAlpha(theme.grid, 0.25), 1)
      ctx.strokeStyle = hexAlpha(theme.grid, 0.35)
      ctx.lineWidth = 1
      for (let i = -5; i <= 5; i++) {
        const a = project({ x: i * 0.22, y: -0.87, z: -1.1 }, cam, cx, cy)
        const b = project({ x: i * 0.22, y: -0.87, z: 1.1 }, cam, cx, cy)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        const c = project({ x: -1.1, y: -0.87, z: i * 0.22 }, cam, cx, cy)
        const d = project({ x: 1.1, y: -0.87, z: i * 0.22 }, cam, cx, cy)
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
      const cells = m.terrain.map((cell) => {
        const hgt = Math.max(0.02, cell.h * 0.95)
        const cellW = (1.8 / Math.max(8, cfg.maxBars)) * 0.85
        const cellD = (1.4 / Math.max(8, cfg.priceBins)) * 0.9
        const corners = columnCorners(cell.tx, -0.85, cellW, cellD, hgt).map((p) => ({
          ...p,
          z: p.z + cell.ty * 0.75,
        }))
        const mid = corners[4]!
        return {
          corners,
          col: cell.buyFrac >= 0.5 ? theme.buy : theme.sell,
          depth: project(mid, cam, cx, cy).depth,
        }
      })
      cells.sort((a, b) => b.depth - a.depth)
      for (const c of cells) {
        drawSolidBox(c.corners, c.col, 0.82 * op, 0.5)
      }
    }

    if (m.mode === 'candle_columns' && m.candles.length) {
      const n = m.candles.length
      const bw = (1.8 / Math.max(8, n)) * 0.55
      const wickW = Math.max(0.012, bw * 0.18)
      const depth = Math.max(0.08, bw * 0.75)
      const items = m.candles.map((c) => {
        const yOpen = normPrice(c.open, m.priceMin, m.priceMax)
        const yClose = normPrice(c.close, m.priceMin, m.priceMax)
        const yHigh = normPrice(c.high, m.priceMin, m.priceMax)
        const yLow = normPrice(c.low, m.priceMin, m.priceMax)
        const bodyLo = Math.min(yOpen, yClose)
        const bodyHi = Math.max(yOpen, yClose)
        const bodyH = Math.max(0.018, bodyHi - bodyLo)
        const col = c.bull ? theme.buy : theme.sell
        const mid = { x: c.tx, y: (yHigh + yLow) / 2, z: 0 }
        return {
          c,
          yHigh,
          yLow,
          bodyLo,
          bodyH,
          col,
          depth: project(mid, cam, cx, cy).depth,
        }
      })
      items.sort((a, b) => b.depth - a.depth)

      for (const it of items) {
        const wickH = Math.max(0.01, it.yHigh - it.yLow)
        const wickCorners = columnCorners(it.c.tx, it.yLow, wickW, wickW * 0.9, wickH)
        drawSolidBox(wickCorners, it.col, 0.95 * op, 0.35)

        const bodyCorners = columnCorners(it.c.tx, it.bodyLo, bw, depth, it.bodyH)
        drawSolidBox(bodyCorners, it.col, 0.92 * op, 0.55)

        if (it.c.volume != null && m.volMax > 0) {
          const vh = Math.max(0.01, (it.c.volume / m.volMax) * 0.22)
          const volCorners = columnCorners(it.c.tx, -0.88, bw * 0.9, depth * 0.85, vh)
          drawSolidBox(volCorners, it.col, 0.35 * op, 0.3)
        }
      }
    }

    if (m.mode === 'book_depth' && m.book.length) {
      const bars = m.book.map((bar) => {
        const hgt = Math.max(0.03, bar.h * 0.9)
        const corners = columnCorners(bar.side * 0.95, -0.85, 0.1, 0.14, hgt).map((p) => ({
          ...p,
          z: p.z + bar.ty * 0.5,
        }))
        return {
          corners,
          col: bar.isBid ? theme.buy : theme.sell,
          depth: project(corners[4]!, cam, cx, cy).depth,
        }
      })
      bars.sort((a, b) => b.depth - a.depth)
      for (const b of bars) {
        drawSolidBox(b.corners, b.col, 0.85 * op, 0.5)
      }
    }

    if (m.mode === 'dom_ladder' && dom.showWalls && m.dom?.length) {
      const wallOp = (dom.wallOpacity ?? 0.75) * op
      const boxes: { corners: Vec3[]; col: string; depth: number }[] = []
      for (const row of m.dom) {
        const y = row.ty * 0.85
        const rowH = 0.08
        if (row.bidH > 0.001) {
          const len = Math.max(0.04, row.bidH * 1.05)
          const corners = columnCorners(-len / 2 - 0.02, y - rowH / 2, len, 0.14, rowH)
          boxes.push({
            corners,
            col: theme.buy,
            depth: project(corners[4]!, cam, cx, cy).depth,
          })
        }
        if (row.askH > 0.001) {
          const len = Math.max(0.04, row.askH * 1.05)
          const corners = columnCorners(len / 2 + 0.02, y - rowH / 2, len, 0.14, rowH)
          boxes.push({
            corners,
            col: theme.sell,
            depth: project(corners[4]!, cam, cx, cy).depth,
          })
        }
      }
      boxes.sort((a, b) => b.depth - a.depth)
      for (const b of boxes) {
        drawSolidBox(b.corners, b.col, 0.85 * wallOp, 0.45)
      }
    }

    // --- Drawings: drawingStore tool ids + p1/p2/price/time ---
    const dlist = drawingsRef.current ?? []
    if (dlist.length && m.priceMax > m.priceMin) {
      const yOf = (price: number) =>
        (((price - m.priceMin) / (m.priceMax - m.priceMin)) * 2 - 1) * 0.85

      let t0 = 0
      let t1 = 1
      if (m.candles && m.candles.length >= 2) {
        t0 = m.candles[0].time
        t1 = m.candles[m.candles.length - 1].time
      } else if (m.terrain && m.terrain.length >= 2) {
        t0 = m.terrain[0].time
        t1 = m.terrain[m.terrain.length - 1].time
      } else {
        const now = Date.now() / 1000
        t0 = now - 3600
        t1 = now
      }
      if (!(t1 > t0)) t1 = t0 + 60

      const tOf = (time: number) => ((time - t0) / (t1 - t0)) * 2 - 1
      const toScr = (time: number, price: number) =>
        project({ x: tOf(time) * 0.9, y: yOf(price), z: 0 }, cam, cx, cy)

      const midTime = (t0 + t1) / 2
      const midPrice = (m.priceMin + m.priceMax) / 2

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
            ctx.arc(b.x, b.y, 4, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        const anyD = d as {
          p1?: { time: number; price: number }
          p2?: { time: number; price: number }
          p3?: { time: number; price: number }
          point?: { time: number; price: number }
          points?: { time: number; price: number }[]
          price?: number
          time?: number
          text?: string
        }
        let pts: { time: number; price: number }[] = []
        if (anyD.points && anyD.points.length) pts = anyD.points
        else if (anyD.p1) {
          pts = [anyD.p1]
          if (anyD.p2) pts.push(anyD.p2)
          if (anyD.p3) pts.push(anyD.p3)
        } else if (anyD.point) pts = [anyD.point]
        else if (typeof anyD.price === 'number') pts = [{ time: midTime, price: anyD.price }]
        else if (typeof anyD.time === 'number') pts = [{ time: anyD.time, price: midPrice }]

        const tool = d.tool

        if (
          tool === 'trendline' ||
          tool === 'ray' ||
          tool === 'arrow' ||
          tool === 'measure' ||
          tool === 'fib_retracement' ||
          tool === 'fib_extension'
        ) {
          if (pts.length >= 2) {
            drawLine(
              toScr(pts[0]!.time, pts[0]!.price),
              toScr(pts[1]!.time, pts[1]!.price),
              tool === 'arrow'
            )
            if (tool === 'ray') {
              const a = pts[0]!
              const b = pts[1]!
              const dx = b.time - a.time
              const dy = b.price - a.price
              const ext = { time: b.time + dx * 3, price: b.price + dy * 3 }
              ctx.globalAlpha = 0.45
              drawLine(toScr(b.time, b.price), toScr(ext.time, ext.price))
              ctx.globalAlpha = 1
            }
          }
        } else if (tool === 'horizontal') {
          const price = typeof anyD.price === 'number' ? anyD.price : pts[0]?.price
          if (price != null) {
            const y = toScr(midTime, price).y
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(w, y)
            ctx.stroke()
          }
        } else if (tool === 'vertical') {
          const time = typeof anyD.time === 'number' ? anyD.time : pts[0]?.time
          if (time != null) {
            const x = toScr(time, midPrice).x
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, h)
            ctx.stroke()
          }
        } else if (tool === 'crossline') {
          const p = pts[0]
          if (p) {
            const y = toScr(midTime, p.price).y
            const x = toScr(p.time, midPrice).x
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(w, y)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, h)
            ctx.stroke()
          }
        } else if (tool === 'rectangle' || tool === 'ellipse') {
          if (pts.length >= 2) {
            const a = toScr(pts[0]!.time, pts[0]!.price)
            const b = toScr(pts[1]!.time, pts[1]!.price)
            const x0 = Math.min(a.x, b.x)
            const y0 = Math.min(a.y, b.y)
            const rw = Math.abs(b.x - a.x)
            const rh = Math.abs(b.y - a.y)
            ctx.globalAlpha = d.style?.fillOpacity ?? 0.12
            if (tool === 'ellipse') {
              ctx.beginPath()
              ctx.ellipse(x0 + rw / 2, y0 + rh / 2, rw / 2 || 1, rh / 2 || 1, 0, 0, Math.PI * 2)
              ctx.fill()
              ctx.globalAlpha = 1
              ctx.stroke()
            } else {
              ctx.fillRect(x0, y0, rw, rh)
              ctx.globalAlpha = 1
              ctx.strokeRect(x0, y0, rw, rh)
            }
          }
        } else if (
          tool === 'triangle' ||
          tool === 'channel' ||
          tool === 'long_position' ||
          tool === 'short_position'
        ) {
          if (pts.length >= 2) {
            for (let i = 0; i < pts.length - 1; i++) {
              drawLine(toScr(pts[i]!.time, pts[i]!.price), toScr(pts[i + 1]!.time, pts[i + 1]!.price))
            }
            if (pts.length >= 3) {
              drawLine(toScr(pts[2]!.time, pts[2]!.price), toScr(pts[0]!.time, pts[0]!.price))
            }
          }
        } else if (tool === 'polyline') {
          for (let i = 0; i < pts.length - 1; i++) {
            drawLine(toScr(pts[i]!.time, pts[i]!.price), toScr(pts[i + 1]!.time, pts[i + 1]!.price))
          }
        } else if (tool === 'text' && pts.length >= 1) {
          const p = toScr(pts[0]!.time, pts[0]!.price)
          ctx.font = `${d.style?.fontSize ?? 12}px ui-sans-serif, system-ui`
          ctx.fillText(anyD.text ?? 'Note', p.x + 4, p.y - 4)
        } else if (pts.length >= 2) {
          for (let i = 0; i < pts.length - 1; i++) {
            drawLine(toScr(pts[i]!.time, pts[i]!.price), toScr(pts[i + 1]!.time, pts[i + 1]!.price))
          }
        }
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }
    }

    // HUD
    ctx.fillStyle = theme.label
    ctx.font = '10px ui-monospace, Menlo, monospace'
    ctx.textAlign = 'left'
    const drawN = (drawingsRef.current ?? []).length
    ctx.fillText(
      `${m.mode} · drag orbit · wheel zoom${drawN ? ` · ${drawN} draw` : ''}`,
      10,
      16
    )
  }, [])

  useEffect(() => {
    paint()
  }, [model, config, drawings, paint])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => paint())
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [paint])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onDown = (e: PointerEvent) => {
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        yaw: cfgRef.current.yaw,
        pitch: cfgRef.current.pitch,
      }
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d || !onCameraChange) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      onCameraChange({
        yaw: d.yaw + dx * 0.4,
        pitch: Math.max(-20, Math.min(70, d.pitch - dy * 0.3)),
      })
    }
    const onUp = (e: PointerEvent) => {
      dragRef.current = null
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!onCameraChange) return
      const z = cfgRef.current.zoom * (e.deltaY > 0 ? 0.92 : 1.08)
      onCameraChange({ zoom: Math.max(0.4, Math.min(3.5, z)) })
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [onCameraChange])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full touch-none cursor-grab active:cursor-grabbing ${className}`}
    />
  )
}
