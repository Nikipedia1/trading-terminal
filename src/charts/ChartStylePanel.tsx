/**
 * ChartStylePanel – customize candle body/wick and canvas colors.
 */

import { useChartStyleStore } from '@/stores/chartStyleStore'

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
  const resetStyle = useChartStyleStore((s) => s.resetStyle)
  const setPanelOpen = useChartStyleStore((s) => s.setPanelOpen)

  if (!open) return null

  const { candle, canvas } = style

  return (
    <div
      className="absolute top-2 right-2 z-40 w-60 bg-terminal-panel border border-terminal-border rounded shadow-lg p-2 text-terminal-text"
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
        <ColorField label="Wick up" value={candle.upWick} onChange={(v) => setCandle({ upWick: v })} />
        <ColorField
          label="Wick down"
          value={candle.downWick}
          onChange={(v) => setCandle({ downWick: v })}
        />
        <ColorField
          label="Border up"
          value={candle.upBorder}
          onChange={(v) => setCandle({ upBorder: v })}
        />
        <ColorField
          label="Border down"
          value={candle.downBorder}
          onChange={(v) => setCandle({ downBorder: v })}
        />
      </div>

      <div className="text-xxs text-terminal-muted uppercase tracking-wider mb-1">Canvas</div>
      <div className="flex flex-col gap-1 mb-2">
        <ColorField
          label="Sfondo"
          value={canvas.background}
          onChange={(v) => setCanvas({ background: v })}
        />
        <ColorField label="Griglia" value={canvas.grid} onChange={(v) => setCanvas({ grid: v })} />
        <ColorField label="Testo" value={canvas.text} onChange={(v) => setCanvas({ text: v })} />
        <ColorField
          label="Bordo"
          value={canvas.border}
          onChange={(v) => setCanvas({ border: v })}
        />
      </div>

      <div className="text-xxs text-terminal-muted uppercase tracking-wider mb-1 mt-1">Preset</div>
      <div className="flex flex-wrap gap-1 mb-2">
        <button
          type="button"
          className="text-xxs px-1.5 py-0.5 rounded border border-terminal-border hover:border-[#0ecb81]"
          title="KuCoin green/red"
          onClick={() => {
            setCandle({
              upBody: '#0ecb81',
              downBody: '#f6465d',
              upBorder: '#0ecb81',
              downBorder: '#f6465d',
              upWick: '#0ecb81',
              downWick: '#f6465d',
            })
          }}
        >
          KuCoin
        </button>
        <button
          type="button"
          className="text-xxs px-1.5 py-0.5 rounded border border-terminal-border hover:border-[#26a69a]"
          title="Classic teal/red"
          onClick={() => {
            setCandle({
              upBody: '#26a69a',
              downBody: '#ef5350',
              upBorder: '#26a69a',
              downBorder: '#ef5350',
              upWick: '#26a69a',
              downWick: '#ef5350',
            })
          }}
        >
          Classic
        </button>
        <button
          type="button"
          className="text-xxs px-1.5 py-0.5 rounded border border-terminal-border hover:border-[#f0b90b]"
          title="Mono white/gray"
          onClick={() => {
            setCandle({
              upBody: '#eaecef',
              downBody: '#848e9c',
              upBorder: '#eaecef',
              downBorder: '#848e9c',
              upWick: '#eaecef',
              downWick: '#848e9c',
            })
          }}
        >
          Mono
        </button>
      </div>
      <div className="flex gap-1 mt-1">
        <button
          type="button"
          className="flex-1 text-xxs py-1 rounded border border-terminal-border text-terminal-muted hover:text-terminal-text"
          onClick={resetStyle}
        >
          Reset default
        </button>
      </div>
    </div>
  )
}
