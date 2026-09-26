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
import { getHandlePixels } from './hitTest'

function toPx(
  bridge: CoordinateBridge,
  p: LogicalPoint
): { x: number; y: number } | null {
  const px = bridge.toPixel({ time: p.time as any, price: p.price })
  if (!px || px.x === null || px.y === null) return null
  return px
}

function applyStroke(ctx: CanvasRenderingContext2D, d: Drawing, selected: boolean) {
  ctx.strokeStyle = d.style.color
  ctx.lineWidth = selected ? d.style.lineWidth + 1 : d.style.lineWidth
  ctx.setLineDash(d.style.lineDash ?? [])
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (selected) {
    ctx.shadowColor = d.style.color
    ctx.shadowBlur = 6
  } else {
    ctx.shadowBlur = 0
  }
}

function drawTrendline(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: TrendlineDrawing,
  selected: boolean
) {
  const a = toPx(bridge, d.p1)
  const b = toPx(bridge, d.p2)
  if (!a || !b) return
  applyStroke(ctx, d, selected)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawHorizontal(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: HorizontalDrawing,
  width: number,
  selected: boolean
) {
  const y = bridge.priceToCoordinate(d.price)
  if (y === null) return
  applyStroke(ctx, d, selected)
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(width, y)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.fillStyle = d.style.color
  ctx.font = '10px sans-serif'
  ctx.fillText(d.price.toFixed(2), 4, y - 4)
}

function drawVertical(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: VerticalDrawing,
  height: number,
  selected: boolean
) {
  const x = bridge.timeToCoordinate(d.time as any)
  if (x === null) return
  applyStroke(ctx, d, selected)
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawRectangle(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: RectangleDrawing,
  selected: boolean
) {
  const a = toPx(bridge, d.p1)
  const b = toPx(bridge, d.p2)
  if (!a || !b) return
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x)
  const h = Math.abs(b.y - a.y)
  applyStroke(ctx, d, selected)
  const opacity = d.style.fillOpacity ?? 0.12
  ctx.fillStyle = hexToRgba(d.style.color, opacity)
  ctx.fillRect(x, y, w, h)
  ctx.strokeRect(x, y, w, h)
  ctx.shadowBlur = 0
}

function drawChannel(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: ChannelDrawing,
  selected: boolean
) {
  const a = toPx(bridge, d.p1)
  const b = toPx(bridge, d.p2)
  const c = toPx(bridge, d.p3)
  if (!a || !b || !c) return

  const dx = b.x - a.x
  const dy = b.y - a.y
  const dPx = { x: c.x + dx, y: c.y + dy }

  applyStroke(ctx, d, selected)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(c.x, c.y)
  ctx.lineTo(dPx.x, dPx.y)
  ctx.stroke()

  const opacity = d.style.fillOpacity ?? 0.08
  ctx.fillStyle = hexToRgba(d.style.color, opacity)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineTo(dPx.x, dPx.y)
  ctx.lineTo(c.x, c.y)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawFibRetracement(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: FibRetracementDrawing,
  selected: boolean
) {
  const a = toPx(bridge, d.p1)
  const b = toPx(bridge, d.p2)
  if (!a || !b) return

  const priceRange = d.p2.price - d.p1.price
  applyStroke(ctx, d, selected)

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

  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.shadowBlur = 0
}

function drawFibExtension(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: FibExtensionDrawing,
  selected: boolean
) {
  const a = toPx(bridge, d.p1)
  const b = toPx(bridge, d.p2)
  const c = toPx(bridge, d.p3)
  if (!a || !b || !c) return

  const move = d.p2.price - d.p1.price
  applyStroke(ctx, d, selected)

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
  ctx.shadowBlur = 0
}

function drawText(
  ctx: CanvasRenderingContext2D,
  bridge: CoordinateBridge,
  d: TextDrawing,
  selected: boolean
) {
  const p = toPx(bridge, d.point)
  if (!p) return
  if (selected) {
    ctx.shadowColor = d.style.color
    ctx.shadowBlur = 6
  }
  ctx.fillStyle = d.style.color
  ctx.font = `${d.style.fontSize ?? 12}px sans-serif`
  ctx.fillText(d.text, p.x + 4, p.y - 4)
  ctx.shadowBlur = 0
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
    ctx.beginPath()
    ctx.arc(h.x, h.y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

/** Paint all drawings onto ctx using bridge for coordinate conversion */
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
    switch (d.tool) {
      case 'trendline':
        drawTrendline(ctx, bridge, d, selected)
        break
      case 'horizontal':
        drawHorizontal(ctx, bridge, d, width, selected)
        break
      case 'vertical':
        drawVertical(ctx, bridge, d, height, selected)
        break
      case 'rectangle':
        drawRectangle(ctx, bridge, d, selected)
        break
      case 'channel':
        drawChannel(ctx, bridge, d, selected)
        break
      case 'fib_retracement':
        drawFibRetracement(ctx, bridge, d, selected)
        break
      case 'fib_extension':
        drawFibExtension(ctx, bridge, d, selected)
        break
      case 'text':
        drawText(ctx, bridge, d, selected)
        break
    }
    if (selected && d.id !== 'preview') {
      drawHandles(ctx, bridge, d)
    }
  }
}
