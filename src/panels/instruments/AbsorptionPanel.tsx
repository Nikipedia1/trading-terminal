/** Absorption / Aggression tags from delta + candle structure. */
import { useEffect, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { retainTradeBuffer, computeCandleDeltas } from '@/analysis/deepPrint'
import {
  detectAbsorptionAggression,
  type AbsorptionMarker,
} from '@/analysis/deltaPrint'

const KIND_LABEL: Record<AbsorptionMarker['kind'], string> = {
  aggression_buy: 'Agg Buy',
  aggression_sell: 'Agg Sell',
  absorption_buy: 'Abs Buy',
  absorption_sell: 'Abs Sell',
}

const KIND_COLOR: Record<AbsorptionMarker['kind'], string> = {
  aggression_buy: '#0ecb81',
  aggression_sell: '#f6465d',
  absorption_buy: '#3b82f6',
  absorption_sell: '#a855f7',
}

function fmtTime(sec: number) {
  return new Date(sec * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmt(p: number) {
  if (p >= 1000) return p.toFixed(1)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

export function AbsorptionPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles } = usePanelMarket(symbol, interval, exchange)
  const [marks, setMarks] = useState<AbsorptionMarker[]>([])

  useEffect(() => {
    return retainTradeBuffer(exchange, (symbol ?? '').toUpperCase())
  }, [exchange, symbol])

  useEffect(() => {
    if (candles.length < 5) {
      setMarks([])
      return
    }
    const tick = () => {
      const slice = candles.slice(-100)
      const deltas = computeCandleDeltas(
        exchange,
        (symbol ?? '').toUpperCase(),
        slice.map((c) => c.time),
        interval
      )
      setMarks(detectAbsorptionAggression(slice, deltas, 35).reverse())
    }
    tick()
    const id = window.setInterval(tick, 800)
    return () => window.clearInterval(id)
  }, [candles, exchange, symbol, interval])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">ABSORPTION</span>
        <span className="text-[#848e9c]">
          {symbol} · {interval}
        </span>
        <span className="ml-auto text-[#5e6673]">{marks.length}</span>
      </div>
      <div className="px-2 py-1 text-[9px] text-[#5e6673] border-b border-[#1e2329]">
        Aggression = delta forte + close nella direzione · Absorption = delta forte + close opposto
      </div>
      {!marks.length && (
        <div className="flex-1 flex items-center justify-center text-[#5e6673] px-3 text-center">
          Nessun segnale ancora — serve delta significativo
        </div>
      )}
      {marks.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#0b0e11] text-[10px] text-[#5e6673] z-10">
              <tr>
                <th className="text-left px-1.5 py-1">Time</th>
                <th className="text-left px-1.5 py-1">Kind</th>
                <th className="text-right px-1.5 py-1">Price</th>
                <th className="text-right px-1.5 py-1">Δ</th>
              </tr>
            </thead>
            <tbody>
              {marks.map((m) => (
                <tr key={`${m.time}-${m.kind}`} className="border-b border-[#1e2329]/40">
                  <td className="px-1.5 py-0.5 text-[#848e9c]">{fmtTime(m.time)}</td>
                  <td className="px-1.5 py-0.5" style={{ color: KIND_COLOR[m.kind] }}>
                    {KIND_LABEL[m.kind]}
                  </td>
                  <td className="px-1.5 py-0.5 text-right">{fmt(m.price)}</td>
                  <td
                    className={`px-1.5 py-0.5 text-right ${
                      m.delta >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}
                  >
                    {m.delta >= 0 ? '+' : ''}
                    {m.delta.toFixed(3)}
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
