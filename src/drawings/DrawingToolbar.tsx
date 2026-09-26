/**
 * Drawing toolbar – Pan | Sel | draw tools | edit actions.
 */

import { useRef } from 'react'
import { useDrawingStore } from './drawingStore'
import type { DrawingTool } from './types'

const DRAW_TOOLS: { id: DrawingTool; label: string; title: string }[] = [
  { id: 'trendline', label: '／', title: 'Trendline (2 clicks)' },
  { id: 'horizontal', label: '─', title: 'Horizontal line' },
  { id: 'vertical', label: '│', title: 'Vertical line' },
  { id: 'rectangle', label: '▭', title: 'Rectangle (2 clicks)' },
  { id: 'channel', label: '≡', title: 'Parallel channel (3 clicks)' },
  { id: 'fib_retracement', label: 'Fib', title: 'Fibonacci retracement (2 clicks)' },
  { id: 'fib_extension', label: 'Ext', title: 'Fibonacci extension (3 clicks)' },
  { id: 'text', label: 'T', title: 'Text annotation' },
]

const COLORS = ['#1e90ff', '#0ecb81', '#f6465d', '#f0b90b', '#eaecef', '#a855f7']

interface DrawingToolbarProps {
  panelId: string
  symbol: string
}

export function DrawingToolbar({ panelId, symbol }: DrawingToolbarProps) {
  const activeTool = useDrawingStore((s) => s.activeTool)
  const activeColor = useDrawingStore((s) => s.activeColor)
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)
  const setActiveColor = useDrawingStore((s) => s.setActiveColor)
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

  const applyColor = (color: string) => {
    setActiveColor(color)
    if (selectedId && selectedDrawing) {
      updateDrawing(panelId, symbol, selectedId, {
        style: { ...selectedDrawing.style, color },
      })
    }
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

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 h-full flex-wrap"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="Pan – trascina libero (orizzontale + verticale). Doppio clic = reset auto-scale. Zoom rotella. Scorciatoia: H"
        onClick={() => setActiveTool('pan')}
        className={`px-2 py-0.5 text-xs rounded border font-medium ${modeBtn(activeTool === 'pan')}`}
      >
        ✋ Pan
      </button>

      <button
        type="button"
        title="Selezione disegni – clicca per selezionare/modificare (scorciatoia: V)"
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

      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={selectedId ? `Ricolora selezionato → ${c}` : c}
          onClick={() => applyColor(c)}
          className={`w-4 h-4 rounded-sm border-2 shrink-0 ${
            activeColor === c ? 'border-white' : 'border-terminal-border'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}

      <span className="w-px h-4 bg-terminal-border mx-0.5 shrink-0" />

      {selectedId && (
        <>
          <span className="text-xxs text-terminal-blue shrink-0">selezionato</span>
          {selectedDrawing?.tool === 'text' && (
            <button
              type="button"
              title="Modifica testo"
              onClick={onEditText}
              className="px-1.5 py-0.5 text-xxs text-terminal-text border border-terminal-border rounded hover:bg-terminal-hover"
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
            Deselect
          </button>
          <span className="w-px h-4 bg-terminal-border mx-0.5 shrink-0" />
        </>
      )}

      <button
        type="button"
        title="Export JSON"
        onClick={onExport}
        className="px-1.5 py-0.5 text-xxs text-terminal-text border border-terminal-border rounded hover:bg-terminal-hover"
      >
        Export
      </button>
      <button
        type="button"
        title="Import JSON"
        onClick={() => fileRef.current?.click()}
        className="px-1.5 py-0.5 text-xxs text-terminal-text border border-terminal-border rounded hover:bg-terminal-hover"
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
        title="Cancella tutti i disegni"
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
        <span className="text-xxs text-terminal-muted ml-auto pr-1">
          {drawingCount} obj
        </span>
      )}
    </div>
  )
}
