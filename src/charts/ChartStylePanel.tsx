/**
 * ChartStylePanel – theme presets + customize candle/canvas colors.
 */

import { useChartStyleStore, CHART_THEME_PRESETS } from '@/stores/chartStyleStore'

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
          value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#888888'}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-6 cursor-pointer border border-terminal-border rounded bg-transparent p-0"
          title={label}
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
  const applyTheme = useChartStyleStore((s) => s.applyTheme)
  const resetStyle = useChartStyleStore((s) => s.resetStyle)
  const setPanelOpen = useChartStyleStore((s) => s.setPanelOpen)

  if (!open) return null

  const { candle, canvas } = style

  return (
    <div
      className="absolute top-2 right-2 z-40 w-72 max-h-[min(90vh,520px)] overflow-y-auto bg-terminal-panel border border-terminal-border rounded shadow-lg p-2 text-terminal-text"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      data-no-pan
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

      <div className="text-xxs text-terminal-muted uppercase tracking-wider mb-1">Temi</div>
      <div className="grid grid-cols-3 gap-1 mb-3">
        {Object.entries(CHART_THEME_PRESETS).map(([id, preset]) => (
          <button
            key={id}
            type="button"
            className="text-[10px] px-1 py-1.5 rounded border border-terminal-border hover:border-[#f0b90b]/60 hover:bg-[#f0b90b]/10 transition-colors truncate"
            title={preset.label}
            onClick={() => applyTheme(id)}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
              style={{ background: preset.style.candle.upBody }}
            />
            <span
              className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
              style={{ background: preset.style.candle.downBody }}
            />
            {preset.label}
          </button>
        ))}
      </div>

      <div className="text-xxs text-terminal-muted uppercase tracking-wider mb-1">Candele</div>
      <div className="flex flex-col gap-1 mb-2">
        <ColorField
          label="Body up"
          value={candle.upBody}
          onChange={(v) => setCandle({ upBody: v, upBorder: v })}
        />
        <ColorField
          label="Body down"
          value={candle.downBody}
          onChange={(v) => setCandle({ downBody: v, downBorder: v })}
        />
        <ColorField
          label="Wick up"
          value={candle.upWick}
          onChange={(v) => setCandle({ upWick: v })}
        />
        <ColorField
          label="Wick down"
          value={candle.downWick}
          onChange={(v) => setCandle({ downWick: v })}
        />
      </div>

      <div className="text-xxs text-terminal-muted uppercase tracking-wider mb-1">Canvas</div>
      <div className="flex flex-col gap-1 mb-2">
        <ColorField
          label="Background"
          value={canvas.background}
          onChange={(v) => setCanvas({ background: v })}
        />
        <ColorField
          label="Grid"
          value={canvas.grid}
          onChange={(v) => setCanvas({ grid: v })}
        />
        <ColorField
          label="Text"
          value={canvas.text}
          onChange={(v) => setCanvas({ text: v })}
        />
        <ColorField
          label="Border"
          value={canvas.border}
          onChange={(v) => setCanvas({ border: v })}
        />
      </div>

      <button
        type="button"
        className="w-full text-xxs py-1 rounded border border-terminal-border text-terminal-muted hover:text-terminal-text"
        onClick={resetStyle}
      >
        Reset default
      </button>
    </div>
  )
}
