/**
 * Hit-testing drawings in pixel space.
 */

import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Drawing, LogicalPoint } from './types'

const HIT_TOLERANCE = 12

function toPx(
  bridge: CoordinateBridge,
  p: LogicalPoint
): { x: number; y: number } | null {
  const px = bridge.toPixel({ time: p.time as any, price: p.price })
  if (!px) return null
  return px
}

function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function nearPoint(
  px: number,
  py: number,
  qx: number,
  qy: number,
  tol = HIT_TOLERANCE + 4
): boolean {
  return Math.hypot(px - qx, py - qy) <= tol
}

export type HandleId = 'p1' | 'p2' | 'p3' | 'body'

export interface HitResult {
  id: string
  handle: HandleId
}

export function hitTestDrawing(
  bridge: CoordinateBridge,
  d: Drawing,
  x: number,
  y: number,
  _width: number,
  _height: number
): HandleId | null {
  switch (d.tool) {
    case 'trendline':
    case 'ray':
    case 'arrow':
    case 'fib_retracement':
    case 'measure': {
      const a = toPx(bridge, d.p1)
      const b = toPx(bridge, d.p2)
      if (!a || !b) return null
      if (nearPoint(x, y, a.x, a.y)) return 'p1'
      if (nearPoint(x, y, b.x, b.y)) return 'p2'
      if (distPointToSegment(x, y, a.x, a.y, b.x, b.y) <= HIT_TOLERANCE) return 'body'
      return null
    }
    case 'horizontal': {
      const yy = bridge.priceToCoordinate(d.price)
      if (yy === null) return null
      if (Math.abs(y - yy) <= HIT_TOLERANCE) return 'body'
      return null
    }
    case 'vertical': {
      const xx = bridge.timeToCoordinate(d.time as any)
      if (xx === null) return null
      if (Math.abs(x - xx) <= HIT_TOLERANCE) return 'body'
      return null
    }
    case 'crossline': {
      const p = toPx(bridge, d.point)
      if (!p) return null
      if (Math.abs(y - p.y) <= HIT_TOLERANCE || Math.abs(x - p.x) <= HIT_TOLERANCE)
        return 'body'
      return null
    }
    case 'rectangle':
    case 'ellipse': {
      const a = toPx(bridge, d.p1)
      const b = toPx(bridge, d.p2)
      if (!a || !b) return null
      if (nearPoint(x, y, a.x, a.y)) return 'p1'
      if (nearPoint(x, y, b.x, b.y)) return 'p2'
      const left = Math.min(a.x, b.x)
      const right = Math.max(a.x, b.x)
      const top = Math.min(a.y, b.y)
      const bottom = Math.max(a.y, b.y)
      const inside = x >= left && x <= right && y >= top && y <= bottom
      if (inside) return 'body'
      return null
    }
    case 'triangle': {
      const a = toPx(bridge, d.p1)
      const b = toPx(bridge, d.p2)
      const c = toPx(bridge, d.p3)
      if (!a || !b || !c) return null
      if (nearPoint(x, y, a.x, a.y)) return 'p1'
      if (nearPoint(x, y, b.x, b.y)) return 'p2'
      if (nearPoint(x, y, c.x, c.y)) return 'p3'
      if (
        distPointToSegment(x, y, a.x, a.y, b.x, b.y) <= HIT_TOLERANCE ||
        distPointToSegment(x, y, b.x, b.y, c.x, c.y) <= HIT_TOLERANCE ||
        distPointToSegment(x, y, c.x, c.y, a.x, a.y) <= HIT_TOLERANCE
      )
        return 'body'
      return null
    }
    case 'channel': {
      const a = toPx(bridge, d.p1)
      const b = toPx(bridge, d.p2)
      const c = toPx(bridge, d.p3)
      if (!a || !b || !c) return null
      if (nearPoint(x, y, a.x, a.y)) return 'p1'
      if (nearPoint(x, y, b.x, b.y)) return 'p2'
      if (nearPoint(x, y, c.x, c.y)) return 'p3'
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dPx = { x: c.x + dx, y: c.y + dy }
      if (
        distPointToSegment(x, y, a.x, a.y, b.x, b.y) <= HIT_TOLERANCE ||
        distPointToSegment(x, y, c.x, c.y, dPx.x, dPx.y) <= HIT_TOLERANCE
      )
        return 'body'
      return null
    }
    case 'fib_extension':
    case 'long_position':
    case 'short_position': {
      const a = toPx(bridge, d.p1)
      const b = toPx(bridge, d.p2)
      const c = toPx(bridge, d.p3)
      if (!a || !b || !c) return null
      if (nearPoint(x, y, a.x, a.y)) return 'p1'
      if (nearPoint(x, y, b.x, b.y)) return 'p2'
      if (nearPoint(x, y, c.x, c.y)) return 'p3'
      if (
        distPointToSegment(x, y, a.x, a.y, b.x, b.y) <= HIT_TOLERANCE ||
        distPointToSegment(x, y, b.x, b.y, c.x, c.y) <= HIT_TOLERANCE
      )
        return 'body'
      return null
    }
    case 'polyline': {
      for (let i = 0; i < d.points.length; i++) {
        const p = toPx(bridge, d.points[i])
        if (p && nearPoint(x, y, p.x, p.y)) return i === 0 ? 'p1' : i === 1 ? 'p2' : 'body'
      }
      for (let i = 0; i < d.points.length - 1; i++) {
        const a = toPx(bridge, d.points[i])
        const b = toPx(bridge, d.points[i + 1])
        if (a && b && distPointToSegment(x, y, a.x, a.y, b.x, b.y) <= HIT_TOLERANCE)
          return 'body'
      }
      return null
    }
    case 'text': {
      const p = toPx(bridge, d.point)
      if (!p) return null
      if (x >= p.x - 4 && x <= p.x + 100 && y >= p.y - 20 && y <= p.y + 8) return 'body'
      if (nearPoint(x, y, p.x, p.y)) return 'p1'
      return null
    }
    default:
      return null
  }
}

export function hitTestAll(
  bridge: CoordinateBridge,
  drawings: Drawing[],
  x: number,
  y: number,
  width: number,
  height: number
): HitResult | null {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i]
    const handle = hitTestDrawing(bridge, d, x, y, width, height)
    if (handle) return { id: d.id, handle }
  }
  return null
}

export function getHandlePixels(
  bridge: CoordinateBridge,
  d: Drawing
): { id: HandleId; x: number; y: number }[] {
  const out: { id: HandleId; x: number; y: number }[] = []
  const add = (id: HandleId, p: LogicalPoint) => {
    const px = toPx(bridge, p)
    if (px) out.push({ id, x: px.x, y: px.y })
  }
  switch (d.tool) {
    case 'trendline':
    case 'ray':
    case 'arrow':
    case 'rectangle':
    case 'ellipse':
    case 'fib_retracement':
    case 'measure':
      add('p1', d.p1)
      add('p2', d.p2)
      break
    case 'triangle':
    case 'channel':
    case 'fib_extension':
    case 'long_position':
    case 'short_position':
      add('p1', d.p1)
      add('p2', d.p2)
      add('p3', d.p3)
      break
    case 'horizontal': {
      const y = bridge.priceToCoordinate(d.price)
      if (y !== null) out.push({ id: 'body', x: 40, y })
      break
    }
    case 'vertical': {
      const x = bridge.timeToCoordinate(d.time as any)
      if (x !== null) out.push({ id: 'body', x, y: 40 })
      break
    }
    case 'crossline':
      add('p1', d.point)
      break
    case 'polyline':
      d.points.forEach((p, i) => add(i === 0 ? 'p1' : i === 1 ? 'p2' : 'body', p))
      break
    case 'text':
      add('p1', d.point)
      break
  }
  return out
}
