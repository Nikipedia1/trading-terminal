/**
 * Indicators button + max-customization panel (KuCoin-style dark).
 */

import { useIndicatorStore } from '@/stores/indicatorStore'
import {
  INDICATOR_CATALOG,
  PRICE_SOURCES,
  type IndicatorId,
  type IndicatorParams,
  type PriceSource,
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
      <span className="w-9 shrink-0">{label}</span>
      <input
        type="number"
        className="w-14 bg-terminal-bg border border-terminal-border rounded px-1 py-0.5 text-terminal-text font-mono-nums"
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
  title,
}: {
  value: string
  onChange: (v: string) => void
  title?: string
}) {
  return (
    <input
      type="color"
      value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888'}
      onChange={(e) => onChange(e.target.value)}
      className="w-5 h-5 cursor-pointer border border-terminal-border rounded bg-transparent p-0"
      title={title ?? 'Color'}
    />
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-terminal-muted cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#f0b90b]"
      />
      {label}
    </label>
  )
}

function SourceSelect({
  value,
  onChange,
}: {
  value: PriceSource
  onChange: (s: PriceSource) => void
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-terminal-muted">
      <span className="w-9 shrink-0">Src</span>
      <select
        className="bg-terminal-bg border border-terminal-border rounded px-1 py-0.5 text-terminal-text text-[10px]"
        value={value}
        onChange={(e) => onChange(e.target.value as PriceSource)}
      >
        {PRICE_SOURCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  )
}

function WidthField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <NumField label={label} value={value} min={1} max={4} onChange={onChange} />
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
  const commonSource = (
    <SourceSelect value={params.source} onChange={(s) => onPatch({ source: s })} />
  )

  if (id === 'sma' || id === 'ema') {
    return (
      <div className="flex flex-col gap-1 pl-5 py-1">
        <div className="flex flex-wrap items-center gap-2">
          {commonSource}
          <Toggle label="L1" checked={params.show1} onChange={(v) => onPatch({ show1: v })} />
          <NumField label="P1" value={params.period} min={1} max={500} onChange={(n) => onPatch({ period: n })} />
          <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
          <WidthField label="W1" value={params.lineWidth} onChange={(n) => onPatch({ lineWidth: n })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="L2" checked={params.show2} onChange={(v) => onPatch({ show2: v })} />
          <NumField label="P2" value={params.period2} min={0} max={500} onChange={(n) => onPatch({ period2: n })} />
          <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} />
          <WidthField label="W2" value={params.lineWidth2} onChange={(n) => onPatch({ lineWidth2: n })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="L3" checked={params.show3} onChange={(v) => onPatch({ show3: v })} />
          <NumField label="P3" value={params.period3} min={0} max={500} onChange={(n) => onPatch({ period3: n })} />
          <ColorDot value={params.color3} onChange={(v) => onPatch({ color3: v })} />
          <WidthField label="W3" value={params.lineWidth3} onChange={(n) => onPatch({ lineWidth3: n })} />
        </div>
      </div>
    )
  }

  if (id === 'wma' || id === 'hull' || id === 'dema' || id === 'tema') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        {commonSource}
        <NumField label="Len" value={params.period} min={2} max={500} onChange={(n) => onPatch({ period: n })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
        <WidthField label="W" value={params.lineWidth} onChange={(n) => onPatch({ lineWidth: n })} />
      </div>
    )
  }

  if (id === 'bb' || id === 'donchian' || id === 'keltner') {
    return (
      <div className="flex flex-col gap-1 pl-5 py-1">
        <div className="flex flex-wrap items-center gap-2">
          {id !== 'donchian' && commonSource}
          <NumField label="Len" value={params.period} min={2} max={200} onChange={(n) => onPatch({ period: n })} />
          {id === 'keltner' && (
            <NumField label="ATR" value={params.period2} min={1} max={100} onChange={(n) => onPatch({ period2: n })} />
          )}
          {(id === 'bb' || id === 'keltner') && (
            <NumField
              label="Mult"
              value={params.mult}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(n) => onPatch({ mult: n })}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="Mid" checked={params.show2} onChange={(v) => onPatch({ show2: v })} />
          <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} title="Mid" />
          <Toggle label="Up" checked={params.show1} onChange={(v) => onPatch({ show1: v })} />
          <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} title="Upper" />
          <Toggle label="Lo" checked={params.show3} onChange={(v) => onPatch({ show3: v })} />
          <ColorDot value={params.color3} onChange={(v) => onPatch({ color3: v })} title="Lower" />
          <WidthField label="W" value={params.lineWidth} onChange={(n) => onPatch({ lineWidth: n })} />
        </div>
      </div>
    )
  }

  if (id === 'supertrend') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <NumField label="ATR" value={params.period} min={2} max={100} onChange={(n) => onPatch({ period: n })} />
        <NumField label="Mult" value={params.mult} min={0.5} max={10} step={0.1} onChange={(n) => onPatch({ mult: n })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} title="Bull" />
        <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} title="Bear" />
        <WidthField label="W" value={params.lineWidth} onChange={(n) => onPatch({ lineWidth: n })} />
      </div>
    )
  }

  if (id === 'sar') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <NumField label="Step" value={params.mult} min={0.001} max={0.5} step={0.001} onChange={(n) => onPatch({ mult: n })} />
        <NumField label="Max" value={params.mult2} min={0.01} max={1} step={0.01} onChange={(n) => onPatch({ mult2: n })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
      </div>
    )
  }

  if (id === 'ichimoku') {
    return (
      <div className="flex flex-col gap-1 pl-5 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <NumField label="Ten" value={params.period} min={2} max={100} onChange={(n) => onPatch({ period: n })} />
          <NumField label="Kij" value={params.period2} min={2} max={100} onChange={(n) => onPatch({ period2: n })} />
          <NumField label="SpB" value={params.period3} min={2} max={200} onChange={(n) => onPatch({ period3: n })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="Tenkan" checked={params.show1} onChange={(v) => onPatch({ show1: v })} />
          <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
          <Toggle label="Kijun" checked={params.show2} onChange={(v) => onPatch({ show2: v })} />
          <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} />
          <Toggle label="Spans" checked={params.show3} onChange={(v) => onPatch({ show3: v })} />
          <ColorDot value={params.color3} onChange={(v) => onPatch({ color3: v })} />
        </div>
      </div>
    )
  }

  if (id === 'vwap') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
        <WidthField label="W" value={params.lineWidth} onChange={(n) => onPatch({ lineWidth: n })} />
        <span className="text-[10px] text-terminal-muted">loaded candles</span>
      </div>
    )
  }

  if (id === 'volsma') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <NumField label="SMA" value={params.period} min={1} max={200} onChange={(n) => onPatch({ period: n })} />
        <Toggle label="Vol" checked={params.show1} onChange={(v) => onPatch({ show1: v })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} title="Vol" />
        <Toggle label="MA" checked={params.show2} onChange={(v) => onPatch({ show2: v })} />
        <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} title="SMA" />
      </div>
    )
  }

  if (id === 'rsi' || id === 'cci' || id === 'willr' || id === 'mfi') {
    return (
      <div className="flex flex-col gap-1 pl-5 py-1">
        <div className="flex flex-wrap items-center gap-2">
          {(id === 'rsi') && commonSource}
          <NumField label="Len" value={params.period} min={2} max={100} onChange={(n) => onPatch({ period: n })} />
          <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
          <WidthField label="W" value={params.lineWidth} onChange={(n) => onPatch({ lineWidth: n })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="Levels" checked={params.show2} onChange={(v) => onPatch({ show2: v })} />
          <NumField label="High" value={params.levelHigh} step={1} onChange={(n) => onPatch({ levelHigh: n })} />
          <NumField label="Low" value={params.levelLow} step={1} onChange={(n) => onPatch({ levelLow: n })} />
          <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} title="Levels" />
        </div>
      </div>
    )
  }

  if (id === 'macd') {
    return (
      <div className="flex flex-col gap-1 pl-5 py-1">
        <div className="flex flex-wrap items-center gap-2">
          {commonSource}
          <NumField label="Fast" value={params.period} min={2} max={100} onChange={(n) => onPatch({ period: n })} />
          <NumField label="Slow" value={params.period2} min={3} max={200} onChange={(n) => onPatch({ period2: n })} />
          <NumField label="Sig" value={params.period3} min={2} max={50} onChange={(n) => onPatch({ period3: n })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="MACD" checked={params.show1} onChange={(v) => onPatch({ show1: v })} />
          <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
          <Toggle label="Signal" checked={params.show2} onChange={(v) => onPatch({ show2: v })} />
          <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} />
          <Toggle label="Hist" checked={params.show3} onChange={(v) => onPatch({ show3: v })} />
          <WidthField label="W" value={params.lineWidth} onChange={(n) => onPatch({ lineWidth: n })} />
        </div>
      </div>
    )
  }

  if (id === 'stoch') {
    return (
      <div className="flex flex-col gap-1 pl-5 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <NumField label="%K" value={params.period} min={2} max={100} onChange={(n) => onPatch({ period: n })} />
          <NumField label="Sm" value={params.period2} min={1} max={20} onChange={(n) => onPatch({ period2: n })} />
          <NumField label="%D" value={params.period3} min={1} max={20} onChange={(n) => onPatch({ period3: n })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="%K" checked={params.show1} onChange={(v) => onPatch({ show1: v })} />
          <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
          <Toggle label="%D" checked={params.show2} onChange={(v) => onPatch({ show2: v })} />
          <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} />
          <Toggle label="Levels" checked={params.show3} onChange={(v) => onPatch({ show3: v })} />
          <NumField label="Hi" value={params.levelHigh} onChange={(n) => onPatch({ levelHigh: n })} />
          <NumField label="Lo" value={params.levelLow} onChange={(n) => onPatch({ levelLow: n })} />
        </div>
      </div>
    )
  }

  if (id === 'momentum' || id === 'roc' || id === 'atr') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        {id !== 'atr' && commonSource}
        <NumField label="Len" value={params.period} min={1} max={200} onChange={(n) => onPatch({ period: n })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
        <WidthField label="W" value={params.lineWidth} onChange={(n) => onPatch({ lineWidth: n })} />
      </div>
    )
  }

  if (id === 'adx') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <NumField label="Len" value={params.period} min={2} max={100} onChange={(n) => onPatch({ period: n })} />
        <Toggle label="ADX" checked={params.show1} onChange={(v) => onPatch({ show1: v })} />
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
        <Toggle label="+DI" checked={params.show2} onChange={(v) => onPatch({ show2: v })} />
        <ColorDot value={params.color2} onChange={(v) => onPatch({ color2: v })} />
        <Toggle label="−DI" checked={params.show3} onChange={(v) => onPatch({ show3: v })} />
        <ColorDot value={params.color3} onChange={(v) => onPatch({ color3: v })} />
      </div>
    )
  }

  if (id === 'obv') {
    return (
      <div className="flex flex-wrap items-center gap-2 pl-5 py-1">
        <ColorDot value={params.color} onChange={(v) => onPatch({ color: v })} />
        <WidthField label="W" value={params.lineWidth} onChange={(n) => onPatch({ lineWidth: n })} />
      </div>
    )
  }

  return null
}

const GROUPS = ['MA', 'Bands', 'Trend', 'Oscillator', 'Volume'] as const

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
          className="absolute left-0 top-full mt-1 z-40 w-[26rem] max-h-[75vh] overflow-auto bg-terminal-panel border border-terminal-border rounded shadow-lg p-2 text-terminal-text"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2 sticky top-0 bg-terminal-panel pb-1 z-10">
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
            Real OHLCV only. Source / periods / colors / widths / component toggles / OB·OS levels.
          </div>

          {GROUPS.map((g) => {
            const items = INDICATOR_CATALOG.filter((m) => m.group === g)
            return (
              <div key={g} className="mb-2">
                <div className="text-[10px] uppercase tracking-wider text-[#f0b90b]/80 mb-1 px-0.5">
                  {g}
                </div>
                <ul className="flex flex-col gap-1">
                  {items.map((meta) => {
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
                          <span className="text-xs font-medium w-12">{meta.short}</span>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
