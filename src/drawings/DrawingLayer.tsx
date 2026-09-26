/**
 * DrawingLayer – transparent canvas overlay on top of Lightweight Charts.
 *
 * Anti-pellicola:
 * - All drawings stored as time+price only
 * - Every paint converts via CoordinateBridge (official LWC APIs)
 * - Redraws on visible range change, resize, and drawing list updates
 * - Survives panel drag/resize because canvas resizes with container
 *   and bridge is re-queried on every frame of interaction
 */

import { useEffect, useRef, useCallback } from 'react'
import type { CoordinateBridge } from '@/charts/coordinate-bridge'
import type { Drawing, DrawingTool, LogicalPoint } from './types'
import {
  createDrawingId,
  defaultStyle,
} from './types'
import { renderDrawings } from './renderers'
import { useDrawingStore } from './drawingStore'

interface DrawingLayerProps {
  panelId: string
  symbol: string
  bridge: CoordinateBridge | null
  /** Chart container element – canvas is sized to match */
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function DrawingLayer({ panelId, symbol, bridge, containerRef }: DrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawings = useDrawingStore((s) => s.getDrawings(panelId, symbol))
  const activeTool = useDrawingStore((s) => s.activeTool)
  const activeColor = useDrawingStore((s) => s.activeColor)
  const addDrawing = useDrawingStore((s) => s.addDrawing)
  const loadFromStorage = useDrawingStore((s) => s.loadFromStorage)
  const selectedId = useDrawingStore((s) => s.selectedId)
  const setSelectedId = useDrawingStore((s) => s.setSelectedId)
  const removeDrawing = useDrawingStore((s) => s.removeDrawing)

  // Interaction state for multi-click tools
  const draftRef = useRef<{
    tool: DrawingTool
    points: LogicalPoint[]
  } | null>(null)
  const previewRef = useRef<Drawing | null>(null)

  // Load persisted drawings when panel/symbol changes
  useEffect(() => {
    loadFromStorage(panelId, symbol)
    draftRef.current = null
    previewRef.current = null
  }, [panelId, symbol, loadFromStorage])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const parent = containerRef.current
    if (!canvas || !parent || !bridge) return

    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w <= 0 || h <= 0) return

    // HiDPI
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
    renderDrawings(ctx, bridge, current, w, h, previewRef.current)
  }, [bridge, containerRef, panelId, symbol])

  // Redraw when drawings change
  useEffect(() => {
    paint()
  }, [drawings, paint])

  // Subscribe to visible range + resize → always re-query bridge (anti-pellicola)
  useEffect(() => {
    if (!bridge) return

    const unsubRange = bridge.onVisibleRangeChange(() => paint())

    const parent = containerRef.current
    let ro: ResizeObserver | null = null
    if (parent) {
      ro = new ResizeObserver(() => paint())
      ro.observe(parent)
    }

    // Also repaint after chart data may shift scales
    const interval = window.setInterval(() => paint(), 500)

    return () => {
      unsubRange()
      ro?.disconnect()
      window.clearInterval(interval)
    }
  }, [bridge, paint, containerRef])

  // Keyboard: Delete selected, Escape cancel draft
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        draftRef.current = null
        previewRef.current = null
        paint()
        useDrawingStore.getState().setActiveTool('cursor')
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        removeDrawing(panelId, symbol, selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, panelId, symbol, removeDrawing, paint])

  const eventToLogical = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): LogicalPoint | null => {
      if (!bridge || !canvasRef.current) return null
      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const logical = bridge.fromPixel({ x, y })
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
            return {
              ...base,
              tool: 'channel',
              p1: points[0],
              p2: points[1],
              p3: cursor,
            }
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
          return {
            ...base,
            tool: 'text',
            point: cursor,
            text: '…',
          }
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
            drawing = {
              ...base,
              tool: 'fib_retracement',
              p1: points[0],
              p2: points[1],
            }
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
              drawing = {
                ...base,
                tool: 'text',
                point: points[0],
                text: text.trim(),
              }
            }
          }
          break
        }
      }

      if (drawing) {
        addDrawing(panelId, symbol, drawing)
      }
      draftRef.current = null
      previewRef.current = null
      paint()
    },
    [activeColor, addDrawing, panelId, symbol, paint]
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
    if (activeTool === 'cursor') {
      setSelectedId(null)
      return
    }
    e.preventDefault()
    e.stopPropagation()

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
    if (activeTool === 'cursor' || !draftRef.current) return
    const pt = eventToLogical(e)
    if (!pt) return
    previewRef.current = buildPreview(
      draftRef.current.tool,
      draftRef.current.points,
      pt
    )
    paint()
  }

  const interactive = activeTool !== 'cursor'

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[5]"
      style={{
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: interactive ? 'crosshair' : 'default',
      }}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
    />
  )
}
