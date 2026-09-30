import { useMemo } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { EmptyState } from '@/ui/EmptyState'

function sumSide(
  levels: { price: number; size: number }[] | undefined,
  n: number
): number {
  if (!levels?.length) return 0
  return levels.slice(0, n).reduce((s, l) => s + (l.size || 0), 0)
}

export function LiquidityPanel() {
  const book = useMarketStore((s) => s.orderBook)
  const trades = useMarketStore((s) => s.trades)
  const ticker = useMarketStore((s) => s.ticker)
  const symbol = useMarketStore((s) => s.symbol)

  const metrics = useMemo(() => {
    const bids = (book?.bids ?? []) as { price: number; size: number }[]
    const asks = (book?.asks ?? []) as { price: number; size: number }[]
    const bid5 = sumSide(bids, 5)
    const ask5 = sumSide(asks, 5)
    const bid20 = sumSide(bids, 20)
    const ask20 = sumSide(asks, 20)
    const imb5 = bid5 + ask5 > 0 ? (bid5 - ask5) / (bid5 + ask5) : 0
    const imb20 = bid20 + ask20 > 0 ? (bid20 - ask20) / (bid20 + ask20) : 0

    let buyVol = 0
    let sellVol = 0
    for (const t of trades.slice(0, 80)) {
      const q =
        (t as { qty?: number }).qty ??
        (t as { quantity?: number }).quantity ??
        0
      const side = (t as { side?: string }).side
      const buyerMaker = (t as { isBuyerMaker?: boolean }).isBuyerMaker
      const isSell = side === 'sell' || side === 'Sell' || buyerMaker === true
      if (isSell) sellVol += q
      else buyVol += q
    }
    const delta = buyVol - sellVol
    const tot = buyVol + sellVol
    const deltaImb = tot > 0 ? delta / tot : 0
    return { bid5, ask5, bid20, ask20, imb5, imb20, buyVol, sellVol, delta, deltaImb }
  }, [book, trades])

  if (!book?.bids?.length && !trades.length) {
    return (
      <EmptyState
        title="No liquidity feed"
        description="Start live data to populate book and tape."
      />
    )
  }

  const bar = (v: number) => {
    const pct = Math.min(100, Math.abs(v) * 100)
    const pos = v >= 0
    return (
      <div className="h-1.5 w-full bg-[#1e2329] rounded overflow-hidden">
        <div
          className={`h-full ${pos ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`}
          style={{ width: `${pct}%`, marginLeft: pos ? 0 : `${100 - pct}%` }}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-[11px] bg-[#0b0e11] text-[#eaecef]">
      <div className="px-2 py-1.5 border-b border-[#1e2329] flex justify-between">
        <span className="font-semibold text-[#f0b90b]">Liquidity</span>
        <span className="text-[#848e9c] font-mono">{symbol}</span>
      </div>
      <div className="p-2 space-y-3 overflow-auto flex-1">
        <section>
          <div className="text-[10px] text-[#848e9c] uppercase mb-1">Book imbalance</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span>Top 5</span>
                <span className={metrics.imb5 >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                  {(metrics.imb5 * 100).toFixed(1)}%
                </span>
              </div>
              {bar(metrics.imb5)}
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span>Top 20</span>
                <span className={metrics.imb20 >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                  {(metrics.imb20 * 100).toFixed(1)}%
                </span>
              </div>
              {bar(metrics.imb20)}
            </div>
          </div>
        </section>
        <section>
          <div className="text-[10px] text-[#848e9c] uppercase mb-1">Tape delta</div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span>Δ volume</span>
            <span className={metrics.delta >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
              {metrics.delta.toFixed(4)}
            </span>
          </div>
          {bar(metrics.deltaImb)}
        </section>
        {ticker && (
          <section className="text-[10px] text-[#5e6673]">
            Mark{' '}
            {(ticker as { lastPrice?: number }).lastPrice?.toFixed?.(2) ??
              (ticker as { last?: number }).last ??
              '—'}
          </section>
        )}
      </div>
    </div>
  )
}
