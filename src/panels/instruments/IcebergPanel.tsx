/** Iceberg heuristic — trade vol vs max resting book size (public L2 only). */
import { useEffect, useRef, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint'
import { intervalToSeconds, roundToTick, inferTickSize } from '@/analysis/deepPrint/interval'
import { subscribeOrderBookFeed } from '@/data/shared'
import { icebergHeuristic, type IcebergSuspect } from '@/analysis/metrics'

function fmt(p: number) {
  if (p >= 1000) return p.toFixed(1)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

export function IcebergPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles } = usePanelMarket(symbol, interval, exchange)
  const bookMaxRef = useRef(new Map<number, number>())
  const [suspects, setSuspects] = useState<IcebergSuspect[]>([])

  useEffect(() => {
    return retainTradeBuffer(exchange, (symbol ?? '').toUpperCase())
  }, [exchange, symbol])

  useEffect(() => {
    bookMaxRef.current = new Map()
    const sub = subscribeOrderBookFeed(exchange, (symbol ?? '').toUpperCase(), {
      onBook: (snap) => {
        const levels = [...snap.bids.slice(0, 40), ...snap.asks.slice(0, 40)]
        if (!levels.length) return
        const mid = levels[0]!.price
        const tick = inferTickSize(mid)
        const map = bookMaxRef.current
        for (const l of levels) {
          const p = roundToTick(l.price, tick)
          map.set(p, Math.max(map.get(p) ?? 0, l.qty))
        }
      },
    })
    return () => sub.unsubscribe()
  }, [exchange, symbol])

  useEffect(() => {
    if (!candles.length) {
      setSuspects([])
      return
    }
    const last = candles[candles.length - 1]!
    const sec = intervalToSeconds(interval)
    const tick = () => {
      const trades = queryTradesInRange(
        exchange,
        (symbol ?? '').toUpperCase(),
        last.time,
        last.time + sec
      )
      setSuspects(icebergHeuristic(trades, bookMaxRef.current, { k: 3, minVol: 0 }))
    }
    tick()
    const id = window.setInterval(tick, 800)
    return () => window.clearInterval(id)
  }, [candles, exchange, symbol, interval])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">ICEBERG</span>
        <span className="text-[#848e9c]">{symbol} · heuristic</span>
      </div>
      <div className="px-2 py-1 text-[9px] text-[#5e6673] border-b border-[#1e2329]">
        Score = tradeVol / maxBookQty. L2 pubblico non prova size nascosta — solo sospetti.
      </div>
      {!suspects.length && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673] px-3 text-center">
          Nessun sospetto (serve book max + trade vol ≥ 3×)
        </div>
      )}
      {suspects.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#0b0e11] text-[10px] text-[#5e6673] z-10">
              <tr>
                <th className="text-right px-1.5 py-1">Price</th>
                <th className="text-right px-1.5 py-1">Trade vol</th>
                <th className="text-right px-1.5 py-1">Book max</th>
                <th className="text-right px-1.5 py-1">Score</th>
              </tr>
            </thead>
            <tbody>
              {suspects.map((s) => (
                <tr key={s.price} className="border-b border-[#1e2329]/40">
                  <td className="px-1.5 py-0.5 text-right">{fmt(s.price)}</td>
                  <td className="px-1.5 py-0.5 text-right text-[#f0b90b]">{s.tradeVol.toFixed(3)}</td>
                  <td className="px-1.5 py-0.5 text-right text-[#848e9c]">{s.bookMax.toFixed(3)}</td>
                  <td className="px-1.5 py-0.5 text-right text-[#f6465d]">{s.score.toFixed(1)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
