/**
 * ChartStylePanel – customize candle body/wick and canvas colors.
 */

import { useChartStyleStore, DEFAULT_CHART_STYLE } from '@/stores/chartStyleStore'

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xxs">
      <span className="text-terminal-muted shrink-0">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="color"
          value={value.length === 7 ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-5 cursor-pointer border border-terminal-border rounded bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 bg-terminal-bg border border-terminal-border rounded px-1 py-0.5 font-mono-nums text-xxs"
        />
      </span>
    </label>
  )
}

export function ChartStylePanel() {
  const open = useChartStyleStore((s) => s.panelOpen)
  const style = useChartStyleStore((s) => s.style)
  const setCandle = useChartStyleStore((s) => s.setCandle)
  const setCanvas = useChartStyleStore((s) => s.setCanvas)
  const resetStyle = useChartStyleStore((s) => s.resetStyle)
  const setPanelOpen = useChartStyleStore((s) => s.setPanelOpen)

  if (!open) return null

  const { candle, canvas } = style

  return (
    <div
      className="absolute top-2 right-2 z-30 w-56 bg-terminal-panel border border-terminal-border rounded shadow-lg p-2 text-terminal-text"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold">Stile grafico</span>
        <button
          type="button"
          className="text-terminal-muted hover:text-terminal-text text-xs px-1"
          onClick={() => setPanelOpen(false)}
        >
          ✕
        </button>
      </div>

      <div className="text-xxs text-terminal-muted uppercase tracking-wider mb-1">Candele</div>
      <div className="flex flex-col gap-1 mb-2">
        <ColorField label="Body up" value={candle.upBody} onChange={(v) => setCandle({ upBody: v, upBorder: v })} />
        <ColorField label="Body down" value={candle.downBody} onChange={(v) => setCandle({ downBody: v, downBorder: v })} />
        <ColorField label="Wick up" value={candle.upWick} onChange={(v) => setCandle({ upWick: v })} />
        <ColorField label="Wick down" value={candle.downWick} onChange={(v) => setCandle({ downWick: v })} />
        <ColorField label="Border up" value={candle.upBorder} onChange={(v) => setCandle({ upBorder: v })} />
        <ColorField label="Border down" value={candle.downBorder} onChange={(v) => setCandle({ downBorder: v })} />
      </div>

      <div className="text-xxs text-terminal-muted uppercase tracking-wider mb-1">Canvas</div>
      <div className="flex flex-col gap-1 mb-2">
        <ColorField label="Sfondo" value={canvas.background} onChange={(v) => setCanvas({ background: v })} />
        <ColorField label="Griglia" value={canvas.grid} onChange={(v) => setCanvas({ grid: v })} />
        <ColorField label="Testo" value={canvas.text} onChange={(v) => setCanvas({ text: v })} />
        <ColorField label="Bordi assi" value={canvas.border} onChange={(v) => setCanvas({ border: v })} />
      </div>

      <div className="flex gap-1 mt-1">
        <button
          type="button"
          className="flex-1 px-2 py-1 text-xxs border border-terminal-border rounded hover:bg-terminal-hover"
          onClick={resetStyle}
          title="Ripristina default KuCoin-style"
        >
          Reset
        </button>
        <button
          type="button"	le
          className="px-2 py-1 text-xxs border border-terminal-border rounded hover:bg-terminal-hover"
          onClick={() => {
            // Quick dark preset = default
            resetStyle()
          }}
        >
          Dark
        </button>
        <button
          type="button"
          className="px-2 py-1 text-xxs border border-terminal-border rounded hover:bg-terminal-hover"
          onClick={() => {
            setCanvas({
              background: '#ffffff',
              text: '#333333',
              grid: '#e5e7eb',
              border: '#d1d5db',
            })
            setCandle({
              upBody: '#16a34a',
              downBody: '#dc2626',
              upBorder: '#16a34a',
              downBorder: '#dc2626',
              upWick: '#16a34a',
              downWick: '#dc2626',
            })
          }}
        >
          Light
        </button>
      </div>

      <p className="text-[10px] text-terminal-muted mt-2 leading-tight">
        Default: up {DEFAULT_CHART_STYLE.candle.upBody} / down {DEFAULT_CHART_STYLE.candle.downBody}
      </p>
    </div>
  )
}
