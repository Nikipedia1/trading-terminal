import { useMemo } from 'react'
import { useMarketStore } from '@/stores/marketStore'
import { EmptyState } from '@/ui/EmptyState'

function levelQty(l: { price: number; qty?: number; size?: number }): number {
  return l.qty ?? l.size ?? 0
}

function sumSide(
  levels: { price: number; qty?: number; size?: number }[] | undefined,
  n: number
): number {
  if (!levels?.length) return 0
  return levels.slice(0, n).reduce((s, l) => s + levelQty(l), 0)
}

function fmtPx(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(Math.min(4, digits + 1))
  return n.toPrecision(4)
}

type Bias = 'long' | 'short' | 'neutral'

export function LiquidityPanel() {
  const book = useMarketStore((s) => s.orderBook)
  const trades = useMarketStore((s) => s.trades)
  const ticker = useMarketStore((s) => s.ticker)
  const candles = useMarketStore((s) => s.candles)
  const symbol = useMarketStore((s) => s.symbol)

  const metrics = useMemo(() => {
    const bids = (book?.bids ?? []) as { price: number; qty?: number; size?: number }[]
    const asks = (book?.asks ?? []) as { price: number; qty?: number; size?: number }[]
    const bid5 = sumSide(bids, 5)
    const ask5 = sumSide(asks, 5)
    const bid20 = sumSide(bids, 20)
    const ask20 = sumSide(asks, 20)
    const imb5 = bid5 + ask5 > 0 ? (bid5 - ask5) / (bid5 + ask5) : 0
    const imb20 = bid20 + ask20 > 0 ? (bid20 - ask20) / (bid20 + ask20) : 0
    /** Balance 0–1: 1 = fully balanced book, 0 = max skew */
    const balance5 = 1 - Math.abs(imb5)
    const balance20 = 1 - Math.abs(imb20)

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

    /** Combined score: book top20 + tape delta → long/short */
    const score = imb20 * 0.55 + deltaImb * 0.45
    let bias: Bias = 'neutral'
    if (score >= 0.12) bias = 'long'
    else if (score <= -0.12) bias = 'short'

    const bestBid = bids[0]?.price ?? null
    const bestAsk = asks[0]?.price ?? null
    const mid =
      bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null

    // Session high/low from ticker (24h) + candle window high/low
    const high24 = ticker?.highPrice ?? null
    const low24 = ticker?.lowPrice ?? null
    let highBar: number | null = null
    let lowBar: number | null = null
    if (candles.length) {
      const window = candles.slice(-48)
      highBar = Math.max(...window.map((c) => c.high))
      lowBar = Math.min(...window.map((c) => c.low))
    }

    const last = ticker?.lastPrice ?? mid
    const range24 =
      high24 != null && low24 != null && high24 > low24 ? high24 - low24 : null
    const posInRange =
      last != null && range24 != null && low24 != null
        ? (last - low24) / range24
        : null

    return {
      bid5,
      ask5,
      bid20,
      ask20,
      imb5,
      imb20,
      balance5,
      balance20,
      buyVol,
      sellVol,
      delta,
      deltaImb,
      score,
      bias,
      bestBid,
      bestAsk,
      mid,
      last,
      high24,
      low24,
      highBar,
      lowBar,
      posInRange,
    }
  }, [book, trades, ticker, candles])

  if (!book?.bids?.length && !trades.length && !ticker) {
    return (
      <EmptyState
        title="No liquidity feed"
        description="Start live data to populate book, tape and ticker."
      />
    )
  }

  const bar = (v: number, centerZero = true) => {
    const pct = Math.min(100, Math.abs(v) * 100)
    const pos = v >= 0
    if (!centerZero) {
      return (
        <div className="h-1.5 w-full bg-[#1e2329] rounded overflow-hidden">
          <div className="h-full bg-[#f0b90b]" style={{ width: `${pct}%` }} />
        </div>
      )
    }
    return (
      <div className="h-1.5 w-full bg-[#1e2329] rounded overflow-hidden">
        <div
          className={`h-full ${pos ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`}
          style={{ width: `${pct}%`, marginLeft: pos ? 0 : `${100 - pct}%` }}
        />
      </div>
    )
  }

  const biasCls =
    metrics.bias === 'long'
      ? 'text-[#0ecb81] border-[#0ecb81]/40 bg-[#0ecb81]/10'
      : metrics.bias === 'short'
        ? 'text-[#f6465d] border-[#f6465d]/40 bg-[#f6465d]/10'
        : 'text-[#848e9c] border-[#2b3139] bg-[#12161c]'

  return (
    <div className="h-full flex flex-col text-[11px] bg-[#0b0e11] text-[#eaecef]">
      <div className="px-2 py-1.5 border-b border-[#1e2329] flex justify-between items-center shrink-0">
        <span className="font-semibold text-[#f0b90b]">Liquidity</span>
        <span className="text-[#848e9c] font-mono">{symbol}</span>
      </div>

      <div className="p-2 space-y-3 overflow-auto flex-1">
        {/* High / Low */}
        <section>
          <div className="text-[10px] text-[#848e9c] uppercase mb-1">High / Low</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
            <span className="text-[#848e9c]">Last</span>
            <span className="text-right">{fmtPx(metrics.last)}</span>
            <span className="text-[#848e9c]">High 24h</span>
            <span className="text-right text-[#0ecb81]">{fmtPx(metrics.high24)}</span>
            <span className="text-[#848e9c]">Low 24h</span>
            <span className="text-right text-[#f6465d]">{fmtPx(metrics.low24)}</span>
            <span className="text-[#848e9c]">High (bars)</span>
            <span className="text-right text-[#0ecb81]">{fmtPx(metrics.highBar)}</span>
            <span className="text-[#848e9c]">Low (bars)</span>
            <span className="text-right text-[#f6465d]">{fmtPx(metrics.lowBar)}</span>
            <span className="text-[#848e9c]">Bid / Ask</span>
            <span className="text-right">
              <span className="text-[#0ecb81]">{fmtPx(metrics.bestBid)}</span>
              {' / '}
              <span className="text-[#f6465d]">{fmtPx(metrics.bestAsk)}</span>
            </span>
          </div>
          {metrics.posInRange != null && (
            <div className="mt-1.5">
              <div className="flex justify-between text-[9px] text-[#5e6673] mb-0.5">
                <span>Pos in 24h range</span>
                <span>{(metrics.posInRange * 100).toFixed(0)}%</span>
              </div>
              {bar(metrics.posInRange, false)}
            </div>
          )}
        </section>

        {/* Long / Short bias */}
        <section>
          <div className="text-[10px] text-[#848e9c] uppercase mb-1">Position bias</div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded border text-[11px] font-semibold uppercase tracking-wide ${biasCls}`}
            >
              {metrics.bias === 'long'
                ? 'Long'
                : metrics.bias === 'short'
                  ? 'Short'
                  : 'Neutral'}
            </span>
            <span className="text-[10px] text-[#848e9c] font-mono">
              score {(metrics.score * 100).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div
              className={`rounded border px-2 py-1.5 ${
                metrics.bias === 'long'
                  ? 'border-[#0ecb81]/50 bg-[#0ecb81]/5'
                  : 'border-[#2b3139]'
              }`}
            >
              <div className="text-[9px] text-[#848e9c]">LONG pressure</div>
              <div className="text-[#0ecb81] font-mono text-[12px]">
                {Math.max(0, metrics.score * 100).toFixed(0)}%
              </div>
            </div>
            <div
              className={`rounded border px-2 py-1.5 ${
                metrics.bias === 'short'
                  ? 'border-[#f6465d]/50 bg-[#f6465d]/5'
                  : 'border-[#2b3139]'
              }`}
            >
              <div className="text-[9px] text-[#848e9c]">SHORT pressure</div>
              <div className="text-[#f6465d] font-mono text-[12px]">
                {Math.max(0, -metrics.score * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </section>

        {/* Imbalance */}
        <section>
          <div className="text-[10px] text-[#848e9c] uppercase mb-1">
            Imbalance (bid−ask)/(bid+ask)
          </div>
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
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2 text-[10px] font-mono">
            <span className="text-[#848e9c]">Bid 5</span>
            <span className="text-right text-[#0ecb81]">{metrics.bid5.toFixed(3)}</span>
            <span className="text-[#848e9c]">Ask 5</span>
            <span className="text-right text-[#f6465d]">{metrics.ask5.toFixed(3)}</span>
          </div>
        </section>

        {/* Balance */}
        <section>
          <div className="text-[10px] text-[#848e9c] uppercase mb-1">Balance</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span>Top 5</span>
                <span className="text-[#f0b90b]">{(metrics.balance5 * 100).toFixed(0)}%</span>
              </div>
              {bar(metrics.balance5, false)}
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span>Top 20</span>
                <span className="text-[#f0b90b]">{(metrics.balance20 * 100).toFixed(0)}%</span>
              </div>
              {bar(metrics.balance20, false)}
            </div>
          </div>
          <p className="text-[9px] text-[#5e6673] mt-1">
            100% = book equilibrato · 0% = tutto su un lato
          </p>
        </section>

        {/* Tape delta */}
        <section>
          <div className="text-[10px] text-[#848e9c] uppercase mb-1">Tape delta</div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span>Δ volume</span>
            <span className={metrics.delta >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
              {metrics.delta.toFixed(4)}
            </span>
          </div>
          {bar(metrics.deltaImb)}
          <div className="grid grid-cols-2 gap-x-2 mt-2 text-[10px] font-mono">
            <span className="text-[#848e9c]">Buy vol</span>
            <span className="text-right text-[#0ecb81]">{metrics.buyVol.toFixed(4)}</span>
            <span className="text-[#848e9c]">Sell vol</span>
            <span className="text-right text-[#f6465d]">{metrics.sellVol.toFixed(4)}</span>
          </div>
        </section>
      </div>
    </div>
  )
}
