/**
 * Drawing toolbar – Pan | Sel | all draw tools | style (color, width, dash, ends) | edit.
 */

import { useRef } from 'react'
import { useDrawingStore } from './drawingStore'
import type { DrawingTool, LineStyleKind, LineEndKind } from './types'

const DRAW_TOOLS: { id: DrawingTool; label: string; title: string }[] = [
  { id: 'trendline', label: '／', title: 'Trendline (2 click)' },
  { id: 'ray', label: '↗', title: 'Ray – estende a destra (2 click)' },
  { id: 'arrow', label: '→', title: 'Freccia (2 click)' },
  { id: 'horizontal', label: '─', title: 'Orizzontale' },
  { id: 'vertical', label: '│', title: 'Verticale' },
  { id: 'crossline', label: '+', title: 'Croce H+V' },
  { id: 'rectangle', label: '▭', title: 'Rettangolo (2 click)' },
  { id: 'triangle', label: '△', title: 'Triangolo (3 click)' },
  { id: 'ellipse', label: '◯', title: 'Ellisse (2 click)' },
  { id: 'channel', label: '≡', title: 'Canale parallelo (3 click)' },
  { id: 'fib_retracement', label: 'Fib', title: 'Fibonacci retracement' },
  { id: 'fib_extension', label: 'Ext', title: 'Fibonacci extension' },
  { id: 'measure', label: '📐', title: 'Misura Δprice / % / tempo' },
  { id: 'long_position', label: 'L↑', title: 'Long: entry → stop → target' },
  { id: 'short_position', label: 'S↓', title: 'Short: entry → stop → target' },
  { id: 'polyline', label: '∠', title: 'Polyline – doppio click o Enter per chiudere' },
  { id: 'text', label: 'T', title: 'Testo' },
]

const COLORS = ['#1e90ff', '#0ecb81', '#f6465d', '#f0b90b', '#eaecef', '#a855f7', '#ff6b35']
const WIDTHS = [1, 1.5, 2, 3, 4]

interface DrawingToolbarProps {
  panelId: string
  symbol: string
}

export function DrawingToolbar({ panelId, symbol }: DrawingToolbarProps) {
  const activeTool = useDrawingStore((s) => s.activeTool)
  const activeColor = useDrawingStore((s) => s.activeColor)
  const activeLineWidth = useDrawingStore((s) => s.activeLineWidth)
  const activeLineStyle = useDrawingStore((s) => s.activeLineStyle)
  const activeLineEnd = useDrawingStore((s) => s.activeLineEnd)
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)
  const setActiveColor = useDrawingStore((s) => s.setActiveColor)
  const setActiveLineWidth = useDrawingStore((s) => s.setActiveLineWidth)
  const setActiveLineStyle = useDrawingStore((s) => s.setActiveLineStyle)
  const setActiveLineEnd = useDrawingStore((s) => s.setActiveLineEnd)
  const clearDrawings = useDrawingStore((s) => s.clearDrawings)
  const exportJson = useDrawingStore((s) => s.exportJson)
  const importJson = useDrawingStore((s) => s.importJson)
  const selectedId = useDrawingStore((s) => s.selectedId)
  const removeDrawing = useDrawingStore((s) => s.removeDrawing)
  const updateDrawing = useDrawingStore((s) => s.updateDrawing)
  const setSelectedId = useDrawingStore((s) => s.setSelectedId)
  const drawingCount = useDrawingStore((s) => {
    const sym = symbol.toUpperCase()
    return s.byPanelSymbol[panelId]?.[sym]?.length ?? 0
  })
  const selectedDrawing = useDrawingStore((s) => {
    if (!s.selectedId) return null
    const sym = symbol.toUpperCase()
    return s.byPanelSymbol[panelId]?.[sym]?.find((d) => d.id === s.selectedId) ?? null
  })
  const fileRef = useRef<HTMLInputElement>(null)

  const patchStyle = (partial: Record<string, unknown>) => {
    if (selectedId && selectedDrawing) {
      updateDrawing(panelId, symbol, selectedId, {
        style: { ...selectedDrawing.style, ...partial },
      })
    }
  }

  const applyColor = (color: string) => {
    setActiveColor(color)
    patchStyle({ color })
  }

  const applyWidth = (w: number) => {
    setActiveLineWidth(w)
    patchStyle({ lineWidth: w })
  }

  const applyLineStyle = (s: LineStyleKind) => {
    setActiveLineStyle(s)
    patchStyle({ lineStyle: s, lineDash: undefined })
  }

  const applyLineEnd = (e: LineEndKind) => {
    setActiveLineEnd(e)
    patchStyle({ lineEnd: e })
  }

  const toggleExtend = (side: 'extendLeft' | 'extendRight') => {
    if (!selectedDrawing) return
    const cur = !!(selectedDrawing.style as any)[side]
    patchStyle({ [side]: !cur })
  }

  const onExport = () => {
    const json = exportJson(panelId, symbol)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `drawings-${symbol}-${panelId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const result = importJson(panelId, symbol, text)
      if (!result.ok) alert(`Import failed: ${result.error}`)
    } catch (err: any) {
      alert(`Import failed: ${err.message}`)
    }
    e.target.value = ''
  }

  const onEditText = () => {
    if (!selectedDrawing || selectedDrawing.tool !== 'text') return
    const next = window.prompt('Edit text:', selectedDrawing.text)
    if (next !== null && next.trim()) {
      updateDrawing(panelId, symbol, selectedDrawing.id, { text: next.trim() } as any)
    }
  }

  const modeBtn = (active: boolean) =>
    active
      ? 'bg-terminal-blue text-white border-terminal-blue'
      : 'text-terminal-text border-terminal-border hover:bg-terminal-hover'

  const canExtend =
    selectedDrawing &&
    (selectedDrawing.tool === 'trendline' ||
      selectedDrawing.tool === 'ray' ||
      selectedDrawing.tool === 'arrow' ||
      selectedDrawing.tool === 'horizontal')

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 h-full flex-wrap"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="Pan (H)"
        onClick={() => setActiveTool('pan')}
        className={`px-2 py-0.5 text-xs rounded border font-medium ${modeBtn(activeTool === 'pan')}`}
      >
        ✋ Pan
      </button>

      <button
        type="button"
        title="Selezione (V)"
        onClick={() => setActiveTool('cursor')}
        className={`px-2 py-0.5 text-xs rounded border font-medium ${modeBtn(activeTool === 'cursor')}`}
      >
        Sel
      </button>

      <span className="w-px h-4 bg-terminal-border mx-0.5 shrink-0" />

      {DRAW_TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.title}
          onClick={() => setActiveTool(t.id)}
          className={`px-1.5 py-0.5 text-xs rounded min-w-[24px] border ${
            activeTool === t.id
              ? 'bg-terminal-blue/30 text-terminal-blue border-terminal-blue/50'
              : 'text-terminal-text border-terminal-border hover:bg-terminal-hover'
          }`}
        >
          {t.label}
        </button>
      ))}

      <span className="w-px h-4 bg-terminal-border mx-0.5 shrink-0" />

      {/* Color */}
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => applyColor(c)}
          className={`w-4 h-4 rounded-sm border-2 shrink-0 ${
            activeColor === c ? 'border-white' : 'border-terminal-border'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}

      {/* Line width */}
      <select
        className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
        title="Spessore linea"
        value={activeLineWidth}
        onChange={(e) => applyWidth(Number(e.target.value))}
      >
        {WIDTHS.map((w) => (
          <option key={w} value={w}>
            {w}px
          </option>
        ))}
      </select>

      {/* Line style */}
      <select
        className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
        title="Tipo linea"
        value={activeLineStyle}
        onChange={(e) => applyLineStyle(e.target.value as LineStyleKind)}
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
      </select>

      {/* Line end */}
      <select
        className="bg-terminal-panel border border-terminal-border rounded px-1 py-0.5 text-xxs"
        title="Estremità linea"
        value={activeLineEnd}
        onChange={(e) => applyLineEnd(e.target.value as LineEndKind)}
      >
        <option value="none">End: none</option>
        <option value="arrow">End: arrow</option>
        <option value="circle">End: circle</option>
      </select>

      {canExtend && (
        <>
          <button
            type="button"
            title="Estendi a sinistra"
            onClick={() => toggleExtend('extendLeft')}
            className={`px-1.5 py-0.5 text-xxs rounded border ${
              selectedDrawing?.style.extendLeft
                ? 'bg-terminal-blue/30 text-terminal-blue border-terminal-blue/50'
                : 'border-terminal-border text-terminal-muted'
            }`}
          >
            ←ext
          </button>
          <button
            type="button"
            title="Estendi a destra"
            onClick={() => toggleExtend('extendRight')}
            className={`px-1.5 py-0.5 text-xxs rounded border ${
              selectedDrawing?.style.extendRight
                ? 'bg-terminal-blue/30 text-terminal-blue border-terminal-blue/50'
                : 'border-terminal-border text-terminal-muted'
            }`}
          >
            ext→
          </button>
        </>
      )}

      <span className="w-px h-4 bg-terminal-border mx-0.5 shrink-0" />

      {selectedId && (
        <>
          <span className="text-xxs text-terminal-blue shrink-0">sel</span>
          {selectedDrawing?.tool === 'text' && (
            <button
              type="button"
              title="Modifica testo"
              onClick={onEditText}
              className="px-1.5 py-0.5 text-xxs border border-terminal-border rounded hover:bg-terminal-hover"
            >
              Edit text
            </button>
          )}
          <button
            type="button"
            title="Elimina (Canc)"
            onClick={() => removeDrawing(panelId, symbol, selectedId)}
            className="px-1.5 py-0.5 text-xxs text-terminal-red border border-terminal-red/50 rounded hover:bg-terminal-red/10"
          >
            Delete
          </button>
          <button
            type="button"
            title="Deseleziona"
            onClick={() => setSelectedId(null)}
            className="px-1.5 py-0.5 text-xxs text-terminal-muted border border-terminal-border rounded hover:bg-terminal-hover"
          >
            ×
          </button>
          <span className="w-px h-4 bg-terminal-border mx-0.5 shrink-0" />
        </>
      )}

      <button
        type="button"
        title="Export JSON"
        onClick={onExport}
        className="px-1.5 py-0.5 text-xxs border border-terminal-border rounded hover:bg-terminal-hover"
      >
        Export
      </button>
      <button
        type="button"
        title="Import JSON"
        onClick={() => fileRef.current?.click()}
        className="px-1.5 py-0.5 text-xxs border border-terminal-border rounded hover:bg-terminal-hover"
      >
        Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFile}
      />

      <button
        type="button"
        title="Cancella tutti"
        onClick={() => {
          if (drawingCount && confirm(`Clear ${drawingCount} drawing(s)?`)) {
            clearDrawings(panelId, symbol)
          }
        }}
        className="px-1.5 py-0.5 text-xxs text-terminal-red border border-terminal-red/40 rounded hover:bg-terminal-red/10"
      >
        Clear
      </button>

      {drawingCount > 0 && (
        <span className="text-xxs text-terminal-muted ml-auto pr-1">{drawingCount} obj</span>
      )}
    </div>
  )
}
