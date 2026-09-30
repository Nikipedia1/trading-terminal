/**
 * Chart HUD – candle close countdown + best bid/ask.
 * Timer uses UTC-aligned bar boundaries (standard crypto kline).
 * Bid/ask from shared order book feed (real L2 only, never mocked).
 */

import { useEffect, useState } from 'react'
import type { ExchangeId, Interval } from '@/types'
import { subscribeOrderBookFeed } from '@/data/shared'

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
  // 1M approximate – calendar months are not fixed ms
  '1M': 30 * 86_400_000,
}

function intervalMs(interval: Interval): number {
  return INTERVAL_MS[interval] ?? 60_000
}

function formatCountdown(ms: number): string {
  if (ms < 0) ms = 0
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Progress 0..1 within current bar (0 = just opened, 1 = about to close). */
function barProgress(interval: Interval, nowMs: number): { remainingMs: number; progress: number } {
  const period = intervalMs(interval)
  const elapsed = nowMs % period
  const remainingMs = period - elapsed
  return { remainingMs, progress: elapsed / period }
}

export function CandleCloseTimer({ interval }: { interval: Interval }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const { remainingMs, progress } = barProgress(interval, now)
  const urgent = remainingMs < 10_000
  const warn = remainingMs < 30_000

  return (
    <div
      className="inline-flex items-center gap-1.5 shrink-0"
      title={`Time left in current ${interval} candle (UTC bar close)`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col leading-none min-w-[3.25rem]">
        <span className="text-[9px] text-[#848e9c] uppercase tracking-wider">Close</span>
        <span
          className={
            'font-mono text-xs font-semibold tabular-nums ' +
            (urgent
              ? 'text-[#f6465d]'
              : warn
                ? 'text-[#f0b90b]'
                : 'text-[#eaecef]')
          }
        >
          {formatCountdown(remainingMs)}
        </span>
      </div>
      <div
        className="w-10 h-1.5 rounded-full bg-[#1e2329] overflow-hidden"
        aria-hidden
      >
        <div
          className={
            'h-full rounded-full transition-[width] duration-200 ' +
            (urgent ? 'bg-[#f6465d]' : warn ? 'bg-[#f0b90b]' : 'bg-[#0ecb81]')
          }
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>
    </div>
  )
}

function fmtPx(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  return n.toPrecision(6)
}

export function BidAskStrip({
  exchange,
  symbol,
}: {
  exchange: ExchangeId
  symbol: string
}) {
  const [bid, setBid] = useState<number | null>(null)
  const [ask, setAsk] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setBid(null)
    setAsk(null)
    setReady(false)
    const sub = subscribeOrderBookFeed(exchange, symbol, {
      onBook: (snap) => {
        const b = snap.bids[0]?.price ?? null
        const a = snap.asks[0]?.price ?? null
        setBid(b)
        setAsk(a)
        setReady(snap.ready)
      },
      onStatus: (s) => {
        if (s.status !== 'connected') setReady(false)
      },
    })
    return () => sub.unsubscribe()
  }, [exchange, symbol])

  const spread =
    bid != null && ask != null && ask > 0 && bid > 0 ? ask - bid : null
  const spreadBps =
    spread != null && bid != null && bid > 0 ? (spread / bid) * 10_000 : null

  return (
    <div
      className="inline-flex items-center gap-2 shrink-0 font-mono text-[11px] tabular-nums"
      title={ready ? 'Best bid / ask (L2 top of book)' : 'Order book connecting…'}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col leading-none">
        <span className="text-[9px] text-[#848e9c]">Bid</span>
        <span className="text-[#0ecb81] font-semibold">{fmtPx(bid ?? 0)}</span>
      </div>
      <div className="flex flex-col leading-none items-center">
        <span className="text-[9px] text-[#5e6673]">Spr</span>
        <span className="text-[#848e9c] text-[10px]">
          {spread != null
            ? spreadBps != null && spreadBps < 50
              ? `${spreadBps.toFixed(1)}b`
              : fmtPx(spread)
            : '—'}
        </span>
      </div>
      <div className="flex flex-col leading-none items-end">
        <span className="text-[9px] text-[#848e9c]">Ask</span>
        <span className="text-[#f6465d] font-semibold">{fmtPx(ask ?? 0)}</span>
      </div>
    </div>
  )
}

/** Combined strip for chart panel header */
export function ChartPanelHud({
  interval,
  exchange,
  symbol,
}: {
  interval: Interval
  exchange: ExchangeId
  symbol: string
}) {
  return (
    <div className="inline-flex items-center gap-3 shrink-0 px-1.5 py-0.5 rounded bg-[#12161c] border border-[#2b3139]">
      <CandleCloseTimer interval={interval} />
      <div className="w-px h-6 bg-[#2b3139]" />
      <BidAskStrip exchange={exchange} symbol={symbol} />
    </div>
  )
}
