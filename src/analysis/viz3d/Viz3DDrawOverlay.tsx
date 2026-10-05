/**
 * Drawing tools for 3D Pro — horizontal, trendline, measure.
 * Stored in drawingStore under panelId "viz3d" (per symbol).
 */

import { useCallback, useEffect, useState } from 'react'
import { useDrawingStore } from '@/drawings/drawingStore'
import {
  createDrawingId,
  defaultStyle,
  type Drawing,
  type DrawingTool,
  type HorizontalDrawing,
  type TrendlineDrawing,
  type LogicalPoint,
} from '@/drawings/types'
import type { Viz3DModel } from './types'

const PANEL_ID = 'viz3d'

const TOOLS: { id: DrawingTool; label: string; title: string }[] = [
  { id: 'pan', label: 'Pan', title: 'Ruota / pan scena' },
  { id: 'horizontal', label: 'H', title: 'Linea orizzontale (prezzo)' },
  { id: 'trendline', label: 'TL', title: 'Trendline (2 click)' },
  { id: 'measure', label: 'Δ', title: 'Misura prezzo' },
]

interface Viz3DDrawOverlayProps {
  symbol: string
  model: Viz3DModel
  containerRef: React.RefObject<HTMLElement | null>
  onDrawingsChange?: (drawings: Drawing[]) => void
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
  const addDrawing = useDrawingStore((s) => s.addDrawing)
  const clearDrawings = useDrawingStore((s) => s.clearDrawings)
  const loadFromStorage = useDrawingStore((s) => s.loadFromStorage)
  const getDrawings = useDrawingStore((s) => s.getDrawings)
  const drawings = useDrawingStore((s) => s.getDrawings(PANEL_ID, symbol))

  const [draftP1, setDraftP1] = useState<LogicalPoint | null>(null)
  const [measureLabel, setMeasureLabel] = useState<string | null>(null)

  useEffect(() => {
    loadFromStorage(PANEL_ID, symbol)
  }, [symbol, loadFromStorage])

  useEffect(() => {
    onDrawingsChange?.(getDrawings(PANEL_ID, symbol))
  }, [drawings, symbol, getDrawings, onDrawingsChange])

  const makeStyle = () =>
    defaultStyle({
      color: activeColor,
      lineWidth: activeLineWidth,
    })

  const placeHorizontal = useCallback(
    (p: LogicalPoint) => {
      const d: HorizontalDrawing = {
        id: createDrawingId(),
        tool: 'horizontal',
        price: p.price,
        style: makeStyle(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      addDrawing(PANEL_ID, symbol, d)
      setActiveTool('pan')
    },
    [addDrawing, symbol, activeColor, activeLineWidth, setActiveTool]
  )

  const placeTrend = useCallback(
    (p1: LogicalPoint, p2: LogicalPoint) => {
      const d: TrendlineDrawing = {
        id: createDrawingId(),
        tool: 'trendline',
        p1,
        p2,
        style: makeStyle(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      addDrawing(PANEL_ID, symbol, d)
      setDraftP1(null)
      setActiveTool('pan')
    },
    [addDrawing, symbol, activeColor, activeLineWidth, setActiveTool]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onUp = (e: PointerEvent) => {
      if (activeTool === 'pan' || activeTool === 'cursor') return
      const start = (onUp as unknown as { _start?: { x: number; y: number } })._start
      if (start) {
        const dx = e.clientX - start.x
        const dy = e.clientY - start.y
        if (Math.hypot(dx, dy) > 6) return
      }
      const p = screenToLogical(e.clientX, e.clientY, el, model)
      if (!p) return
      e.stopPropagation()
      e.preventDefault()

      if (activeTool === 'horizontal') {
        placeHorizontal(p)
        return
      }
      if (activeTool === 'measure') {
        setMeasureLabel(`P ${p.price.toPrecision(6)}`)
        window.setTimeout(() => setMeasureLabel(null), 2500)
        setActiveTool('pan')
        return
      }
      if (activeTool === 'trendline') {
        if (!draftP1) setDraftP1(p)
        else placeTrend(draftP1, p)
      }
    }
    const onDown = (e: PointerEvent) => {
      ;(onUp as unknown as { _start?: { x: number; y: number } })._start = {
        x: e.clientX,
        y: e.clientY,
      }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
    }
  }, [
    activeTool,
    model,
    containerRef,
    draftP1,
    placeHorizontal,
    placeTrend,
    setActiveTool,
  ])

  const drawingMode = activeTool !== 'pan' && activeTool !== 'cursor'

  return (
    <>
      <div
        className="absolute top-1 left-1 z-20 flex flex-wrap items-center gap-1 rounded border border-[#2b3139] bg-[#0b0e11]/90 px-1.5 py-1 shadow"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-[9px] text-[#f0b90b] font-semibold mr-0.5">DRAW</span>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.title}
            className={`text-[10px] px-1.5 py-0.5 rounded border ${
              activeTool === t.id
                ? 'border-[#f0b90b] bg-[#f0b90b]/15 text-[#f0b90b]'
                : 'border-[#2b3139] text-[#848e9c] hover:border-[#5e6673]'
            }`}
            onClick={() => {
              setDraftP1(null)
              setActiveTool(t.id)
            }}
          >
            {t.label}
          </button>
        ))}
        <input
          type="color"
          value={/^#[0-9A-Fa-f]{6}$/.test(activeColor) ? activeColor : '#1e90ff'}
          title="Colore"
          className="w-6 h-5 cursor-pointer border border-[#2b3139] rounded bg-transparent p-0"
          onChange={(e) => setActiveColor(e.target.value)}
        />
        <button
          type="button"
          title="Cancella tutti i disegni 3D"
          className="text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#f6465d] hover:border-[#f6465d]/60"
          onClick={() => {
            clearDrawings(PANEL_ID, symbol)
            setDraftP1(null)
            onDrawingsChange?.([])
          }}
        >
          CLR
        </button>
        <span className="text-[9px] text-[#5e6673] ml-0.5">{drawings.length}</span>
      </div>

      {drawingMode && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="px-2 py-0.5 rounded bg-[#0b0e11]/90 border border-[#f0b90b]/40 text-[10px] text-[#f0b90b]">
            {activeTool === 'horizontal' && 'Click → linea orizzontale al prezzo'}
            {activeTool === 'trendline' &&
              (draftP1 ? 'Click 2° punto trendline' : 'Click 1° punto trendline')}
            {activeTool === 'measure' && 'Click → leggi prezzo'}
          </div>
        </div>
      )}

      {measureLabel && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="px-2.5 py-1 rounded bg-[#0b0e11]/95 border border-[#2b3139] text-[12px] text-[#eaecef] font-mono">
            {measureLabel}
          </div>
        </div>
      )}
    </>
  )
}

export const VIZ3D_DRAW_PANEL_ID = PANEL_ID
