/**
 * Drawing toolbar – tool selection, color, select-edit actions, export/import.
 */

import { useRef, useEffect } from 'react'
import { useDrawingStore } from './drawingStore'
import type { DrawingTool } from './types'

const TOOLS: { id: DrawingTool; label: string; title: string }[] = [
  { id: 'cursor', label: '↖', title: 'Cursor / select drawings' },
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

  // When a color is picked and something is selected → recolor that drawing
  const applyColor = (color: string) => {
    setActiveColor(color)
    if (selectedId && selectedDrawing) {
      updateDrawing(panelId, symbol, selectedId, {
        style: { ...selectedDrawing.style, color },
      })
    }
  }

  // Double-click text: edit (via toolbar hint when text selected)
  useEffect(() => {
    // no-op placeholder for future focus
  }, [selectedId])

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

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 h-full flex-wrap"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-xxs text-terminal-muted mr-1 shrink-0">Draw</span>

      {TOOLS.map((t) => (
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
          title={selectedId ? `Recolor selected → ${c}` : c}
          onClick={() => applyColor(c)}
          className={`w-4 h-4 rounded-sm border-2 shrink-0 ${
            activeColor === c ? 'border-white' : 'border-terminal-border'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}

      <span className="w-px h-4 bg-terminal-border mx-0.5 shrink-0" />

      {/* Selection actions */}
      {selectedId && (
        <>
          <span className="text-xxs text-terminal-blue shrink-0">selected</span>
          {selectedDrawing?.tool === 'text' && (
            <button
              type="button"
              title="Edit text"
              onClick={onEditText}
              className="px-1.5 py-0.5 text-xxs text-terminal-text border border-terminal-border rounded hover:bg-terminal-hover"
            >
              Edit text
            </button>
          )}
          <button
            type="button"
            title="Delete selected (Delete key)"
            onClick={() => removeDrawing(panelId, symbol, selectedId)}
            className="px-1.5 py-0.5 text-xxs text-terminal-red border border-terminal-red/50 rounded hover:bg-terminal-red/10"
          >
            Delete
          </button>
          <button
            type="button"
            title="Deselect"
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
        title="Export drawings JSON"
        onClick={onExport}
        className="px-1.5 py-0.5 text-xxs text-terminal-text border border-terminal-border rounded hover:bg-terminal-hover"
      >
        Export
      </button>
      <button
        type="button"
        title="Import drawings JSON"
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
        title="Clear all drawings on this panel/symbol"
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
