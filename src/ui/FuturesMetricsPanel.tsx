/**
 * Binance Futures public metrics – mark, funding, OI, liquidations.
 * Uses shared futuresMetricsFeed (real data only).
 */

import { useEffect, useState } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { subscribeFuturesMetrics } from '@/data/shared'
import { PUBLIC_API_LIMITS } from '@/data/exchanges/types'
import type {
  LiquidationEvent,
  MarkPriceTick,
  OpenInterestSnapshot,
  FundingRateRow,
} from '@/types'

function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: d })
}

function fmtRate(r: number) {
  if (!Number.isFinite(r)) return '—'
  return `${(r * 100).toFixed(4)}%`
}

export function FuturesMetricsPanel() {
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const exchange = primary?.exchange ?? 'binance'
  const symbol = primary?.symbol ?? 'BTCUSDT'

  const [mark, setMark] = useState<MarkPriceTick | null>(null)
  const [oi, setOi] = useState<OpenInterestSnapshot | null>(null)
  const [funding, setFunding] = useState<FundingRateRow[]>([])
  const [liqs, setLiqs] = useState<LiquidationEvent[]>([])
  const [status, setStatus] = useState('disconnected')
  const [err, setErr] = useState('')

  useEffect(() => {
    setMark(null)
    setOi(null)
    setFunding([])
    setLiqs([])
    setErr('')

    const sub = subscribeFuturesMetrics(exchange, symbol, {
      onMark: setMark,
      onOpenInterest: setOi,
      onFunding: setFunding,
      onLiquidation: (e) =>
        setLiqs((prev) => [e, ...prev].slice(0, 80)),
      onStatus: (s) => setStatus(s.status),
      onError: (e) => setErr(e.error.message),
    })

    // seed buffer
    setLiqs(sub.getRecentLiquidations().slice().reverse())

    return () => sub.unsubscribe()
  }, [exchange, symbol])

  if (exchange !== 'binance_futures') {
    return (
      <div className="p-3 text-[11px] text-[#848e9c] leading-relaxed">
        <p className="text-[#eaecef] font-semibold mb-1">Futures metrics</p>
        <p>
          Seleziona exchange <strong className="text-[#f0b90b]">binance_futures</strong>{' '}
          sul pannello primario (★) per mark, funding, open interest e liquidazioni
          pubbliche USDT-M.
        </p>
        <p className="mt-2 text-[9px] text-[#5e6673]">
          Dati pubblici Binance Futures — non è order flow istituzionale proprietario.
        </p>
      </div>
    )
  }

  const nextFund =
    mark?.nextFundingTime != null
      ? new Date(mark.nextFundingTime).toLocaleTimeString()
      : '—'

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px]">
      <div className="px-2 py-1.5 border-b border-terminal-border shrink-0 space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[#eaecef] font-semibold">{symbol} · USDT-M</span>
          <span
            className={
              status === 'connected'
                ? 'text-[#0ecb81]'
                : status === 'error'
                  ? 'text-[#f6465d]'
                  : 'text-[#f0b90b]'
            }
          >
            {status}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono-nums text-[#848e9c]">
          <span>Mark</span>
          <span className="text-right text-[#eaecef]">
            {mark ? fmt(mark.markPrice, 2) : '—'}
          </span>
          <span>Index</span>
          <span className="text-right text-[#eaecef]">
            {mark ? fmt(mark.indexPrice, 2) : '—'}
          </span>
          <span>Funding</span>
          <span
            className={`text-right ${
              (mark?.fundingRate ?? 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
            }`}
          >
            {mark ? fmtRate(mark.fundingRate) : '—'}
          </span>
          <span>Next fund</span>
          <span className="text-right text-[#eaecef]">{nextFund}</span>
          <span>Open interest</span>
          <span className="text-right text-[#eaecef]">
            {oi ? fmt(oi.openInterest, 3) : '—'}
          </span>
        </div>
        {err && (
          <p className="text-[10px] text-[#f6465d] leading-snug">{err}</p>
        )}
      </div>

      {funding.length > 0 && (
        <div className="px-2 py-1 border-b border-terminal-border shrink-0">
          <div className="text-[10px] text-[#848e9c] mb-0.5">Recent funding</div>
          <div className="flex flex-wrap gap-1">
            {funding.slice(0, 4).map((r) => (
              <span
                key={r.fundingTime}
                className={`px-1 py-0.5 rounded text-[10px] font-mono-nums ${
                  r.fundingRate >= 0
                    ? 'bg-[#0ecb81]/15 text-[#0ecb81]'
                    : 'bg-[#f6465d]/15 text-[#f6465d]'
                }`}
                title={new Date(r.fundingTime).toLocaleString()}
              >
                {fmtRate(r.fundingRate)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="px-2 py-1 text-[10px] text-[#848e9c] border-b border-terminal-border shrink-0">
        Liquidations (forceOrder)
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-xxs font-mono-nums">
          <thead className="sticky top-0 bg-terminal-panel text-terminal-muted">
            <tr>
              <th className="text-left px-2 py-1">Time</th>
              <th className="text-right px-2 py-1">Side</th>
              <th className="text-right px-2 py-1">Price</th>
              <th className="text-right px-2 py-1">Qty</th>
            </tr>
          </thead>
          <tbody>
            {liqs.map((e, i) => (
              <tr key={`${e.time}-${e.qty}-${i}`} className="border-t border-terminal-border/40">
                <td className="px-2 py-0.5">
                  {new Date(e.time).toLocaleTimeString()}
                </td>
                <td
                  className={`text-right px-2 py-0.5 ${
                    e.side === 'sell' ? 'text-[#f6465d]' : 'text-[#0ecb81]'
                  }`}
                >
                  {e.side === 'sell' ? 'LONG liq' : 'SHORT liq'}
                </td>
                <td className="text-right px-2 py-0.5">{fmt(e.price, 2)}</td>
                <td className="text-right px-2 py-0.5">{fmt(e.qty, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {liqs.length === 0 && (
          <div className="p-3 text-[#5e6673] text-[11px]">
            In attesa di liquidazioni su questo simbolo…
          </div>
        )}
      </div>

      <div className="px-2 py-1 text-[9px] text-[#5e6673] border-t border-terminal-border shrink-0 leading-snug">
        {(PUBLIC_API_LIMITS.binance_futures.notes as readonly string[]).slice(0, 2).join(' ')}{' '}
        OI poll 20s · funding 60s · multi-symbol = rischio 429.
      </div>
    </div>
  )
}
