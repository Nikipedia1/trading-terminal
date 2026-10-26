/**
 * Standalone Volume Profile panel — visible histogram for visible range / last N bars.
 */
import { useEffect, useMemo, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import { retainTradeBuffer, queryTradesInRange } from '@/analysis/deepPrint'
import { intervalToSeconds } from '@/analysis/deepPrint/interval'

interface Bucket {
  price: number
  buy: number
  sell: number
  total: number
}

function fmt(p: number) {
  if (!Number.isFinite(p)) return '—'
  if (p >= 1000) return p.toFixed(1)
  if (p >= 1) return p.toFixed(2)
  return p.toFixed(4)
}

export function VolumeProfilePanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, interval, exchange } = link
  const { candles } = usePanelMarket(symbol, interval, exchange)
  const [buckets, setBuckets] = useState<Bucket[]>([])

  useEffect(() => {
    return retainTradeBuffer(exchange, (symbol ?? '').toUpperCase())
  }, [exchange, symbol])

  useEffect(() => {
    if (candles.length < 2) {
      setBuckets([])
      return
    }
    const slice = candles.slice(-48)
    const t0 = slice[0]!.time
    const sec = intervalToSeconds(interval)
    const t1 = slice[slice.length - 1]!.time + sec
    const tick = () => {
      const trades = queryTradesInRange(exchange, (symbol ?? '').toUpperCase(), t0, t1)
      if (!trades.length) {
        setBuckets([])
        return
      }
      let lo = Infinity
      let hi = -Infinity
      for (const t of trades) {
        lo = Math.min(lo, t.price)
        hi = Math.max(hi, t.price)
      }
      if (!(hi > lo)) {
        setBuckets([])
        return
      }
      const n = 32
      const step = (hi - lo) / n
      const acc: Bucket[] = Array.from({ length: n }, (_, i) => ({
        price: hi - (i + 0.5) * step,
        buy: 0,
        sell: 0,
        total: 0,
      }))
      for (const t of trades) {
        const idx = Math.min(n - 1, Math.max(0, Math.floor((hi - t.price) / step)))
        const b = acc[idx]!
        if (t.aggressor === 'buy' || (t as { isBuyerMaker?: boolean }).isBuyerMaker === false) {
          b.buy += t.qty
        } else {
          b.sell += t.qty
        }
        b.total = b.buy + b.sell
      }
      setBuckets(acc.filter((b) => b.total > 0))
    }
    tick()
    const id = window.setInterval(tick, 800)
    return () => window.clearInterval(id)
  }, [candles, exchange, symbol, interval])

  const max = useMemo(() => Math.max(1, ...buckets.map((b) => b.total)), [buckets])
  const poc = useMemo(() => {
    if (!buckets.length) return null
    return buckets.reduce((a, b) => (b.total > a.total ? b : a), buckets[0]!)
  }, [buckets])

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">VOLUME PROFILE</span>
        <span className="text-[#848e9c]">
          {symbol} · last 48 bars
        </span>
        {poc && <span className="ml-auto text-[#848e9c]">POC {fmt(poc.price)}</span>}
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-2 py-1 space-y-0.5">
        {!buckets.length && (
          <div className="h-full flex items-center justify-center text-[#5e6673]">Nessun volume in buffer</div>
        )}
        {buckets.map((b) => (
          <div key={b.price} className="flex items-center gap-1 h-3">
            <span className="w-14 text-right text-[10px] text-[#848e9c] shrink-0">{fmt(b.price)}</span>
            <div className="flex-1 h-2 bg-[#12161c] rounded-sm overflow-hidden flex">
              <div
                className="h-full bg-[#f6465d]/70"
                style={{ width: `${(b.sell / max) * 100}%` }}
                title={`Sell ${b.sell.toFixed(3)}`}
              />
              <div
                className="h-full bg-[#0ecb81]/70"
                style={{ width: `${(b.buy / max) * 100}%` }}
                title={`Buy ${b.buy.toFixed(3)}`}
              />
            </div>
            <span className="w-10 text-right text-[10px] text-[#5e6673] shrink-0">{b.total.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
