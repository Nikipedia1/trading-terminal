/**
 * Indicators button + customization panel (KuCoin-style dark).
 */

import { useIndicatorStore } from '@/stores/indicatorStore'
import {
  INDICATOR_CATALOG,
  type IndicatorId,
  type IndicatorParams,
} from '@/indicators'

function NumField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-terminal-muted">
      <span className="w-8 shrink-0">{label}</span>
      <input
        type="number"
        className="w-12 bg-terminal-bg border border-terminal-border rounded px-1 py-0.5 text-terminal-text font-mono-nums"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
      />
    </label>
  )
}

function ColorDot({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      type="color"
      value={value.length === 7 ? value : '#888888'}
      onChange={(e) => onChange(e.target.value)}
      className="w-5 h-5 cursor-pointer border border-terminal-border rounded bg-transparent p-0"
      title="Color"
    />
  )
}

function ParamRow({
  id,
  params,
  onPatch,
}: {
  id: IndicatorId
  params: IndicatorParams
  onPatch: (patch: Partial<IndicatorParams>) => void
}) {
  if (id === 'sma' || id === 'ema') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <NumField label="P1" value={params.period} min={1} max={500} onChange={(n) => onPatch({ period: n })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
        <NumField label="P2" value={params.period2} min={0} max={500} onChange={(n) => onPatch({ period2: n })} />
        <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} />
        <NumField label="P3" value={params.period3} min={0} max={500} onChange={(n) => onPatch({ period3: n })} />
        <ColorDot value={params.color3} onChange={(v) => onPatch({ color3: v })} />
      </div>
    )
  }
  if (id === 'bb') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <NumField label="Len" value={params.period} min={2} max={200} onChange={(n) => onPatch({ period: n })} />
        <NumField label="Mult" value={params.mult} min={0.5} max={5} step={0.1} onChange={(n) => onPatch({ mult: n })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
        <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} />
        <ColorDot value={params.color3} onChange={(v) => onPatch({ color3: v })} />
      </div>
    )
  }
  if (id === 'vwap') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
        <span className="text-[10px] text-terminal-muted">from loaded candles</span>
      </div>
    )
  }
  if (id === 'rsi' || id === 'atr') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <NumField label="Len" value={params.period} min={2} max={100} onChange={(n) => onPatch({ period: n })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
      </div>
    )
  }
  if (id === 'macd') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <NumField label="Fast" value={params.period} min={2} max={100} onChange={(n) => onPatch({ period: n })} />
        <NumField label="Slow" value={params.period2} min={3} max={200} onChange={(n) => onPatch({ period2: n })} />
        <NumField label="Sig" value={params.period3} min={2} max={50} onChange={(n) => onPatch({ period3: n })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
        <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} />
      </div>
    )
  }
  if (id === 'stoch') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <NumField label="%K" value={params.period} min={2} max={100} onChange={(n) => onPatch({ period: n })} />
        <NumField label="Sm" value={params.period2} min={1} max={20} onChange={(n) => onPatch({ period2: n })} />
        <NumField label="%D" value={params.period3} min={1} max={20} onChange={(n) => onPatch({ period3: n })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
        <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} />
      </div>
    )
  }
  return null
}

export function IndicatorsMenu({ panelId }: { panelId: string }) {
  const menuPanelId = useIndicatorStore((s) => s.menuPanelId)
  const byPanel = useIndicatorStore((s) => s.byPanel)
  const toggleMenu = useIndicatorStore((s) => s.toggleMenu)
  const closeMenu = useIndicatorStore((s) => s.closeMenu)
  const setVisible = useIndicatorStore((s) => s.setVisible)
  const setParams = useIndicatorStore((s) => s.setParams)
  const resetPanel = useIndicatorStore((s) => s.resetPanel)
  const getParams = useIndicatorStore((s) => s.getParams)

  const open = menuPanelId === panelId
  const params = getParams(panelId)
  // subscribe to byPanel so UI updates
  void byPanel

  const activeCount = INDICATOR_CATALOG.filter((m) => params[m.id].visible).length

  return (
    <div className="relative">
      <button
        type="button"
        title="Indicators"
        className={`text-xxs px-1.5 py-0.5 rounded border ${
          open || activeCount > 0
            ? 'bg-terminal-blue/30 text-terminal-blue border-terminal-blue/50'
            : 'text-terminal-muted border-terminal-border hover:text-terminal-text'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          toggleMenu(panelId)
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        ƒx Indicators{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-40 w-[22rem] max-h-[70vh] overflow-auto bg-terminal-panel border border-terminal-border rounded shadow-lg p-2 text-terminal-text"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold">Indicators</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="text-[10px] text-terminal-muted hover:text-terminal-text px-1"
                onClick={() => resetPanel(panelId)}
              >
                Reset
              </button>
              <button
                type="button"
                className="text-terminal-muted hover:text-terminal-text text-xs px-1"
                onClick={closeMenu}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="text-[10px] text-terminal-muted mb-2 leading-tight">
            Computed from real OHLCV on this panel. Overlay on price; oscillators in lower panes.
          </div>

          <ul className="flex flex-col gap-1">
            {INDICATOR_CATALOG.map((meta) => {
              const p = params[meta.id]
              return (
                <li
                  key={meta.id}
                  className="border border-terminal-border/60 rounded px-1.5 py-1 bg-terminal-bg/40"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.visible}
                      onChange={(e) => setVisible(panelId, meta.id, e.target.checked)}
                      className="accent-[#f0b90b]"
                    />
                    <span className="text-xs font-medium w-10">{meta.short}</span>
                    <span className="text-[10px] text-terminal-muted flex-1 truncate">
                      {meta.description}
                    </span>
                    <span className="text-[9px] uppercase text-terminal-muted">
                      {meta.pane === 'overlay' ? 'price' : 'pane'}
                    </span>
                  </label>
                  {p.visible && (
                    <ParamRow
                      id={meta.id}
                      params={p}
                      onPatch={(patch) => setParams(panelId, meta.id, patch)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
