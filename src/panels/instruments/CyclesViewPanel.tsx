/** Cycle model view — dominant period, phase, next turns. */
import { useMemo } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { computeCycleModel, DEFAULT_CYCLE_CONFIG } from '@/analysis/cycles'

function fmtTime(sec: number | null) {
  if (sec == null) return '—'
  return new Date(sec * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CyclesViewPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles } = usePanelMarket(symbol, interval, exchange)

  const model = useMemo(() => {
    if (candles.length < 40) return null
    return computeCycleModel(candles, { ...DEFAULT_CYCLE_CONFIG, enabled: true })
  }, [candles])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">CYCLES</span>
        <span className="text-[#848e9c]">
          {symbol} · {interval}
        </span>
      </div>
      {!model && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673]">
          Servono almeno ~40 barre
        </div>
      )}
      {model && (
        <div className="flex-1 min-h-0 overflow-auto p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Period (bars)" value={String(model.period)} sub={model.periodSource} />
            <Metric label="Strength" value={model.strength.toFixed(2)} />
            <Metric label="Secondary" value={String(model.secondaryPeriod)} sub={`str ${model.secondaryStrength.toFixed(2)}`} />
            <Metric label="Phase°" value={model.phaseDeg.toFixed(1)} />
            <Metric label="Amplitude" value={model.amplitude.toFixed(4)} />
            <Metric
              label="Bars to turn"
              value={model.barsToNextTurn != null ? String(model.barsToNextTurn) : '—'}
            />
          </div>
          <div className="border border-[#1e2329] rounded p-2 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-[#848e9c]">Next high</span>
              <span className="text-[#0ecb81]">{fmtTime(model.nextHighTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#848e9c]">Next low</span>
              <span className="text-[#f6465d]">{fmtTime(model.nextLowTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#848e9c]">Cycle highs tagged</span>
              <span>{model.cycleHighTimes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#848e9c]">Cycle lows tagged</span>
              <span>{model.cycleLowTimes.length}</span>
            </div>
          </div>
          <p className="text-[9px] text-[#5e6673]">
            Abilita overlay Cycles sulla toolbar del chart per disegnare le onde sul grafico.
          </p>
        </div>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="border border-[#1e2329] rounded px-2 py-1.5">
      <div className="text-[9px] text-[#5e6673] uppercase tracking-wide">{label}</div>
      <div className="text-[#f0b90b] text-sm">{value}</div>
      {sub && <div className="text-[9px] text-[#848e9c]">{sub}</div>}
    </div>
  )
}
