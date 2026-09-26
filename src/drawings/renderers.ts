/**
 * Pure canvas renderers – logical Drawing → pixels via CoordinateBridge.
 * No React, no store. Called on every pan/zoom/resize paint.
 */

import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type {
  Drawing,
  LogicalPoint,
  TrendlineDrawing,
  HorizontalDrawing,
  VerticalDrawing,
  RectangleDrawing,
  ChannelDrawing,
  FibRetracementDrawing,
  FibExtensionDrawing,
  TextDrawing,
} from './types'
import { FIB_RETRACEMENT_LEVELS, FIB_EXTENSION_LEVELS } from './types'

function toPx(
  bridge: CoordinateBridge,
  p: LogicalPoint
): { x: number; y: number } | null {
  const px = bridge.toPixel({ time: p.time as any, price: p.price })
  if (!px || px.x === null || px.y === null) return null
  // Off-screen points still useful for line clipping
  return px
}

function applyStroke(ctx: CanvasRenderingContext2D, d: Drawing) {
  ctx.strokeStyle = d.style.color
  ctx.lineWidth = d.style.lineWidth
  ctx.setLineDash(d.style.lineDash ?? [])
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
}

function drawTrendline(ctx: CanvasRenderingContext2D, bridge: CoordinateBridge, d: TrendlineDrawing) {
  const a = toPx(bridge, d.p1)
  const b = toPx(bridge, d.p2)
  if (!a || !b) return
  applyStroke(ctx, d)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function drawHorizontal(ctx: CanvasRenderingContext2D, bridge: CoordinateBridge, d: HorizontalDrawing, width: number) {
  const y = bridge.priceToCoordinate(d.price)
  if (y === null) return
  applyStroke(ctx, d)
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(width, y)
  ctx.stroke()
  // Label
  ctx.fillStyle = d.style.color
  ctx.font = '10px sans-serif'
  ctx.fillText(d.price.toFixed(2), 4, y - 4)
}

function drawVertical(ctx: CanvasRenderingContext2D, bridge: CoordinateBridge, d: VerticalDrawing, height: number) {
  const x = bridge.timeToCoordinate(d.time as any)
  if (x === null) return
  applyStroke(ctx, d)
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.stroke()
}

function drawRectangle(ctx: CanvasRenderingContext2D, bridge: CoordinateBridge, d: RectangleDrawing) {
  const a = toPx(bridge, d.p1)
  const b = toPx(bridge, d.p2)
  if (!a || !b) return
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x)
  const h = Math.abs(b.y - a.y)
  applyStroke(ctx, d)
  const opacity = d.style.fillOpacity ?? 0.12
  ctx.fillStyle = hexToRgba(d.style.color, opacity)
  ctx.fillRect(x, y, w, h)
  ctx.strokeRect(x, y, w, h)
}

function drawChannel(ctx: CanvasRenderingContext2D, bridge: CoordinateBridge, d: ChannelDrawing) {
  const a = toPx(bridge, d.p1)
  const b = toPx(bridge, d.p2)
  const c = toPx(bridge, d.p3)
  if (!a || !b || !c) return

  // Offset vector from line p1-p2 to p3 (perpendicular component approximated via point)
  // Parallel line through p3 with same direction as p1→p2
  const dx = b.x - a.x
  const dy = b.y - a.y
  // Project: point on parallel = p3 + (p2-p1) direction
  const dPx = { x: c.x + dx, y: c.y + dy }

  applyStroke(ctx, d)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(c.x, c.y)
  ctx.lineTo(dPx.x, dPx.y)
  ctx.stroke()

  // Fill between
  const opacity = d.style.fillOpacity ?? 0.08
  ctx.fillStyle = hexToRgba(d.style.color, opacity)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineTo(dPx.x, dPx.y)
  ctx.lineTo(c.x, c.y)
  ctx.closePath()
  ctx.fill()
}

function drawFibRetracement(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: FibRetracementDrawing,
  width: number
) {
  const a = toPx(bridge, d.p1)
  const b = toPx(bridge, d.p2)
  if (!a || !b) return

  const priceRange = d.p2.price - d.p1.price
  applyStroke(ctx, d)

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

    ctx.fillStyle = d.style.color
    ctx.font = '10px sans-serif'
    ctx.fillText(`${(level * 100).toFixed(1)}%  ${price.toFixed(2)}`, x2 + 4, y + 3)
  }

  // Trend line
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.setLineDash([])
}

function drawFibExtension(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: FibExtensionDrawing
) {
  const a = toPx(bridge, d.p1)
  const b = toPx(bridge, d.p2)
  const c = toPx(bridge, d.p3)
  if (!a || !b || !c) return

  const move = d.p2.price - d.p1.price
  applyStroke(ctx, d)

  // Base A-B and B-C
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
    ctx.fillStyle = d.style.color
    ctx.font = '10px sans-serif'
    ctx.fillText(`${level.toFixed(3)}  ${price.toFixed(2)}`, x2 + 2, y + 3)
  }
}

function drawText(ctx: CanvasRenderingContext2D, bridge: CoordinateBridge, d: TextDrawing) {
  const p = toPx(bridge, d.point)
  if (!p) return
  ctx.fillStyle = d.style.color
  ctx.font = `${d.style.fontSize ?? 12}px sans-serif`
  ctx.fillText(d.text, p.x + 4, p.y - 4)
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

/** Paint all drawings onto ctx using bridge for coordinate conversion */
export function renderDrawings(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  drawings: Drawing[],
  width: number,
  height: number,
  preview: Drawing | null
) {
  ctx.clearRect(0, 0, width, height)
  const list = preview ? [...drawings, preview] : drawings
  for (const d of list) {
    switch (d.tool) {
      case 'trendline':
        drawTrendline(ctx, bridge, d)
        break
      case 'horizontal':
        drawHorizontal(ctx, bridge, d, width)
        break
      case 'vertical':
        drawVertical(ctx, bridge, d, height)
        break
      case 'rectangle':
        drawRectangle(ctx, bridge, d)
        break
      case 'channel':
        drawChannel(ctx, bridge, d)
        break
      case 'fib_retracement':
        drawFibRetracement(ctx, bridge, d, width)
        break
      case 'fib_extension':
        drawFibExtension(ctx, bridge, d)
        break
      case 'text':
        drawText(ctx, bridge, d)
        break
    }
  }
}
