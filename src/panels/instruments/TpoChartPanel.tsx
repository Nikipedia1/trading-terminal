/**
 * TPO / Market Profile panel – period letters by price, POC, VA, IB.
 * Built from linked chart candles (OHLC period blocks).
 */
import { useMemo, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import {
  buildTpoFromCandles,
  DEFAULT_TPO_CONFIG,
  TPO_NOTE,
  type TpoModel,
} from '@/analysis/tpo'
import { MetricHonestyRow } from '@/ui/MetricHonesty'

function fmtPx(p: number | null | undefined) {
  if (p == null || !Number.isFinite(p)) return '—'
  if (p >= 1000) return p.toFixed(1)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

function fmtTime(sec: number) {
  const d = new Date(sec * 1000)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const PERIOD_OPTS = [5, 15, 30, 60] as const

export function TpoChartPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles, status } = usePanelMarket(symbol, interval, exchange)
  const [periodMinutes, setPeriodMinutes] = useState<number>(30)
  const [showSingles, setShowSingles] = useState(true)

  const model: TpoModel = useMemo(
    () =>
      buildTpoFromCandles(candles, {
        ...DEFAULT_TPO_CONFIG,
        periodMinutes,
      }),
    [candles, periodMinutes]
  )

  const maxCount = useMemo(
    () => Math.max(1, ...model.levels.map((l) => l.count)),
    [model.levels]
  )

  const levels = showSingles
    ? model.levels
    : model.levels.filter((l) => !l.isSinglePrint || l.isPoc)

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px]">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[#f0b90b] tracking-wide">TPO</span>
        <MetricHonestyRow kinds={['tpo-ohlc', 'synthetic-none']} />
        <span className="font-mono text-[#848e9c]">
          {symbol} · {interval}
        </span>
        <span className="text-[10px] text-[#5e6673]">{status}</span>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[9px] text-[#5e6673] uppercase">Period</span>
          {PERIOD_OPTS.map((m) => (
            <button
              key={m}
              type="button"
              className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                periodMinutes === m
                  ? 'border-[#f0b90b] text-[#f0b90b] bg-[#f0b90b]/10'
                  : 'border-[#2b3139] text-[#848e9c] hover:border-[#f0b90b]/40'
              }`}
              onClick={() => setPeriodMinutes(m)}
            >
              {m}m
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1 text-[10px] text-[#848e9c]">
            <input
              type="checkbox"
              checked={showSingles}
              onChange={(e) => setShowSingles(e.target.checked)}
              className="accent-[#f0b90b]"
            />
            singles
          </label>
        </div>
      </div>
      <div className="shrink-0 px-2 py-1 border-b border-[#1e2329] flex flex-wrap gap-3 text-[10px] font-mono">
        <span>
          POC <strong className="text-[#f0b90b]">{fmtPx(model.poc)}</strong>
        </span>
        <span>
          VA {fmtPx(model.val)}–{fmtPx(model.vah)}
        </span>
        <span>
          IB {fmtPx(model.ibLow)}–{fmtPx(model.ibHigh)}
        </span>
        <span className="text-[#5e6673]">TPO {model.totalTpo}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-1 py-1">
        {!levels.length && (
          <div className="h-full flex items-center justify-center text-[#5e6673]">
            Need candles…
          </div>
        )}
        {levels.map((l) => {
          const w = (l.count / maxCount) * 100
          return (
            <div
              key={l.price}
              className={`flex items-center gap-1 py-0.5 px-1 font-mono text-[10px] ${
                l.isPoc ? 'bg-[#f0b90b]/10' : l.inValueArea ? 'bg-[#1e2329]/40' : ''
              }`}
            >
              <span className="w-16 text-right text-[#848e9c]">{fmtPx(l.price)}</span>
              <div className="flex-1 h-3 bg-[#12161c] rounded-sm overflow-hidden relative">
                <div
                  className={`h-full ${l.isPoc ? 'bg-[#f0b90b]/80' : 'bg-[#5b8def]/50'}`}
                  style={{ width: `${w}%` }}
                />
                <span className="absolute inset-0 px-1 truncate text-[9px] leading-3 text-[#eaecef]/90">
                  {l.letters.join('')}
                </span>
              </div>
              <span className="w-6 text-right text-[#5e6673]">{l.count}</span>
            </div>
          )
        })}
      </div>
      <div className="shrink-0 px-2 py-1 border-t border-[#1e2329] text-[9px] text-[#5e6673]">
        {TPO_NOTE} · tick {model.tickSize}
        {model.periods[0] && (
          <span className="ml-2">
            {fmtTime(model.periods[0].timeSec)}
            {model.periods.length > 1
              ? ` → ${fmtTime(model.periods[model.periods.length - 1]!.timeSec)}`
              : ''}
          </span>
        )}
      </div>
    </div>
  )
}
