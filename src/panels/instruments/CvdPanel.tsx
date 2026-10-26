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
  const { candles } = usePanelMarket(symbol, interval, exchange)
  const [bars, setBars] = useState<CandleDeltaBar[]>([])

  useEffect(() => {
    return retainTradeBuffer(exchange, (symbol ?? '').toUpperCase())
  }, [exchange, symbol])

  useEffect(() => {
    if (candles.length < 2) {
      setBars([])
      return
    }
    const tick = () => {
      const slice = candles.slice(-80)
      const times = slice.map((c) => c.time)
      setBars(computeCandleDeltas(exchange, (symbol ?? '').toUpperCase(), times, interval))
    }
    tick()
    const id = window.setInterval(tick, 600)
    return () => window.clearInterval(id)
  }, [candles, exchange, symbol, interval])

  const withCvd = useMemo(() => {
    let acc = 0
    return bars.map((b) => {
      acc += b.delta
      return { ...b, cvd: acc }
    })
  }, [bars])

  const maxAbs = useMemo(
    () => Math.max(1, ...withCvd.map((b) => Math.abs(b.delta))),
    [withCvd]
  )
  const last = withCvd[withCvd.length - 1]

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex flex-wrap gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">CVD / DELTA</span>
        <MetricHonestyRow kinds={['aggressor', 'ring-buffer']} />
        <span className="text-[#848e9c]">
          {symbol} · {interval}
        </span>
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
        <div className="flex-1 flex items-center justify-center text-[#5e6673]">In attesa trade…</div>
      )}
      {withCvd.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-[#0b0e11] text-[#5e6673] z-10">
              <tr>
                <th className="text-left px-1.5 py-1">Time</th>
                <th className="text-right px-1.5 py-1">Δ</th>
                <th className="text-right px-1.5 py-1">CVD</th>
                <th className="text-left px-1.5 py-1 w-[40%]">Bar</th>
              </tr>
            </thead>
            <tbody>
              {[...withCvd].reverse().map((b) => {
                const w = (Math.abs(b.delta) / maxAbs) * 100
                const pos = b.delta >= 0
                return (
                  <tr key={b.time} className="border-b border-[#1e2329]/40">
                    <td className="px-1.5 py-0.5 text-[#848e9c]">{fmtTime(b.time)}</td>
                    <td className={`px-1.5 py-0.5 text-right ${pos ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                      {pos ? '+' : ''}
                      {b.delta.toFixed(3)}
                    </td>
                    <td className="px-1.5 py-0.5 text-right text-[#eaecef]">{b.cvd.toFixed(2)}</td>
                    <td className="px-1.5 py-0.5">
                      <div className="h-2 bg-[#12161c] rounded-sm overflow-hidden">
                        <div
                          className={pos ? 'h-full bg-[#0ecb81]/70' : 'h-full bg-[#f6465d]/70'}
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    </td>
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
