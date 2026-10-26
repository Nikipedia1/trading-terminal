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

function fmt(p: number) {
  if (!Number.isFinite(p)) return '—'
  if (p >= 1000) return p.toFixed(1)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
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
          Buffer attivo — in attesa trade live…
        </div>
      )}
      {model && levels.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="px-2 py-1 text-[10px] text-[#5e6673] border-b border-[#1e2329] sticky top-0 bg-[#0b0e11] z-10">
            POC {model.poc != null ? fmt(model.poc) : '—'} · VA [{model.val != null ? fmt(model.val) : '—'} –{' '}
            {model.vah != null ? fmt(model.vah) : '—'}]
          </div>
          <table className="w-full border-collapse">
            <thead className="sticky top-7 bg-[#0b0e11] text-[10px] text-[#5e6673] z-10">
              <tr>
                <th className="text-right px-1 py-0.5">Sell</th>
                <th className="text-right px-1 py-0.5">Price</th>
                <th className="text-left px-1 py-0.5">Buy</th>
                <th className="text-right px-1 py-0.5">%</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((lv) => {
                const max = Math.max(1, ...levels.map((l) => l.totalVol))
                const bw = (lv.buyQty / max) * 100
                const sw = (lv.sellQty / max) * 100
                return (
                  <tr
                    key={lv.price}
                    className={
                      lv.isPoc
                        ? 'bg-[#f0b90b]/12'
                        : lv.inValueArea
                          ? 'bg-[#1e2329]/50'
                          : ''
                    }
                  >
                    <td className="text-right px-1 py-0.5 relative">
                      <span
                        className="absolute right-0 top-0.5 bottom-0.5 bg-[#f6465d]/35"
                        style={{ width: `${sw}%` }}
                      />
                      <span className="relative text-[#f6465d]">{lv.sellQty.toFixed(3)}</span>
                    </td>
                    <td className="text-right px-1 py-0.5 text-[#eaecef]">{fmt(lv.price)}</td>
                    <td className="text-left px-1 py-0.5 relative">
                      <span
                        className="absolute left-0 top-0.5 bottom-0.5 bg-[#0ecb81]/35"
                        style={{ width: `${bw}%` }}
                      />
                      <span className="relative text-[#0ecb81]">{lv.buyQty.toFixed(3)}</span>
                    </td>
                    <td className="text-right px-1 py-0.5 text-[#848e9c]">{lv.volPct.toFixed(0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
