/**
 * Standalone Deep Print panel — shows bid/ask levels + VP for the linked chart.
 * VIEW of the tool (not a remote control for chart overlays).
 */
import { useEffect, useMemo, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import {
  retainTradeBuffer,
  queryTradesInRange,
  aggregatePrint,
  type DeepPrintModel,
} from '@/analysis/deepPrint'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import { MetricHonestyRow } from '@/ui/MetricHonesty'

function fmt(n: number) {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1000) return n.toFixed(1)
  if (n >= 1) return n.toFixed(3)
  return n.toFixed(4)
}

export function DeepPrintPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles } = usePanelMarket(symbol, interval, exchange)
  const [model, setModel] = useState<DeepPrintModel | null>(null)

  const last = candles.length ? candles[candles.length - 1] : null
  const sec = intervalToSeconds(interval)

  useEffect(() => {
    const sym = (symbol ?? '').toUpperCase()
    return retainTradeBuffer(exchange, sym)
  }, [exchange, symbol])

  useEffect(() => {
    if (!last) {
      setModel(null)
      return
    }
    const t0 = last.time
    const t1 = t0 + sec
    const mid = (last.high + last.low) / 2
    const tick = () => {
      const trades = queryTradesInRange(exchange, (symbol ?? '').toUpperCase(), t0, t1)
      const m = aggregatePrint(trades, t0, t1, mid)
      setModel(m)
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [last?.time, last?.high, last?.low, sec, exchange, symbol])

  const levels = useMemo(() => model?.levels ?? [], [model])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex flex-wrap gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">DEEP PRINT</span>
        <MetricHonestyRow kinds={['aggressor', 'ring-buffer', 'feed-limit']} />
        <span className="text-[#848e9c]">
          {symbol} · {interval} · {exchange}
        </span>
        {model && (
          <span className="ml-auto text-[#848e9c]">
            Δ {model.totalDelta >= 0 ? '+' : ''}
            {model.totalDelta.toFixed(3)} · B {model.buyPct.toFixed(0)}% / S {model.sellPct.toFixed(0)}%
          </span>
        )}
      </div>
      {!last && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673]">In attesa candele…</div>
      )}
      {last && !model && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673]">
          Nessun trade nel buffer per questa candela
        </div>
      )}
      {model && levels.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673]">
          Nessun livello — attendi aggressor ticks
        </div>
      )}
      {model && levels.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto px-1 py-1">
          {[...levels].sort((a, b) => b.price - a.price).map((l) => {
            const tot = l.buyQty + l.sellQty
            const max = model.levels.reduce((m, x) => Math.max(m, x.buyQty + x.sellQty), 1)
            const w = (tot / max) * 100
            return (
              <div
                key={l.price}
                className={`relative flex items-center gap-1 px-1 h-[18px] ${
                  l.isPoc ? 'bg-[#f0b90b]/10' : l.inValueArea ? 'bg-[#0ecb81]/05' : ''
                }`}
              >
                <span
                  className="absolute inset-y-0.5 left-[4.5rem] rounded-sm bg-[#2b3139]/80"
                  style={{ width: `calc(${w}% - 0px)` }}
                />
                <span className="relative w-[4.5rem] text-right tabular-nums text-[#c8cdd5]">{fmt(l.price)}</span>
                <span className="relative text-[10px] text-[#0ecb81] w-14 text-right">{fmt(l.buyQty)}</span>
                <span className="relative text-[10px] text-[#f6465d] w-14 text-right">{fmt(l.sellQty)}</span>
                <span className="relative text-[9px] text-[#5e6673] ml-auto">
                  {l.isPoc ? 'POC' : l.inValueArea ? 'VA' : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
