/**
 * Full drawing tools for 3D Pro — same tool set as 2D chart + line style controls.
 * Stored in drawingStore under panelId "viz3d" (per symbol).
 */

import { useCallback, useEffect, useState } from 'react'
import { useDrawingStore } from '@/drawings/drawingStore'
import {
  createDrawingId,
  defaultStyle,
  type Drawing,
  type DrawingTool,
  type LineStyleKind,
  type LineEndKind,
  type LogicalPoint,
} from '@/drawings/types'
import type { Viz3DModel } from './types'

const PANEL_ID = 'viz3d'

const DRAW_TOOLS: { id: DrawingTool; label: string; title: string }[] = [
  { id: 'trendline', label: '／', title: 'Trendline (2 click)' },
  { id: 'ray', label: '↗', title: 'Ray (2 click)' },
  { id: 'arrow', label: '→', title: 'Freccia (2 click)' },
  { id: 'horizontal', label: '─', title: 'Orizzontale' },
  { id: 'vertical', label: '│', title: 'Verticale' },
  { id: 'crossline', label: '+', title: 'Croce H+V' },
  { id: 'rectangle', label: '▭', title: 'Rettangolo (2 click)' },
  { id: 'triangle', label: '△', title: 'Triangolo (3 click)' },
  { id: 'ellipse', label: '◯', title: 'Ellisse (2 click)' },
  { id: 'channel', label: '≡', title: 'Canale (3 click)' },
  { id: 'fib_retracement', label: 'Fib', title: 'Fib retracement' },
  { id: 'fib_extension', label: 'Ext', title: 'Fib extension' },
  { id: 'measure', label: 'Δ', title: 'Misura' },
  { id: 'long_position', label: 'L↑', title: 'Long position' },
  { id: 'short_position', label: 'S↓', title: 'Short position' },
  { id: 'polyline', label: '∠', title: 'Polyline (doppio click chiude)' },
  { id: 'text', label: 'T', title: 'Testo' },
]

const COLORS = ['#1e90ff', '#0ecb81', '#f6465d', '#f0b90b', '#eaecef', '#a855f7', '#ff6b35', '#ff2d95']
const WIDTHS = [1, 1.5, 2, 3, 4]

function pointsNeeded(tool: DrawingTool): number {
  switch (tool) {
    case 'horizontal':
    case 'vertical':
    case 'crossline':
    case 'text':
      return 1
    case 'trendline':
    case 'ray':
    case 'arrow':
    case 'rectangle':
    case 'ellipse':
    case 'fib_retracement':
    case 'measure':
      return 2
    case 'channel':
    case 'fib_extension':
    case 'triangle':
    case 'long_position':
    case 'short_position':
      return 3
    case 'polyline':
      return 99
    default:
      return 0
  }
}

function screenToLogical(
  clientX: number,
  clientY: number,
  el: HTMLElement,
  model: Viz3DModel
): LogicalPoint | null {
  const rect = el.getBoundingClientRect()
  if (rect.width < 8 || rect.height < 8) return null
  const nx = (clientX - rect.left) / rect.width
  const ny = (clientY - rect.top) / rect.height
  const pMin = model.priceMin
  const pMax = model.priceMax
  if (!(pMax > pMin)) return null
  const price = pMax - ny * (pMax - pMin)
  const bars = model.candles?.length ? model.candles : null
  let time = Date.now() / 1000
  if (bars && bars.length >= 2) {
    const t0 = bars[0].time
    const t1 = bars[bars.length - 1].time
    time = t0 + nx * (t1 - t0)
  } else if (model.barCount > 0) {
    time = Date.now() / 1000 - (1 - nx) * 3600
  }
  return { time, price }
}

function buildDrawing(
  tool: DrawingTool,
  points: LogicalPoint[],
  style: ReturnType<typeof defaultStyle>
): Drawing | null {
  const now = Date.now()
  const id = createDrawingId()
  const base = { id, style, createdAt: now, updatedAt: now }

  switch (tool) {
    case 'horizontal':
      return { ...base, tool, price: points[0].price }
    case 'vertical':
      return { ...base, tool, time: points[0].time }
    case 'crossline':
      return { ...base, tool, point: points[0] }
    case 'text': {
      const text = window.prompt('Testo', 'Note') ?? ''
      if (!text.trim()) return null
      return { ...base, tool, point: points[0], text: text.trim() }
    }
    case 'trendline':
    case 'ray':
    case 'arrow':
    case 'rectangle':
    case 'ellipse':
    case 'fib_retracement':
    case 'measure':
      return { ...base, tool, p1: points[0], p2: points[1] } as Drawing
    case 'triangle':
    case 'channel':
    case 'fib_extension':
    case 'long_position':
    case 'short_position':
      return { ...base, tool, p1: points[0], p2: points[1], p3: points[2] } as Drawing
    case 'polyline':
      return { ...base, tool, points: [...points] }
    default:
      return null
  }
}

interface Viz3DDrawOverlayProps {
  symbol: string
  model: Viz3DModel
  containerRef: React.RefObject<HTMLElement | null>
  onDrawingsChange?: (drawings: Drawing[]) => void
}

export function Viz3DDrawOverlay({
  symbol,
  model,
  containerRef,
  onDrawingsChange,
}: Viz3DDrawOverlayProps) {
  const activeTool = useDrawingStore((s) => s.activeTool)
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)
  const activeColor = useDrawingStore((s) => s.activeColor)
  const setActiveColor = useDrawingStore((s) => s.setActiveColor)
  const activeLineWidth = useDrawingStore((s) => s.activeLineWidth)
  const setActiveLineWidth = useDrawingStore((s) => s.setActiveLineWidth)
  const activeLineStyle = useDrawingStore((s) => s.activeLineStyle)
  const setActiveLineStyle = useDrawingStore((s) => s.setActiveLineStyle)
  const activeLineEnd = useDrawingStore((s) => s.activeLineEnd)
  const setActiveLineEnd = useDrawingStore((s) => s.setActiveLineEnd)
  const addDrawing = useDrawingStore((s) => s.addDrawing)
  const clearDrawings = useDrawingStore((s) => s.clearDrawings)
  const loadFromStorage = useDrawingStore((s) => s.loadFromStorage)
  const getDrawings = useDrawingStore((s) => s.getDrawings)
  const drawings = useDrawingStore((s) => s.getDrawings(PANEL_ID, symbol))

  const [draftPts, setDraftPts] = useState<LogicalPoint[]>([])
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    loadFromStorage(PANEL_ID, symbol)
  }, [symbol, loadFromStorage])

  useEffect(() => {
    onDrawingsChange?.(getDrawings(PANEL_ID, symbol))
  }, [drawings, symbol, getDrawings, onDrawingsChange])

  const makeStyle = useCallback(
    () =>
      defaultStyle({
        color: activeColor,
        lineWidth: activeLineWidth,
        lineStyle: activeLineStyle,
        lineEnd: activeLineEnd,
      }),
    [activeColor, activeLineWidth, activeLineStyle, activeLineEnd]
  )

  const finish = useCallback(
    (pts: LogicalPoint[]) => {
      const d = buildDrawing(activeTool, pts, makeStyle())
      if (d) {
        addDrawing(PANEL_ID, symbol, d)
        if (activeTool === 'measure' && pts.length >= 2) {
          const dp = pts[1].price - pts[0].price
          const pct = pts[0].price !== 0 ? (dp / pts[0].price) * 100 : 0
          const dt = Math.abs(pts[1].time - pts[0].time)
          setHint(`Δ ${dp.toPrecision(5)} (${pct.toFixed(2)}%) · ${dt.toFixed(0)}s`)
          window.setTimeout(() => setHint(null), 3000)
        }
      }
      setDraftPts([])
      setActiveTool('pan')
    },
    [activeTool, addDrawing, symbol, makeStyle, setActiveTool]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onUp = (e: PointerEvent) => {
      if (activeTool === 'pan' || activeTool === 'cursor') return
      const start = (onUp as unknown as { _start?: { x: number; y: number; t: number } })._start
      if (start) {
        const dx = e.clientX - start.x
        const dy = e.clientY - start.y
        if (Math.hypot(dx, dy) > 8) return
      }
      const p = screenToLogical(e.clientX, e.clientY, el, model)
      if (!p) return
      e.stopPropagation()
      e.preventDefault()

      if (activeTool === 'polyline') {
        const isDouble = start && Date.now() - start.t < 350 && draftPts.length >= 2
        if (isDouble || (e.detail >= 2 && draftPts.length >= 2)) {
          finish([...draftPts, p])
          return
        }
        const next = [...draftPts, p]
        setDraftPts(next)
        setHint(`Polyline · ${next.length} pt · doppio click per chiudere`)
        return
      }

      const need = pointsNeeded(activeTool)
      const next = [...draftPts, p]
      if (next.length >= need) {
        finish(next.slice(0, need))
      } else {
        setDraftPts(next)
        setHint(`${activeTool} · punto ${next.length}/${need}`)
      }
    }

    const onDown = (e: PointerEvent) => {
      ;(onUp as unknown as { _start?: { x: number; y: number; t: number } })._start = {
        x: e.clientX,
        y: e.clientY,
        t: Date.now(),
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraftPts([])
        setActiveTool('pan')
        setHint(null)
      }
      if (e.key === 'Enter' && activeTool === 'polyline' && draftPts.length >= 2) {
        finish(draftPts)
      }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [activeTool, model, containerRef, draftPts, finish, setActiveTool])

  const drawingMode = activeTool !== 'pan' && activeTool !== 'cursor'

  return (
    <>
      <div
        className="absolute top-1 left-1 right-1 z-20 flex flex-col gap-1 max-w-full"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-0.5 rounded border border-[#2b3139] bg-[#0b0e11]/92 px-1 py-1 shadow">
          <span className="text-[9px] text-[#f0b90b] font-semibold px-1">DRAW</span>
          <button
            type="button"
            title="Pan / ruota"
            className={`text-[10px] px-1.5 py-0.5 rounded border ${
              activeTool === 'pan'
                ? 'border-[#f0b90b] bg-[#f0b90b]/15 text-[#f0b90b]'
                : 'border-[#2b3139] text-[#848e9c]'
            }`}
            onClick={() => {
              setDraftPts([])
              setActiveTool('pan')
            }}
          >
            Pan
          </button>
          {DRAW_TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.title}
              className={`text-[10px] px-1 py-0.5 rounded border ${
                activeTool === t.id
                  ? 'border-[#f0b90b] bg-[#f0b90b]/15 text-[#f0b90b]'
                  : 'border-[#2b3139] text-[#848e9c] hover:border-[#5e6673]'
              }`}
              onClick={() => {
                setDraftPts([])
                setActiveTool(t.id)
                setHint(t.title)
              }}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            title="Cancella disegni 3D"
            className="text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#f6465d] hover:border-[#f6465d]/60"
            onClick={() => {
              clearDrawings(PANEL_ID, symbol)
              setDraftPts([])
              onDrawingsChange?.([])
            }}
          >
            CLR
          </button>
          <span className="text-[9px] text-[#5e6673] px-1">{drawings.length}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded border border-[#2b3139] bg-[#0b0e11]/92 px-1.5 py-1 shadow">
          <span className="text-[9px] text-[#5e6673]">Stile</span>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              className={`w-4 h-4 rounded-sm border ${
                activeColor === c ? 'border-[#eaecef] scale-110' : 'border-[#2b3139]'
              }`}
              style={{ background: c }}
              onClick={() => setActiveColor(c)}
            />
          ))}
          <input
            type="color"
            value={/^#[0-9A-Fa-f]{6}$/.test(activeColor) ? activeColor : '#1e90ff'}
            className="w-5 h-4 cursor-pointer border-0 p-0 bg-transparent"
            onChange={(e) => setActiveColor(e.target.value)}
          />
          <span className="text-[9px] text-[#5e6673] ml-1">W</span>
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              className={`text-[9px] px-1 py-0.5 rounded border ${
                activeLineWidth === w
                  ? 'border-[#f0b90b] text-[#f0b90b]'
                  : 'border-[#2b3139] text-[#848e9c]'
              }`}
              onClick={() => setActiveLineWidth(w)}
            >
              {w}
            </button>
          ))}
          <span className="text-[9px] text-[#5e6673] ml-1">Linea</span>
          {(
            [
              ['solid', '━━'],
              ['dashed', '╌'],
              ['dotted', '··'],
            ] as [LineStyleKind, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              title={id}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                activeLineStyle === id
                  ? 'border-[#f0b90b] text-[#f0b90b]'
                  : 'border-[#2b3139] text-[#848e9c]'
              }`}
              onClick={() => setActiveLineStyle(id)}
            >
              {label}
            </button>
          ))}
          <span className="text-[9px] text-[#5e6673] ml-1">End</span>
          {(
            [
              ['none', '·'],
              ['arrow', '→'],
              ['circle', '●'],
            ] as [LineEndKind, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              title={id}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                activeLineEnd === id
                  ? 'border-[#f0b90b] text-[#f0b90b]'
                  : 'border-[#2b3139] text-[#848e9c]'
              }`}
              onClick={() => setActiveLineEnd(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(drawingMode || hint) && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="px-2 py-0.5 rounded bg-[#0b0e11]/90 border border-[#f0b90b]/40 text-[10px] text-[#f0b90b] max-w-[90vw] text-center">
            {hint ??
              (draftPts.length
                ? `${activeTool} · ${draftPts.length}/${pointsNeeded(activeTool)}`
                : activeTool)}
            {drawingMode && ' · Esc annulla'}
          </div>
        </div>
      )}
    </>
  )
}

export const VIZ3D_DRAW_PANEL_ID = PANEL_ID
