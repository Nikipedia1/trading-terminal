/**
 * Standalone Footprint panel — per-bar delta / POC / unfinished auctions.
 */
import { useEffect, useMemo, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import { MetricHonestyRow } from '@/ui/MetricHonesty'
import {
  buildFootprintCells,
  buildFootprintBars,
  DEFAULT_FOOTPRINT_CONFIG,
  FOOTPRINT_NOTE,
  type FootprintBar,
} from '@/analysis/footprint'

function fmt(p: number) {
  if (!Number.isFinite(p)) return '—'
  if (p >= 1000) return p.toFixed(1)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

function fmtTime(sec: number) {
  const d = new Date(sec * 1000)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function FootprintPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles } = usePanelMarket(symbol, interval, exchange)
  const [bars, setBars] = useState<FootprintBar[]>([])

  const cfg = DEFAULT_FOOTPRINT_CONFIG
  const sec = intervalToSeconds(interval)

  useEffect(() => {
    return retainTradeBuffer(exchange, (symbol ?? '').toUpperCase())
  }, [exchange, symbol])

  useEffect(() => {
    if (candles.length < 2) {
      setBars([])
      return
    }
    const slice = candles.slice(-cfg.maxCandles)
    const times = slice.map((c) => c.time)
    const t0 = times[0]!
    const t1 = times[times.length - 1]! + sec

    const tick = () => {
      const trades = queryTradesInRange(exchange, (symbol ?? '').toUpperCase(), t0, t1)
      const cells = buildFootprintCells(trades, times, interval)
      const next = buildFootprintBars(cells)
      setBars(next.slice().reverse())
    }
    tick()
    const id = window.setInterval(tick, 700)
    return () => window.clearInterval(id)
  }, [candles, exchange, symbol, interval, sec, cfg.maxCandles])

  const maxAbs = useMemo(
    () => Math.max(1, ...bars.map((b) => Math.abs(b.delta))),
    [bars]
  )

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex flex-wrap gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">FOOTPRINT</span>
        <MetricHonestyRow kinds={['aggressor', 'ring-buffer']} />
        <span className="text-[#848e9c]">
          {symbol} · {interval} · {exchange}
        </span>
        <span className="ml-auto text-[10px] text-[#5e6673]">{bars.length} bars</span>
      </div>
      <div className="px-2 py-1 text-[9px] text-[#5e6673] border-b border-[#1e2329]">{FOOTPRINT_NOTE}</div>
      {!bars.length && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673] px-3 text-center">
          Nessun footprint — serve stream tick denso (es. BTC 1m)
        </div>
      )}
      {bars.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#0b0e11] text-[10px] text-[#5e6673] z-10">
              <tr>
                <th className="text-left px-1.5 py-1">Time</th>
                <th className="text-right px-1.5 py-1">Δ</th>
                <th className="text-right px-1.5 py-1">Buy</th>
                <th className="text-right px-1.5 py-1">Sell</th>
                <th className="text-right px-1.5 py-1">POC</th>
                <th className="text-center px-1 py-1">U</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((b) => {
                const w = (Math.abs(b.delta) / maxAbs) * 100
                const pos = b.delta >= 0
                return (
                  <tr key={b.timeSec} className="border-b border-[#1e2329]/50 hover:bg-[#12161c]">
                    <td className="px-1.5 py-0.5 text-[#848e9c]">{fmtTime(b.timeSec)}</td>
                    <td className="px-1.5 py-0.5 text-right relative">
                      <span
                        className={`absolute right-0 top-1 bottom-1 rounded-sm ${
                          pos ? 'bg-[#0ecb81]/25' : 'bg-[#f6465d]/25'
                        }`}
                        style={{ width: `${w}%` }}
                      />
                      <span className={`relative ${pos ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {pos ? '+' : ''}
                        {b.delta.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-1.5 py-0.5 text-right text-[#0ecb81]">{b.buyQty.toFixed(3)}</td>
                    <td className="px-1.5 py-0.5 text-right text-[#f6465d]">{b.sellQty.toFixed(3)}</td>
                    <td className="px-1.5 py-0.5 text-right text-[#eaecef]">{fmt(b.poc)}</td>
                    <td className="px-1 py-0.5 text-center text-[10px]">
                      {b.unfinishedHigh ? (
                        <span className="text-[#0ecb81]" title="Unfinished high">↑</span>
                      ) : null}
                      {b.unfinishedLow ? (
                        <span className="text-[#f6465d]" title="Unfinished low">↓</span>
                      ) : null}
                      {!b.unfinishedHigh && !b.unfinishedLow ? (
                        <span className="text-[#3d4450]">·</span>
                      ) : null}
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
