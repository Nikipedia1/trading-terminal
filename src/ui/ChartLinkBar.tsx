/**
 * Chart link bar – follow a chart panel or pick own symbol / timeframe.
 * Used by analysis widgets (AI, Quant Lab, 3D, micro, etc.).
 */
import { SYMBOL_PRESETS, ALL_INTERVALS } from '@/data/symbols'
import { formatSymbolOption } from '@/data/symbolMeta'
import { SUPPORTED_EXCHANGES, EXCHANGE_LABELS } from '@/data/exchanges/registry'
import type { Interval, ExchangeId } from '@/types'
import type { ChartLinkMode } from '@/hooks/useChartLink'
import type { ChartPanelConfig } from '@/types'

export interface ChartLinkBarProps {
  mode: ChartLinkMode
  setMode: (m: ChartLinkMode) => void
  panels: ChartPanelConfig[]
  linkedPanelId: string
  setLinkedPanelId: (id: string | null) => void
  symbol: string
  interval: Interval
  exchange: ExchangeId
  customSymbol: string
  setCustomSymbol: (s: string) => void
  customInterval: Interval
  setCustomInterval: (i: Interval) => void
  customExchange: ExchangeId
  setCustomExchange: (e: ExchangeId) => void
  applyToChart: () => void
  makePrimary: () => void
  isPrimary: boolean
  /** Compact single-row layout */
  dense?: boolean
}

export function ChartLinkBar(p: ChartLinkBarProps) {
  return (
    <div
      className={`shrink-0 flex flex-wrap items-center gap-1.5 px-2 py-1 border-b border-[#2b3139] bg-[#0d1118]/80 ${
        p.dense ? 'text-[10px]' : 'text-[11px]'
      }`}
    >
      <span className="text-[9px] uppercase tracking-wider text-[#5e6673] shrink-0">Chart</span>

      <select
        className="bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] text-[#eaecef] max-w-[9rem]"
        value={p.linkedPanelId}
        onChange={(e) => p.setLinkedPanelId(e.target.value || null)}
        title="Chart panel to follow"
      >
        {p.panels.length === 0 ? (
          <option value="">No chart</option>
        ) : (
          p.panels.map((c) => (
            <option key={c.id} value={c.id}>
              {(c.id === p.linkedPanelId && p.isPrimary ? '★ ' : '') +
                `${c.symbol} ${c.interval}`}
            </option>
          ))
        )}
      </select>

      <div className="flex rounded border border-[#2b3139] overflow-hidden">
        <button
          type="button"
          className={`px-1.5 py-0.5 text-[10px] ${
            p.mode === 'follow'
              ? 'bg-[#f0b90b]/20 text-[#f0b90b]'
              : 'text-[#848e9c] hover:text-[#eaecef]'
          }`}
          onClick={() => p.setMode('follow')}
          title="Follow selected chart symbol & TF"
        >
          Follow
        </button>
        <button
          type="button"
          className={`px-1.5 py-0.5 text-[10px] border-l border-[#2b3139] ${
            p.mode === 'custom'
              ? 'bg-[#5b8def]/20 text-[#5b8def]'
              : 'text-[#848e9c] hover:text-[#eaecef]'
          }`}
          onClick={() => p.setMode('custom')}
          title="Own symbol & timeframe (independent feed)"
        >
          Own
        </button>
      </div>

      {p.mode === 'follow' ? (
        <>
          <span className="font-mono text-[10px] text-[#c8cdd5]">
            {p.symbol} · {p.interval}
          </span>
          {!p.isPrimary && (
            <button
              type="button"
              className="text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#f0b90b] hover:border-[#f0b90b]/40"
              onClick={p.makePrimary}
              title="Set this chart as primary (desk feed)"
            >
              ★ Primary
            </button>
          )}
        </>
      ) : (
        <>
          <input
            className="bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-0.5 text-[10px] font-mono w-[5.5rem] text-[#eaecef]"
            value={p.customSymbol}
            list="chart-link-symbols"
            placeholder="BTCUSDT"
            onChange={(e) =>
              p.setCustomSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            }
          />
          <datalist id="chart-link-symbols">
            {SYMBOL_PRESETS.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {formatSymbolOption(s.symbol)}
              </option>
            ))}
          </datalist>
          <select
            className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px] text-[#eaecef]"
            value={p.customInterval}
            onChange={(e) => p.setCustomInterval(e.target.value as Interval)}
          >
            {ALL_INTERVALS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <select
            className="bg-[#12161c] border border-[#2b3139] rounded px-1 py-0.5 text-[10px] text-[#eaecef] max-w-[6rem]"
            value={p.customExchange}
            onChange={(e) => p.setCustomExchange(e.target.value as ExchangeId)}
          >
            {SUPPORTED_EXCHANGES.map((ex) => (
              <option key={ex} value={ex}>
                {EXCHANGE_LABELS[ex] ?? ex}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="text-[10px] px-1.5 py-0.5 rounded border border-[#5b8def]/40 text-[#5b8def] hover:bg-[#5b8def]/15"
            onClick={p.applyToChart}
            title="Push symbol/TF to the linked chart panel"
          >
            → Chart
          </button>
        </>
      )}
    </div>
  )
}
