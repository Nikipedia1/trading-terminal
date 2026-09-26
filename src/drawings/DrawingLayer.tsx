/**
 * DrawingLayer – overlay canvas.
 *
 * Modes:
 * - pan:    pointer-events NONE → Lightweight Charts receives drag/scroll/zoom
 * - cursor: pointer-events AUTO → select / drag drawings
 * - tools:  pointer-events AUTO → create drawings
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Drawing, DrawingTool, LogicalPoint } from './types'
import { createDrawingId, defaultStyle } from './types'
import { renderDrawings } from './renderers'
import { useDrawingStore } from './drawingStore'
import { hitTestAll, type HandleId } from './hitTest'

interface DrawingLayerProps {
  panelId: string
  symbol: string
  bridge: CoordinateBridge | null
  containerRef: React.RefObject<HTMLDivElement | null>
}

interface DragState {
  id: string
  handle: HandleId
  origin: Drawing
  startLogical: LogicalPoint
}

export function DrawingLayer({ panelId, symbol, bridge, containerRef }: DrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawings = useDrawingStore((s) => {
    const sym = symbol.toUpperCase()
    return s.byPanelSymbol[panelId]?.[sym] ?? EMPTY_DRAWINGS
  })
  const activeTool = useDrawingStore((s) => s.activeTool)
  const activeColor = useDrawingStore((s) => s.activeColor)
  const addDrawing = useDrawingStore((s) => s.addDrawing)
  const updateDrawing = useDrawingStore((s) => s.updateDrawing)
  const loadFromStorage = useDrawingStore((s) => s.loadFromStorage)
  const selectedId = useDrawingStore((s) => s.selectedId)
  const setSelectedId = useDrawingStore((s) => s.setSelectedId)
  const removeDrawing = useDrawingStore((s) => s.removeDrawing)

  const draftRef = useRef<{ tool: DrawingTool; points: LogicalPoint[] } | null>(null)
  const previewRef = useRef<Drawing | null>(null)
  const dragRef = useRef<DragState | null>(null)

  useEffect(() => {
    loadFromStorage(panelId, symbol)
    draftRef.current = null
    previewRef.current = null
    dragRef.current = null
  }, [panelId, symbol, loadFromStorage])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const parent = containerRef.current
    if (!canvas || !parent || !bridge) return

    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w <= 0 || h <= 0) return

    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const current = useDrawingStore.getState().getDrawings(panelId, symbol)
    const sel = useDrawingStore.getState().selectedId
    renderDrawings(ctx, bridge, current, w, h, previewRef.current, sel)
  }, [bridge, containerRef, panelId, symbol])

  useEffect(() => {
    paint()
  }, [drawings, selectedId, paint])

  useEffect(() => {
    if (!bridge) return
    const unsubRange = bridge.onVisibleRangeChange(() => paint())
    const parent = containerRef.current
    let ro: ResizeObserver | null = null
    if (parent) {
      ro = new ResizeObserver(() => paint())
      ro.observe(parent)
    }
    const interval = window.setInterval(() => paint(), 500)
    return () => {
      unsubRange()
      ro?.disconnect()
      window.clearInterval(interval)
    }
  }, [bridge, paint, containerRef])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Space held → temporary pan feel via switching (optional shortcut)
      if (e.key === 'Escape') {
        draftRef.current = null
        previewRef.current = null
        dragRef.current = null
        setSelectedId(null)
        useDrawingStore.getState().setActiveTool('pan')
        paint()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        removeDrawing(panelId, symbol, selectedId)
      }
      // V = select, H = pan (common CAD-like shortcuts)
      if (e.key === 'v' || e.key === 'V') {
        useDrawingStore.getState().setActiveTool('cursor')
      }
      if (e.key === 'h' || e.key === 'H') {
        useDrawingStore.getState().setActiveTool('pan')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, panelId, symbol, removeDrawing, paint, setSelectedId])

  const eventToPixel = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return null
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const eventToLogical = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): LogicalPoint | null => {
      if (!bridge) return null
      const pix = eventToPixel(e)
      if (!pix) return null
      const logical = bridge.fromPixel(pix)
      if (!logical || logical.time === null || logical.price === null) return null
      const time =
        typeof logical.time === 'number'
          ? logical.time
          : (logical.time as any).timestamp ?? null
      if (time === null || typeof time !== 'number') return null
      return { time, price: logical.price }
    },
    [bridge]
  )

  const applyDrag = (
    origin: Drawing,
    handle: HandleId,
    start: LogicalPoint,
    cur: LogicalPoint
  ): Partial<Drawing> => {
    const dTime = cur.time - start.time
    const dPrice = cur.price - start.price
    const shift = (p: LogicalPoint): LogicalPoint => ({
      time: p.time + dTime,
      price: p.price + dPrice,
    })

    switch (origin.tool) {
      case 'trendline':
      case 'rectangle':
      case 'fib_retracement': {
        if (handle === 'p1') return { p1: cur } as Partial<Drawing>
        if (handle === 'p2') return { p2: cur } as Partial<Drawing>
        return { p1: shift(origin.p1), p2: shift(origin.p2) } as Partial<Drawing>
      }
      case 'channel':
      case 'fib_extension': {
        if (handle === 'p1') return { p1: cur } as Partial<Drawing>
        if (handle === 'p2') return { p2: cur } as Partial<Drawing>
        if (handle === 'p3') return { p3: cur } as Partial<Drawing>
        return {
          p1: shift(origin.p1),
          p2: shift(origin.p2),
          p3: shift(origin.p3),
        } as Partial<Drawing>
      }
      case 'horizontal':
        return { price: cur.price } as Partial<Drawing>
      case 'vertical':
        return { time: cur.time } as Partial<Drawing>
      case 'text':
        return {
          point: handle === 'p1' || handle === 'body' ? cur : shift(origin.point),
        } as Partial<Drawing>
      default:
        return {}
    }
  }

  const buildPreview = useCallback(
    (tool: DrawingTool, points: LogicalPoint[], cursor: LogicalPoint): Drawing | null => {
      const style = defaultStyle({ color: activeColor })
      const now = Date.now()
      const base = { id: 'preview', style, createdAt: now, updatedAt: now }

      switch (tool) {
        case 'trendline':
          if (points.length >= 1)
            return { ...base, tool: 'trendline', p1: points[0], p2: cursor }
          return null
        case 'horizontal':
          return { ...base, tool: 'horizontal', price: cursor.price }
        case 'vertical':
          return { ...base, tool: 'vertical', time: cursor.time }
        case 'rectangle':
          if (points.length >= 1)
            return { ...base, tool: 'rectangle', p1: points[0], p2: cursor }
          return null
        case 'channel':
          if (points.length === 1)
            return { ...base, tool: 'trendline', p1: points[0], p2: cursor } as any
          if (points.length >= 2)
            return { ...base, tool: 'channel', p1: points[0], p2: points[1], p3: cursor }
          return null
        case 'fib_retracement':
          if (points.length >= 1)
            return { ...base, tool: 'fib_retracement', p1: points[0], p2: cursor }
          return null
        case 'fib_extension':
          if (points.length === 1)
            return { ...base, tool: 'trendline', p1: points[0], p2: cursor } as any
          if (points.length >= 2)
            return {
              ...base,
              tool: 'fib_extension',
              p1: points[0],
              p2: points[1],
              p3: cursor,
            }
          return null
        case 'text':
          return { ...base, tool: 'text', point: cursor, text: '…' }
        default:
          return null
      }
    },
    [activeColor]
  )

  const finalize = useCallback(
    (tool: DrawingTool, points: LogicalPoint[]) => {
      const style = defaultStyle({ color: activeColor })
      const now = Date.now()
      const id = createDrawingId()
      const base = { id, style, createdAt: now, updatedAt: now }
      let drawing: Drawing | null = null

      switch (tool) {
        case 'trendline':
          if (points.length >= 2)
            drawing = { ...base, tool: 'trendline', p1: points[0], p2: points[1] }
          break
        case 'horizontal':
          if (points.length >= 1)
            drawing = { ...base, tool: 'horizontal', price: points[0].price }
          break
        case 'vertical':
          if (points.length >= 1)
            drawing = { ...base, tool: 'vertical', time: points[0].time }
          break
        case 'rectangle':
          if (points.length >= 2)
            drawing = { ...base, tool: 'rectangle', p1: points[0], p2: points[1] }
          break
        case 'channel':
          if (points.length >= 3)
            drawing = {
              ...base,
              tool: 'channel',
              p1: points[0],
              p2: points[1],
              p3: points[2],
            }
          break
        case 'fib_retracement':
          if (points.length >= 2)
            drawing = { ...base, tool: 'fib_retracement', p1: points[0], p2: points[1] }
          break
        case 'fib_extension':
          if (points.length >= 3)
            drawing = {
              ...base,
              tool: 'fib_extension',
              p1: points[0],
              p2: points[1],
              p3: points[2],
            }
          break
        case 'text': {
          if (points.length >= 1) {
            const text = window.prompt('Annotation text:', 'Note')
            if (text && text.trim()) {
              drawing = { ...base, tool: 'text', point: points[0], text: text.trim() }
            }
          }
          break
        }
      }

      if (drawing) {
        addDrawing(panelId, symbol, drawing)
        setSelectedId(drawing.id)
        useDrawingStore.getState().setActiveTool('cursor')
      }
      draftRef.current = null
      previewRef.current = null
      paint()
    },
    [activeColor, addDrawing, panelId, symbol, paint, setSelectedId]
  )

  const pointsNeeded = (tool: DrawingTool): number => {
    switch (tool) {
      case 'horizontal':
      case 'vertical':
      case 'text':
        return 1
      case 'trendline':
      case 'rectangle':
      case 'fib_retracement':
        return 2
      case 'channel':
      case 'fib_extension':
        return 3
      default:
        return 0
    }
  }

  const onPointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Pan mode: events should not reach here (pointer-events:none), but guard anyway
    if (activeTool === 'pan') return

    if (!bridge || !containerRef.current) return
    const pix = eventToPixel(e)
    if (!pix) return
    const w = containerRef.current.clientWidth
    const h = containerRef.current.clientHeight
    const current = useDrawingStore.getState().getDrawings(panelId, symbol)

    if (activeTool === 'cursor') {
      const hit = hitTestAll(bridge, current, pix.x, pix.y, w, h)
      if (hit) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedId(hit.id)
        const origin = current.find((d) => d.id === hit.id)
        const logical = eventToLogical(e)
        if (origin && logical) {
          dragRef.current = {
            id: hit.id,
            handle: hit.handle,
            origin: JSON.parse(JSON.stringify(origin)) as Drawing,
            startLogical: logical,
          }
        }
        paint()
      } else {
        setSelectedId(null)
        paint()
      }
      return
    }

    e.preventDefault()
    e.stopPropagation()
    setSelectedId(null)

    const pt = eventToLogical(e)
    if (!pt) return

    const needed = pointsNeeded(activeTool)
    if (needed === 0) return

    if (!draftRef.current || draftRef.current.tool !== activeTool) {
      draftRef.current = { tool: activeTool, points: [pt] }
    } else {
      draftRef.current.points.push(pt)
    }

    if (draftRef.current.points.length >= needed) {
      finalize(activeTool, draftRef.current.points)
    } else {
      previewRef.current = buildPreview(activeTool, draftRef.current.points, pt)
      paint()
    }
  }

  const onPointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'pan') return
    if (!bridge || !containerRef.current) return

    if (dragRef.current && activeTool === 'cursor') {
      const logical = eventToLogical(e)
      if (!logical) return
      e.preventDefault()
      const { id, handle, origin, startLogical } = dragRef.current
      const patch = applyDrag(origin, handle, startLogical, logical)
      updateDrawing(panelId, symbol, id, patch)
      return
    }

    if (activeTool !== 'cursor' && draftRef.current) {
      const pt = eventToLogical(e)
      if (!pt) return
      previewRef.current = buildPreview(
        draftRef.current.tool,
        draftRef.current.points,
        pt
      )
      paint()
    }
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  // Pan = let events pass through to Lightweight Charts
  const capturePointer = activeTool !== 'pan'

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[5]"
      style={{
        pointerEvents: capturePointer ? 'auto' : 'none',
        cursor:
          activeTool === 'pan'
            ? 'default'
            : activeTool === 'cursor'
              ? 'default'
              : 'crosshair',
      }}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onMouseLeave={onPointerUp}
    />
  )
}

const EMPTY_DRAWINGS: Drawing[] = []
