/**
 * Pure canvas renderers – logical Drawing → pixels via CoordinateBridge.
 */

import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type {
  Drawing,
  LogicalPoint,
  DrawingStyle,
} from './types'
import {
  FIB_RETRACEMENT_LEVELS,
  FIB_EXTENSION_LEVELS,
  styleToDash,
} from './types'
import { getHandlePixels } from './hitTest'

function toPx(
  bridge: CoordinateBridge,
  p: LogicalPoint
): { x: number; y: number } | null {
  const px = bridge.toPixel({ time: p.time as any, price: p.price })
  if (!px || px.x === null || px.y === null) return null
  return px
}

function applyStroke(ctx: CanvasRenderingContext2D, style: DrawingStyle, selected: boolean) {
  ctx.strokeStyle = style.color
  ctx.lineWidth = selected ? style.lineWidth + 1 : style.lineWidth
  ctx.setLineDash(styleToDash(style))
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (selected) {
    ctx.shadowColor = style.color
    ctx.shadowBlur = 6
  } else {
    ctx.shadowBlur = 0
  }
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  size = 10
) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - size * Math.cos(angle - Math.PI / 6),
    y2 - size * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    x2 - size * Math.cos(angle + Math.PI / 6),
    y2 - size * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
}

function drawCircleEnd(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  r = 4
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function applyLineEnds(
  ctx: CanvasRenderingContext2D,
  style: DrawingStyle,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const end = style.lineEnd ?? 'none'
  if (end === 'arrow') {
    drawArrowHead(ctx, x1, y1, x2, y2, style.color)
  } else if (end === 'circle') {
    drawCircleEnd(ctx, x1, y1, style.color)
    drawCircleEnd(ctx, x2, y2, style.color)
  }
}

/** Extend segment to chart edges if extendLeft/Right */
function extendSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number,
  extendLeft: boolean,
  extendRight: boolean
): { x1: number; y1: number; x2: number; y2: number } {
  if (!extendLeft && !extendRight) return { x1, y1, x2, y2 }
  const dx = x2 - x1
  const dy = y2 - y1
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return { x1, y1, x2, y2 }

  let outX1 = x1
  let outY1 = y1
  let outX2 = x2
  let outY2 = y2

  // Parametric extend to bounds
  const extend = (fromX: number, fromY: number, dirX: number, dirY: number) => {
    let tMax = Infinity
    if (dirX > 0) tMax = Math.min(tMax, (width - fromX) / dirX)
    else if (dirX < 0) tMax = Math.min(tMax, (0 - fromX) / dirX)
    if (dirY > 0) tMax = Math.min(tMax, (height - fromY) / dirY)
    else if (dirY < 0) tMax = Math.min(tMax, (0 - fromY) / dirY)
    if (!isFinite(tMax) || tMax < 0) tMax = 0
    return { x: fromX + dirX * tMax, y: fromY + dirY * tMax }
  }

  if (extendRight) {
    const e = extend(x2, y2, dx, dy)
    outX2 = e.x
    outY2 = e.y
  }
  if (extendLeft) {
    const e = extend(x1, y1, -dx, -dy)
    outX1 = e.x
    outY1 = e.y
  }
  return { x1: outX1, y1: outY1, x2: outX2, y2: outY2 }
}

function drawTwoPointLine(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  p1: LogicalPoint,
  p2: LogicalPoint,
  style: DrawingStyle,
  selected: boolean,
  width: number,
  height: number,
  forceArrow = false,
  ray = false
) {
  const a = toPx(bridge, p1)
  const b = toPx(bridge, p2)
  if (!a || !b) return

  let x1 = a.x
  let y1 = a.y
  let x2 = b.x
  let y2 = b.y

  if (ray) {
    // Extend only in p2 direction to edge
    const ext = extendSegment(x1, y1, x2, y2, width, height, false, true)
    x2 = ext.x2
    y2 = ext.y2
  } else {
    const ext = extendSegment(
      x1,
      y1,
      x2,
      y2,
      width,
      height,
      !!style.extendLeft,
      !!style.extendRight
    )
    x1 = ext.x1
    y1 = ext.y1
    x2 = ext.x2
    y2 = ext.y2
  }

  applyStroke(ctx, style, selected)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.setLineDash([])

  if (forceArrow || style.lineEnd === 'arrow') {
    drawArrowHead(ctx, a.x, a.y, b.x, b.y, style.color)
  } else if (style.lineEnd === 'circle') {
    drawCircleEnd(ctx, a.x, a.y, style.color)
    drawCircleEnd(ctx, b.x, b.y, style.color)
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: Drawing
) {
  const handles = getHandlePixels(bridge, d)
  for (const h of handles) {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = d.style.color
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(h.x, h.y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

export function renderDrawings(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  drawings: Drawing[],
  width: number,
  height: number,
  preview: Drawing | null,
  selectedId: string | null = null
) {
  ctx.clearRect(0, 0, width, height)
  const list = preview ? [...drawings, preview] : drawings

  for (const d of list) {
    const selected = d.id === selectedId
    const style = d.style

    switch (d.tool) {
      case 'trendline':
        drawTwoPointLine(ctx, bridge, d.p1, d.p2, style, selected, width, height)
        break
      case 'ray':
        drawTwoPointLine(ctx, bridge, d.p1, d.p2, style, selected, width, height, false, true)
        break
      case 'arrow':
        drawTwoPointLine(ctx, bridge, d.p1, d.p2, style, selected, width, height, true)
        break
      case 'horizontal': {
        const y = bridge.priceToCoordinate(d.price)
        if (y === null) break
        applyStroke(ctx, style, selected)
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.setLineDash([])
        ctx.fillStyle = style.color
        ctx.font = '10px sans-serif'
        ctx.fillText(d.price.toFixed(2), 4, y - 4)
        break
      }
      case 'vertical': {
        const x = bridge.timeToCoordinate(d.time as any)
        if (x === null) break
        applyStroke(ctx, style, selected)
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.setLineDash([])
        break
      }
      case 'crossline': {
        const p = toPx(bridge, d.point)
        if (!p) break
        applyStroke(ctx, style, selected)
        ctx.beginPath()
        ctx.moveTo(0, p.y)
        ctx.lineTo(width, p.y)
        ctx.moveTo(p.x, 0)
        ctx.lineTo(p.x, height)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.setLineDash([])
        break
      }
      case 'rectangle': {
        const a = toPx(bridge, d.p1)
        const b = toPx(bridge, d.p2)
        if (!a || !b) break
        const x = Math.min(a.x, b.x)
        const y = Math.min(a.y, b.y)
        const w = Math.abs(b.x - a.x)
        const h = Math.abs(b.y - a.y)
        applyStroke(ctx, style, selected)
        ctx.fillStyle = hexToRgba(style.color, style.fillOpacity ?? 0.12)
        ctx.fillRect(x, y, w, h)
        ctx.strokeRect(x, y, w, h)
        ctx.shadowBlur = 0
        ctx.setLineDash([])
        break
      }
      case 'triangle': {
        const a = toPx(bridge, d.p1)
        const b = toPx(bridge, d.p2)
        const c = toPx(bridge, d.p3)
        if (!a || !b || !c) break
        applyStroke(ctx, style, selected)
        ctx.fillStyle = hexToRgba(style.color, style.fillOpacity ?? 0.12)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.lineTo(c.x, c.y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.setLineDash([])
        break
      }
      case 'ellipse': {
        const a = toPx(bridge, d.p1)
        const b = toPx(bridge, d.p2)
        if (!a || !b) break
        const cx = (a.x + b.x) / 2
        const cy = (a.y + b.y) / 2
        const rx = Math.abs(b.x - a.x) / 2
        const ry = Math.abs(b.y - a.y) / 2
        applyStroke(ctx, style, selected)
        ctx.fillStyle = hexToRgba(style.color, style.fillOpacity ?? 0.12)
        ctx.beginPath()
        ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.setLineDash([])
        break
      }
      case 'channel': {
        const a = toPx(bridge, d.p1)
        const b = toPx(bridge, d.p2)
        const c = toPx(bridge, d.p3)
        if (!a || !b || !c) break
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dPx = { x: c.x + dx, y: c.y + dy }
        applyStroke(ctx, style, selected)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(dPx.x, dPx.y)
        ctx.stroke()
        ctx.fillStyle = hexToRgba(style.color, style.fillOpacity ?? 0.08)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.lineTo(dPx.x, dPx.y)
        ctx.lineTo(c.x, c.y)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.setLineDash([])
        break
      }
      case 'fib_retracement': {
        const a = toPx(bridge, d.p1)
        const b = toPx(bridge, d.p2)
        if (!a || !b) break
        const priceRange = d.p2.price - d.p1.price
        applyStroke(ctx, style, selected)
        for (const level of FIB_RETRACEMENT_LEVELS) {
          const price = d.p1.price + priceRange * level
          const y = bridge.priceToCoordinate(price)
          if (y === null) continue
          const x1 = Math.min(a.x, b.x)
          const x2 = Math.max(a.x, b.x)
          ctx.beginPath()
          ctx.moveTo(x1, y)
          ctx.lineTo(x2, y)
          ctx.stroke()
          ctx.fillStyle = style.color
          ctx.font = '10px sans-serif'
          ctx.fillText(`${(level * 100).toFixed(1)}%  ${price.toFixed(2)}`, x2 + 4, y + 3)
        }
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.shadowBlur = 0
        break
      }
      case 'fib_extension': {
        const a = toPx(bridge, d.p1)
        const b = toPx(bridge, d.p2)
        const c = toPx(bridge, d.p3)
        if (!a || !b || !c) break
        const move = d.p2.price - d.p1.price
        applyStroke(ctx, style, selected)
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.lineTo(c.x, c.y)
        ctx.stroke()
        ctx.setLineDash([])
        for (const level of FIB_EXTENSION_LEVELS) {
          const price = d.p3.price + move * level
          const y = bridge.priceToCoordinate(price)
          if (y === null) continue
          const x1 = Math.min(c.x, b.x)
          const x2 = Math.max(c.x, b.x) + 40
          ctx.beginPath()
          ctx.moveTo(x1, y)
          ctx.lineTo(x2, y)
          ctx.stroke()
          ctx.fillStyle = style.color
          ctx.font = '10px sans-serif'
          ctx.fillText(`${level.toFixed(3)}  ${price.toFixed(2)}`, x2 + 2, y + 3)
        }
        ctx.shadowBlur = 0
        break
      }
      case 'measure': {
        const a = toPx(bridge, d.p1)
        const b = toPx(bridge, d.p2)
        if (!a || !b) break
        applyStroke(ctx, style, selected)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        // box mid
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const dPrice = d.p2.price - d.p1.price
        const dPct = d.p1.price !== 0 ? (dPrice / d.p1.price) * 100 : 0
        const dSec = Math.abs(d.p2.time - d.p1.time)
        const dBars = dSec // approximate label
        const label = `${dPrice >= 0 ? '+' : ''}${dPrice.toFixed(2)} (${dPct >= 0 ? '+' : ''}${dPct.toFixed(2)}%) · ${dSec}s`
        ctx.font = '11px ui-monospace, monospace'
        const tw = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(11,14,17,0.85)'
        ctx.fillRect(mx - tw / 2 - 4, my - 10, tw + 8, 18)
        ctx.fillStyle = style.color
        ctx.textAlign = 'center'
        ctx.fillText(label, mx, my + 3)
        ctx.textAlign = 'left'
        applyLineEnds(ctx, { ...style, lineEnd: 'circle' }, a.x, a.y, b.x, b.y)
        ctx.shadowBlur = 0
        ctx.setLineDash([])
        break
      }
      case 'long_position':
      case 'short_position': {
        const a = toPx(bridge, d.p1)
        const b = toPx(bridge, d.p2)
        const c = toPx(bridge, d.p3)
        if (!a || !b || !c) break
        const isLong = d.tool === 'long_position'
        const entry = d.p1.price
        const stop = d.p2.price
        const target = d.p3.price
        const x1 = Math.min(a.x, c.x)
        const x2 = Math.max(a.x, c.x)
        const yEntry = bridge.priceToCoordinate(entry)
        const yStop = bridge.priceToCoordinate(stop)
        const yTarget = bridge.priceToCoordinate(target)
        if (yEntry == null || yStop == null || yTarget == null) break

        const riskTop = Math.min(yEntry, yStop)
        const riskBot = Math.max(yEntry, yStop)
        const rewardTop = Math.min(yEntry, yTarget)
        const rewardBot = Math.max(yEntry, yTarget)

        ctx.fillStyle = isLong
          ? 'rgba(246, 70, 93, 0.18)'
          : 'rgba(14, 203, 129, 0.18)'
        ctx.fillRect(x1, riskTop, x2 - x1, riskBot - riskTop)
        ctx.fillStyle = isLong
          ? 'rgba(14, 203, 129, 0.18)'
          : 'rgba(246, 70, 93, 0.18)'
        ctx.fillRect(x1, rewardTop, x2 - x1, rewardBot - rewardTop)

        applyStroke(ctx, style, selected)
        ctx.beginPath()
        ctx.moveTo(x1, yEntry)
        ctx.lineTo(x2, yEntry)
        ctx.stroke()
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(x1, yStop)
        ctx.lineTo(x2, yStop)
        ctx.moveTo(x1, yTarget)
        ctx.lineTo(x2, yTarget)
        ctx.stroke()
        ctx.setLineDash([])

        const risk = Math.abs(entry - stop)
        const reward = Math.abs(target - entry)
        const rr = risk > 0 ? reward / risk : 0
        ctx.font = '10px ui-monospace, monospace'
        ctx.fillStyle = style.color
        ctx.fillText(
          `${isLong ? 'Long' : 'Short'} R:R ${rr.toFixed(2)}`,
          x1 + 4,
          Math.min(riskTop, rewardTop) - 4
        )
        ctx.shadowBlur = 0
        break
      }
      case 'polyline': {
        if (d.points.length < 2) break
        const pts = d.points.map((p) => toPx(bridge, p)).filter(Boolean) as {
          x: number
          y: number
        }[]
        if (pts.length < 2) break
        applyStroke(ctx, style, selected)
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.setLineDash([])
        if (style.lineEnd === 'arrow' && pts.length >= 2) {
          const n = pts.length
          drawArrowHead(ctx, pts[n - 2].x, pts[n - 2].y, pts[n - 1].x, pts[n - 1].y, style.color)
        }
        break
      }
      case 'text': {
        const p = toPx(bridge, d.point)
        if (!p) break
        if (selected) {
          ctx.shadowColor = style.color
          ctx.shadowBlur = 6
        }
        ctx.fillStyle = style.color
        ctx.font = `${style.fontSize ?? 12}px sans-serif`
        ctx.fillText(d.text, p.x + 4, p.y - 4)
        ctx.shadowBlur = 0
        break
      }
    }

    if (selected && d.id !== 'preview') {
      drawHandles(ctx, bridge, d)
    }
  }
}
