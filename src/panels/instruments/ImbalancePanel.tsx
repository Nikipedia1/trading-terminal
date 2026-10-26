/** Stacked imbalance runs on last candle print levels. */
import { useEffect, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import {
  retainTradeBuffer,
  queryTradesInRange,
  aggregatePrint,
} from '@/analysis/deepPrint'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import { stackedImbalanceRuns, type StackedRun } from '@/analysis/metrics'

function fmt(p: number) {
  if (p >= 1000) return p.toFixed(1)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

export function ImbalancePanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles } = usePanelMarket(symbol, interval, exchange)
  const [runs, setRuns] = useState<StackedRun[]>([])
  const [anchor, setAnchor] = useState<number | null>(null)

  useEffect(() => {
    return retainTradeBuffer(exchange, (symbol ?? '').toUpperCase())
  }, [exchange, symbol])

  useEffect(() => {
    if (!candles.length) {
      setRuns([])
      return
    }
    const last = candles[candles.length - 1]!
    const sec = intervalToSeconds(interval)
    const t0 = last.time
    const t1 = t0 + sec
    const mid = (last.high + last.low) / 2
    const tick = () => {
      const trades = queryTradesInRange(exchange, (symbol ?? '').toUpperCase(), t0, t1)
      const model = aggregatePrint(trades, t0, t1, mid)
      setAnchor(mid)
      setRuns(stackedImbalanceRuns(model.levels, 0.7, 0.3, 3))
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [candles, exchange, symbol, interval])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">STACKED IMBALANCE</span>
        <span className="text-[#848e9c]">
          {symbol} · last bar
        </span>
        {anchor != null && <span className="ml-auto text-[#848e9c]">mid {fmt(anchor)}</span>}
      </div>
      <div className="px-2 py-1 text-[9px] text-[#5e6673] border-b border-[#1e2329]">
        Run consecutive ticks con ratio buy ≥70% o sell ≥70% (min 3 livelli)
      </div>
      {!runs.length && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673]">
          Nessun stacked imbalance sulla candela corrente
        </div>
      )}
      {runs.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#0b0e11] text-[10px] text-[#5e6673] z-10">
              <tr>
                <th className="text-left px-1.5 py-1">Side</th>
                <th className="text-right px-1.5 py-1">From</th>
                <th className="text-right px-1.5 py-1">To</th>
                <th className="text-right px-1.5 py-1">Len</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i} className="border-b border-[#1e2329]/40">
                  <td
                    className={`px-1.5 py-0.5 ${
                      r.side === 'buy' ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}
                  >
                    {r.side.toUpperCase()}
                  </td>
                  <td className="px-1.5 py-0.5 text-right">{fmt(r.startPrice)}</td>
                  <td className="px-1.5 py-0.5 text-right">{fmt(r.endPrice)}</td>
                  <td className="px-1.5 py-0.5 text-right text-[#f0b90b]">{r.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
