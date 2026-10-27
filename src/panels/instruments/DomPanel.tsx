/**
 * Standalone DOM panel — full-width ladder (not chart overlay).
 */
import { useEffect, useState } from 'react'
import { useResolvedChartLink } from '@/hooks/ChartLinkContext'
import { subscribeOrderBookFeed, type OrderBookSnapshot } from '@/data/shared'
import { MetricHonestyRow } from '@/ui/MetricHonesty'

function fmt(n: number) {
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

export function DomPanel() {
  const link = useResolvedChartLink('follow')
  const { symbol, exchange } = link
  const [book, setBook] = useState<OrderBookSnapshot | null>(null)

  useEffect(() => {
    const sub = subscribeOrderBookFeed(exchange, (symbol ?? '').toUpperCase(), {
      onBook: (snap) => setBook(snap),
    })
    return () => sub.unsubscribe()
  }, [exchange, symbol])

  const asks = (book?.asks ?? []).slice(0, 16).reverse()
  const bids = (book?.bids ?? []).slice(0, 16)
  const maxQty = Math.max(
    1,
    ...asks.map((l) => l.qty),
    ...bids.map((l) => l.qty)
  )
  const bestAsk = book?.asks[0]?.price
  const bestBid = book?.bids[0]?.price
  const mid =
    bestAsk != null && bestBid != null ? (bestAsk + bestBid) / 2 : null
  const spread =
    bestAsk != null && bestBid != null ? bestAsk - bestBid : null

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[11px] font-mono">
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex gap-2 items-center">
        <span className="text-[#f0b90b] font-semibold">DOM LADDER</span>
        <MetricHonestyRow kinds={['feed-limit', 'synthetic-none']} />
        <span className="text-[#848e9c]">
          {symbol} · {exchange}
        </span>
        {mid != null && (
          <span className="ml-auto text-[#f0b90b]">
            {fmt(mid)}
            {spread != null && (
              <span className="text-[#848e9c] font-normal ml-1">sp {fmt(spread)}</span>
            )}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {!book?.ready && (
          <div className="h-full flex items-center justify-center text-[#5e6673]">
            Sincronizzazione book…
          </div>
        )}
        {book?.ready && (
          <div className="px-1 py-1">
            {asks.map((l) => (
              <div key={`a-${l.price}`} className="relative h-[18px] flex items-center px-1">
                <span
                  className="absolute inset-y-0.5 right-0 bg-[#f6465d]/25"
                  style={{ width: `${(l.qty / maxQty) * 100}%` }}
                />
                <span className="relative w-20 text-right text-[#f6465d] tabular-nums">{fmt(l.price)}</span>
                <span className="relative ml-auto text-[#eaecef] tabular-nums">{fmt(l.qty)}</span>
              </div>
            ))}
            <div className="my-0.5 border-t border-[#2b3139]" />
            {bids.map((l) => (
              <div key={`b-${l.price}`} className="relative h-[18px] flex items-center px-1">
                <span
                  className="absolute inset-y-0.5 right-0 bg-[#0ecb81]/25"
                  style={{ width: `${(l.qty / maxQty) * 100}%` }}
                />
                <span className="relative w-20 text-right text-[#0ecb81] tabular-nums">{fmt(l.price)}</span>
                <span className="relative ml-auto text-[#eaecef] tabular-nums">{fmt(l.qty)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
