/**
 * Fixed HUD – feed quality + SLA for primary panel.
 */

import { useEffect, useMemo, useState } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import {
  getFeedHealth,
  subscribeFeedHealth,
  FEED_HEALTH_NOTES,
  type FeedHealthSnapshot,
} from '@/data/shared'
import { evaluateSla } from '@/data/market/feedPolicy'
import { useMarketStore } from '@/stores/marketStore'

function ageLabel(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function FeedHealthHud() {
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const exchange = primary?.exchange ?? 'binance'
  const symbol = primary?.symbol ?? 'BTCUSDT'
  const streamDropped = useMarketStore((s) => s.streamDropped)
  const historyMeta = useMarketStore((s) => s.historyMeta)

  const [h, setH] = useState<FeedHealthSnapshot>(() =>
    getFeedHealth(exchange, symbol)
  )
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    setH(getFeedHealth(exchange, symbol))
    return subscribeFeedHealth((snap) => {
      if (snap.exchange === exchange && snap.symbol === symbol.toUpperCase()) {
        setH(snap)
      }
    })
  }, [exchange, symbol])

  useEffect(() => {
    const id = window.setInterval(() => {
      setH(getFeedHealth(exchange, symbol))
    }, 1000)
    return () => window.clearInterval(id)
  }, [exchange, symbol])

  const sla = useMemo(
    () =>
      evaluateSla({
        bookAgeMs: h.bookAgeMs,
        tickAgeMs: h.tickAgeMs,
        latencyP99: h.latencyP99,
        gapsRecent: h.gaps,
      }),
    [h.bookAgeMs, h.tickAgeMs, h.latencyP99, h.gaps]
  )

  const p50 = h.latencyP50 != null ? `${Math.round(h.latencyP50)}ms` : '—'
  const p99 = h.latencyP99 != null ? `${Math.round(h.latencyP99)}ms` : '—'
  const errN = h.errorQueue?.length ?? 0

  const slaClass =
    sla.level === 'crit'
      ? 'text-[#f6465d] font-bold'
      : sla.level === 'warn'
        ? 'text-[#f0b90b] font-semibold'
        : 'text-[#0ecb81]'

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[40] border-t border-[#2b3139] bg-[#0b0e11]/95 px-3 py-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] font-mono-nums text-[#848e9c]"
      title={`${FEED_HEALTH_NOTES.latency} ${FEED_HEALTH_NOTES.stale}`}
    >
      <span className="text-[#eaecef] font-semibold">
        {exchange}:{symbol}
      </span>
      <span className={slaClass} title={sla.reasons.join(', ') || 'within SLA'}>
        SLA {sla.level.toUpperCase()}
        {sla.reasons.length > 0 ? ` (${sla.reasons[0]})` : ''}
      </span>
      <span>
        lag p50 <span className="text-[#eaecef]">{p50}</span>
        {' · '}
        p99 <span className="text-[#eaecef]">{p99}</span>
      </span>
      <span>
        tick{' '}
        <span className={h.tickStale ? 'text-[#f6465d]' : 'text-[#eaecef]'}>
          {ageLabel(h.tickAgeMs)}
        </span>
        {' · book '}
        <span className={h.bookStale ? 'text-[#f6465d]' : 'text-[#eaecef]'}>
          {ageLabel(h.bookAgeMs)}
        </span>
      </span>
      <span>
        gaps <span className={h.gaps > 0 ? 'text-[#f0b90b]' : 'text-[#eaecef]'}>{h.gaps}</span>
        {' · '}
        resync <span className="text-[#eaecef]">{h.resyncs}</span>
        {' · '}
        reconn <span className="text-[#eaecef]">{h.reconnects}</span>
      </span>
      {(streamDropped?.trades || streamDropped?.book) ? (
        <span className="text-[#f0b90b]" title="Throttled under load">
          drop t{streamDropped?.trades ?? 0}/b{streamDropped?.book ?? 0}
        </span>
      ) : null}
      {historyMeta?.fallbackUsed && (
        <span className="text-[#f0b90b]">hist via {historyMeta.exchangeUsed}</span>
      )}
      <span
        className={
          h.bookStale || h.tickStale
            ? 'text-[#f6465d] font-semibold'
            : h.status === 'connected'
              ? 'text-[#0ecb81]'
              : 'text-[#f0b90b]'
        }
      >
        {h.bookStale ? 'BOOK STALE' : h.tickStale ? 'TICK STALE' : h.status}
      </span>
      <button
        type="button"
        className={`px-1 rounded ${errN > 0 ? 'text-[#f6465d]' : 'text-[#5e6673]'} hover:underline`}
        onClick={() => setShowErrors((v) => !v)}
        title="Error queue"
      >
        err {errN}
      </button>
      <span className="text-[#5e6673] hidden sm:inline">
        multi-venue · throttle · no MBO
      </span>

      {showErrors && errN > 0 && (
        <div className="absolute bottom-full left-0 right-0 max-h-32 overflow-y-auto bg-[#12161c] border border-[#2b3139] p-2 text-[10px]">
          {h.errorQueue.map((e, i) => (
            <div key={`${e.ts}-${i}`} className="text-[#f6465d] font-mono-nums">
              {new Date(e.ts).toLocaleTimeString()} [{e.code}] {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
