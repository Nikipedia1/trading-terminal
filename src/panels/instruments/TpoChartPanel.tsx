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
          <label className="flex items-center gap-1 text-[10px] text-[#848e9c] ml-1 cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#f0b90b]"
              checked={showSingles}
              onChange={(e) => setShowSingles(e.target.checked)}
            />
            singles
          </label>
        </div>
      </div>

      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-1 font-mono text-[10px]">
        <div>
          <div className="text-[9px] text-[#5e6673] uppercase">POC</div>
          <div className="text-[#f0b90b] font-semibold">{fmtPx(model.poc)}</div>
        </div>
        <div>
          <div className="text-[9px] text-[#5e6673] uppercase">VAH</div>
          <div className="text-[#0ecb81]">{fmtPx(model.vah)}</div>
        </div>
        <div>
          <div className="text-[9px] text-[#5e6673] uppercase">VAL</div>
          <div className="text-[#f6465d]">{fmtPx(model.val)}</div>
        </div>
        <div>
          <div className="text-[9px] text-[#5e6673] uppercase">IB High</div>
          <div>{fmtPx(model.ibHigh)}</div>
        </div>
        <div>
          <div className="text-[9px] text-[#5e6673] uppercase">IB Low</div>
          <div>{fmtPx(model.ibLow)}</div>
        </div>
        <div>
          <div className="text-[9px] text-[#5e6673] uppercase">TPOs</div>
          <div>
            {model.totalTpo} · {model.periods.length} per
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {levels.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#5e6673] px-4 text-center">
            Nessun TPO — carica history / avvia Live sul chart collegato.
          </div>
        ) : (
          <div className="min-w-max">
            {levels.map((lv) => {
              const barPct = (lv.count / maxCount) * 100
              const bg = lv.isPoc
                ? 'rgba(240, 185, 11, 0.22)'
                : lv.inValueArea
                  ? 'rgba(14, 203, 129, 0.08)'
                  : 'transparent'
              return (
                <div
                  key={lv.price}
                  className="flex items-center gap-1 px-2 border-b border-[#12161c] hover:bg-[#12161c]/80"
                  style={{ background: bg, minHeight: 18 }}
                >
                  <span
                    className={`w-[72px] shrink-0 font-mono tabular-nums text-right pr-1 ${
                      lv.isPoc
                        ? 'text-[#f0b90b] font-semibold'
                        : lv.inValueArea
                          ? 'text-[#eaecef]'
                          : 'text-[#848e9c]'
                    }`}
                  >
                    {fmtPx(lv.price)}
                  </span>
                  <div className="relative flex-1 min-w-[120px] h-[16px]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm"
                      style={{
                        width: `${barPct}%`,
                        background: lv.isPoc
                          ? 'rgba(240, 185, 11, 0.35)'
                          : lv.inValueArea
                            ? 'rgba(14, 203, 129, 0.18)'
                            : 'rgba(43, 49, 57, 0.5)',
                      }}
                    />
                    <span className="relative z-[1] font-mono text-[10px] tracking-tight pl-0.5 leading-[16px] text-[#c8cdd5]">
                      {lv.letters.join('')}
                      {lv.isSinglePrint && (
                        <span className="text-[#f6465d] ml-0.5" title="Single print">
                          ·
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="w-6 shrink-0 text-right font-mono text-[9px] text-[#5e6673]">
                    {lv.count}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {model.periods.length > 0 && (
        <div className="shrink-0 border-t border-[#1e2329] px-2 py-1 max-h-[72px] overflow-y-auto">
          <div className="text-[9px] text-[#5e6673] uppercase mb-0.5">Periods</div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[9px]">
            {model.periods.map((p) => (
              <span key={p.timeSec} className="text-[#848e9c]">
                <span className="text-[#f0b90b]">{p.letter}</span> {fmtTime(p.timeSec)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 px-2 py-1 border-t border-[#1e2329] text-[9px] text-[#5e6673]">
        {TPO_NOTE} · tick {model.tickSize}
      </div>
    </div>
  )
}
