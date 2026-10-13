/**
 * Professional 3D scene — solid boxes, real candles (body+wick), Canvas2D projection.
 * Drawings use drawingStore tool ids: trendline, horizontal, vertical, … + p1/p2.
 */

import { useRef, useEffect, useCallback } from 'react'
import type { Viz3DModel, Viz3DConfig } from './types'
import { DEFAULT_DOM3D_OPTIONS } from './types'
import { VIZ3D_THEMES as THEMES } from './themes'
import { project, type Camera3D, type Vec3 } from './math3d'
import type { Drawing } from '@/drawings/types'

interface Viz3DSceneProps {
  model: Viz3DModel
  config: Viz3DConfig
  drawings?: Drawing[]
  onCameraChange?: (patch: Partial<Viz3DConfig>) => void
  className?: string
}

function hexAlpha(hex: string, a: number): string {
  if (hex.startsWith('rgba')) return hex
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (!Number.isFinite(n)) return `rgba(128,128,128,${a})`
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
    const cx = w / 2
    const cy = h / 2

    const drawPoly = (pts: Vec3[], fill: string, stroke?: string, lineW = 0.8) => {
      if (pts.length < 3) return
      const scr = pts.map((p) => project(p, cam, cx, cy))
      ctx.beginPath()
      ctx.moveTo(scr[0]!.x, scr[0]!.y)
      for (let i = 1; i < scr.length; i++) ctx.lineTo(scr[i]!.x, scr[i]!.y)
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
      col: string,
      alpha: number,
      edge = 0.5
    ) => {
      for (const face of BOX_FACES) {
        const pts = face.idx.map((i) => corners[i]!)
        drawPoly(
          pts,
          shadeHex(col, face.shade, alpha),
          hexAlpha(col, Math.min(1, alpha + 0.15)),
          edge
        )
      }
    }

    // Floor grid
    const floor: Vec3[] = [
      { x: -1, y: -0.9, z: -1 },
      { x: 1, y: -0.9, z: -1 },
      { x: 1, y: -0.9, z: 1 },
      { x: -1, y: -0.9, z: 1 },
    ]
    drawPoly(floor, hexAlpha(theme.grid, 0.12), hexAlpha(theme.grid, 0.25), 1)

    const op = 1

    // Volume terrain / candle columns / book / DOM from model
    if (m.mode === 'volume_terrain' && m.terrain) {
      for (const c of m.terrain) {
        if (!c.corners?.length) continue
        drawSolidBox(c.corners, c.col, 0.82 * op, 0.5)
      }
    }

    if (m.mode === 'candle_columns' && m.columns) {
      for (const it of m.columns) {
        if (it.wickCorners?.length) {
          drawSolidBox(it.wickCorners, it.col, 0.95 * op, 0.35)
        }
        if (it.bodyCorners?.length) {
          drawSolidBox(it.bodyCorners, it.col, 0.92 * op, 0.55)
        }
        if (it.volCorners?.length) {
          drawSolidBox(it.volCorners, it.col, 0.35 * op, 0.3)
        }
      }
    }

    if (m.mode === 'book_depth' && m.bookBoxes) {
      const boxes = [...m.bookBoxes].sort((a, b) => b.depth - a.depth)
      for (const b of boxes) {
        drawSolidBox(b.corners, b.col, 0.85 * op, 0.5)
      }
    }

    if (m.mode === 'dom_ladder' && m.domBoxes) {
      const wallOp = dom.wallOpacity ?? 0.85
      const boxes = [...m.domBoxes]
      for (const b of boxes) {
        if (!b.corners?.length) continue
        drawSolidBox(b.corners, b.col, 0.85 * wallOp, 0.45)
      }
      if (m.domBubbles) {
        for (const bub of m.domBubbles) {
          const p = project(bub.pos, cam, cx, cy)
          const r = Math.max(2, (bub.radius ?? 4) * cfg.zoom)
          ctx.beginPath()
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
          ctx.fillStyle = hexAlpha(bub.col, 0.75)
          ctx.fill()
        }
      }
    }

    // --- Drawings (drawingStore tool ids + p1/p2/price/time) ---
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

      const midTime = (() => {
        const bars = m.candles
        if (bars && bars.length >= 2) return (bars[0].time + bars[bars.length - 1].time) / 2
        return Date.now() / 1000
      })()
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
            if (tool === 'ray' && pts.length >= 2) {
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
              drawLine(
                toScr(pts[i]!.time, pts[i]!.price),
                toScr(pts[i + 1]!.time, pts[i + 1]!.price)
              )
            }
            if (pts.length >= 3) {
              drawLine(
                toScr(pts[2]!.time, pts[2]!.price),
                toScr(pts[0]!.time, pts[0]!.price)
              )
            }
          }
        } else if (tool === 'polyline') {
          for (let i = 0; i < pts.length - 1; i++) {
            drawLine(
              toScr(pts[i]!.time, pts[i]!.price),
              toScr(pts[i + 1]!.time, pts[i + 1]!.price)
            )
          }
        } else if (tool === 'text' && pts.length >= 1) {
          const p = toScr(pts[0]!.time, pts[0]!.price)
          ctx.font = `${d.style?.fontSize ?? 12}px ui-sans-serif, system-ui`
          ctx.fillText(anyD.text ?? 'Note', p.x + 4, p.y - 4)
        } else if (pts.length >= 2) {
          for (let i = 0; i < pts.length - 1; i++) {
            drawLine(
              toScr(pts[i]!.time, pts[i]!.price),
              toScr(pts[i + 1]!.time, pts[i + 1]!.price)
            )
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
      if (!d) return
      const dyaw = (e.clientX - d.x) * 0.008
      const dpitch = (e.clientY - d.y) * 0.006
      onCameraChange?.({
        yaw: d.yaw + dyaw,
        pitch: Math.max(-1.2, Math.min(1.2, d.pitch + dpitch)),
      })
    }
    const onUp = () => {
      dragRef.current = null
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const z = cfgRef.current.zoom
      const next = Math.max(0.4, Math.min(4, z * (e.deltaY > 0 ? 0.92 : 1.08)))
      onCameraChange?.({ zoom: next })
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
  }, [onCameraChange, paint])

  // Auto-rotate
  useEffect(() => {
    if (!config.autoRotate) return
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = (t - last) / 1000
      last = t
      onCameraChange?.({ yaw: cfgRef.current.yaw + dt * 0.35 })
      paint()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [config.autoRotate, onCameraChange, paint])

  return (
    <canvas
      ref={canvasRef}
      className={`h-full w-full touch-none cursor-grab active:cursor-grabbing ${className}`}
    />
  )
}
