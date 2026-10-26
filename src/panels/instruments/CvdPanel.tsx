/** CVD + per-bar Delta — real aggressor volume only. */
import { useEffect, useMemo, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { retainTradeBuffer, computeCandleDeltas } from '@/analysis/deepPrint'
import type { CandleDeltaBar } from '@/analysis/deepPrint'
import { MetricHonestyRow } from '@/ui/MetricHonesty'

function fmtTime(sec: number) {
  return new Date(sec * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CvdPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles, status } = usePanelMarket(symbol, interval, exchange)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1500)
    return () => window.clearInterval(id)
  }, [])

  const withCvd: CandleDeltaBar[] = useMemo(() => {
    void tick
    const trades = retainTradeBuffer(exchange, symbol)
    return computeCandleDeltas(candles, trades)
  }, [candles, exchange, symbol, tick])

  const last = withCvd[withCvd.length - 1]

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px]">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex flex-wrap items-center gap-2">
        <span className="text-[#f0b90b] font-semibold">CVD / DELTA</span>
        <MetricHonestyRow kinds={['aggressor', 'ring-buffer']} />
        <span className="text-[#848e9c]">
          {symbol} · {interval}
        </span>
        <span className="text-[10px] text-[#5e6673]">{status}</span>
        {last && (
          <span className="ml-auto text-[#848e9c]">
            CVD{' '}
            <span className={last.cvd >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
              {last.cvd >= 0 ? '+' : ''}
              {last.cvd.toFixed(2)}
            </span>
          </span>
        )}
      </div>
      {!withCvd.length && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673]">
          In attesa trade…
        </div>
      )}
      {withCvd.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#0b0e11] text-[10px] text-[#5e6673] z-10">
              <tr>
                <th className="text-left px-1.5 py-1">Time</th>
                <th className="text-right px-1.5 py-1">Δ</th>
                <th className="text-right px-1.5 py-1">Buy</th>
                <th className="text-right px-1.5 py-1">Sell</th>
                <th className="text-right px-1.5 py-1">CVD</th>
              </tr>
            </thead>
            <tbody>
              {[...withCvd].reverse().slice(0, 80).map((b) => (
                <tr key={b.time} className="border-t border-[#1e2329]/80">
                  <td className="px-1.5 py-0.5 font-mono text-[#848e9c]">{fmtTime(b.time)}</td>
                  <td
                    className={`px-1.5 py-0.5 text-right font-mono ${
                      b.delta >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}
                  >
                    {b.delta >= 0 ? '+' : ''}
                    {b.delta.toFixed(3)}
                  </td>
                  <td className="px-1.5 py-0.5 text-right font-mono text-[#0ecb81]">
                    {b.buyVol.toFixed(3)}
                  </td>
                  <td className="px-1.5 py-0.5 text-right font-mono text-[#f6465d]">
                    {b.sellVol.toFixed(3)}
                  </td>
                  <td
                    className={`px-1.5 py-0.5 text-right font-mono ${
                      b.cvd >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}
                  >
                    {b.cvd.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
