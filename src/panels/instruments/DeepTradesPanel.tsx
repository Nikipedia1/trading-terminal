/** Large aggressive prints (percentile / fixed threshold). */
import { useEffect, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'
import {
  filterDeepTrades,
  DEFAULT_DEEP_TRADES_CONFIG,
  type DeepTradeBubble,
} from '@/analysis/deepTrades'

function fmt(p: number) {
  if (p >= 1000) return p.toFixed(1)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

function fmtTime(sec: number) {
  return new Date(sec * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function DeepTradesPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles } = usePanelMarket(symbol, interval, exchange)
  const [bubbles, setBubbles] = useState<DeepTradeBubble[]>([])
  const [threshold, setThreshold] = useState(0)
  const cfg = DEFAULT_DEEP_TRADES_CONFIG

  useEffect(() => {
    return retainTradeBuffer(exchange, (symbol ?? '').toUpperCase())
  }, [exchange, symbol])

  useEffect(() => {
    if (candles.length < 2) {
      setBubbles([])
      return
    }
    const slice = candles.slice(-48)
    const sec = intervalToSeconds(interval)
    const t0 = slice[0]!.time
    const t1 = slice[slice.length - 1]!.time + sec
    const tick = () => {
      const trades = queryTradesInRange(exchange, (symbol ?? '').toUpperCase(), t0, t1)
      const { bubbles: list, threshold: th } = filterDeepTrades(trades, cfg)
      setThreshold(th)
      setBubbles(list.slice(-80).reverse())
    }
    tick()
    const id = window.setInterval(tick, 700)
    return () => window.clearInterval(id)
  }, [candles, exchange, symbol, interval])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">DEEP TRADES</span>
        <span className="text-[#848e9c]">
          {symbol} · p{cfg.percentile} {cfg.sizeUnit}
        </span>
        <span className="ml-auto text-[#5e6673]">
          thr {threshold >= 1000 ? threshold.toFixed(0) : threshold.toFixed(2)} · {bubbles.length}
        </span>
      </div>
      {!bubbles.length && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673]">
          Nessun print sopra soglia
        </div>
      )}
      {bubbles.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#0b0e11] text-[10px] text-[#5e6673] z-10">
              <tr>
                <th className="text-left px-1.5 py-1">Time</th>
                <th className="text-left px-1.5 py-1">Side</th>
                <th className="text-right px-1.5 py-1">Price</th>
                <th className="text-right px-1.5 py-1">Size</th>
                <th className="text-right px-1.5 py-1">n</th>
              </tr>
            </thead>
            <tbody>
              {bubbles.map((b) => (
                <tr key={b.id} className="border-b border-[#1e2329]/40">
                  <td className="px-1.5 py-0.5 text-[#848e9c]">{fmtTime(b.timeSec)}</td>
                  <td
                    className={`px-1.5 py-0.5 ${
                      b.aggressor === 'buy' ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}
                  >
                    {b.aggressor}
                  </td>
                  <td className="px-1.5 py-0.5 text-right">{fmt(b.price)}</td>
                  <td className="px-1.5 py-0.5 text-right text-[#f0b90b]">
                    {b.qty >= 1000 ? b.qty.toFixed(0) : b.qty.toFixed(3)}
                  </td>
                  <td className="px-1.5 py-0.5 text-right text-[#5e6673]">{b.clusterCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
