/**
 * Professional 3D scene — Canvas2D perspective.
 * Deep DOM: liquidity walls + aggressor trade bubbles (Deep Chart style).
 */

import { useCallback, useEffect, useRef } from 'react'
import type { Viz3DConfig, Viz3DModel } from './types'
import { DEFAULT_DOM3D_OPTIONS } from './types'
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
  onCameraChange,
  className = '',
}: Viz3DSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)
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
        drawPoly([shifted[0], shifted[1], shifted[5], shifted[4]], hexAlpha(col, 0.45 * op))
        drawPoly([shifted[4], shifted[5], shifted[6], shifted[7]], hexAlpha(col, 0.8 * op), hexAlpha(col, 1))
      }
    }

    if (m.mode === 'dom_ladder') {
      const wallOp = (dom.wallOpacity ?? 0.75) * op
      const bubOp = (dom.bubbleOpacity ?? 0.9) * op

      if (dom.showWalls && m.dom?.length) {
        const sorted = [...m.dom].sort((a, b) => {
          const da = project({ x: 0, y: a.ty, z: 0 }, cam, cx, cy).depth
          const db = project({ x: 0, y: b.ty, z: 0 }, cam, cx, cy).depth
          return db - da
        })
        const rowH = Math.min(0.11, 1.5 / Math.max(8, sorted.length))
        for (const row of sorted) {
          const y = row.ty * 0.85
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

      if (dom.showMid && m.mid > 0 && m.priceMax > m.priceMin) {
        const my = ((m.mid - m.priceMin) / (m.priceMax - m.priceMin)) * 2 - 1
        const a = project({ x: -1.05, y: my * 0.85, z: -0.35 }, cam, cx, cy)
        const b = project({ x: 1.05, y: my * 0.85, z: 0.35 }, cam, cx, cy)
        ctx.strokeStyle = theme.accent
        ctx.lineWidth = 1.6
        ctx.setLineDash([5, 3])
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = theme.accent
        ctx.font = '10px ui-monospace, Menlo, monospace'
        ctx.textAlign = 'left'
        const sp = m.spread > 0 ? `  sp ${m.spread.toPrecision(4)}` : ''
        ctx.fillText(`MID ${m.mid.toFixed(2)}${sp}`, b.x + 4, b.y - 2)
      }

      if (dom.showBubbles && m.bubbles?.length) {
        const sortedB = [...m.bubbles].sort((a, b) => {
          const da = project({ x: a.tx * 0.7, y: a.ty * 0.85, z: 0.15 }, cam, cx, cy).depth
          const db = project({ x: b.tx * 0.7, y: b.ty * 0.85, z: 0.15 }, cam, cx, cy).depth
          return db - da
        })
        for (const bub of sortedB) {
          const p = project({ x: bub.tx * 0.7, y: bub.ty * 0.85, z: 0.12 }, cam, cx, cy)
          const radius = Math.max(3, Math.min(28, 6 + bub.r * 18))
          const col = bub.aggressor === 'buy' ? theme.buy : theme.sell
          const grd = ctx.createRadialGradient(p.x - radius * 0.3, p.y - radius * 0.3, 1, p.x, p.y, radius)
          grd.addColorStop(0, hexAlpha(col, Math.min(1, bubOp + 0.15)))
          grd.addColorStop(0.7, hexAlpha(col, bubOp * 0.85))
          grd.addColorStop(1, hexAlpha(col, 0.15))
          ctx.beginPath()
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
          ctx.strokeStyle = hexAlpha(col, 0.95)
          ctx.lineWidth = 1.2
          ctx.stroke()
          if (dom.showBubbleLabels && radius >= 10) {
            ctx.fillStyle = '#eaecef'
            ctx.font = '9px ui-monospace, Menlo, monospace'
            ctx.textAlign = 'center'
            ctx.fillText(fmtQuote(bub.quoteQty), p.x, p.y + 3)
          }
        }
      }

      const totalBid = m.totalBid ?? 0
      const totalAsk = m.totalAsk ?? 0
      const imb = totalBid + totalAsk > 0 ? ((totalBid - totalAsk) / (totalBid + totalAsk)) * 100 : 0
      ctx.font = '10px ui-monospace, Menlo, monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = theme.buy
      ctx.fillText(`BID ${totalBid.toFixed(3)}`, 14, h - 28)
      ctx.fillStyle = theme.sell
      ctx.fillText(`ASK ${totalAsk.toFixed(3)}`, 14, h - 14)
      ctx.fillStyle = imb >= 0 ? theme.buy : theme.sell
      ctx.fillText(`IMB ${imb >= 0 ? '+' : ''}${imb.toFixed(1)}%`, 120, h - 14)
      if (m.bubbles?.length) {
        ctx.fillStyle = theme.label
        ctx.fillText(`${m.bubbles.length} bubbles`, 200, h - 14)
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
        `yaw ${cfg.yaw.toFixed(0)}° · pitch ${cfg.pitch.toFixed(0)}° · zoom ${cfg.zoom.toFixed(2)} · drag · wheel`,
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
