/**
 * Fixed HUD – feed quality for primary panel (free client metrics).
 */

import { useEffect, useState } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import {
  getFeedHealth,
  subscribeFeedHealth,
  FEED_HEALTH_NOTES,
  type FeedHealthSnapshot,
} from '@/data/shared'

export function FeedHealthHud() {
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const exchange = primary?.exchange ?? 'binance'
  const symbol = primary?.symbol ?? 'BTCUSDT'

  const [h, setH] = useState<FeedHealthSnapshot>(() =>
    getFeedHealth(exchange, symbol)
  )

  useEffect(() => {
    setH(getFeedHealth(exchange, symbol))
    return subscribeFeedHealth((snap) => {
      if (snap.exchange === exchange && snap.symbol === symbol.toUpperCase()) {
        setH(snap)
      }
    })
  }, [exchange, symbol])

  // Refresh stale flag
  useEffect(() => {
    const id = window.setInterval(() => {
      setH(getFeedHealth(exchange, symbol))
    }, 1000)
    return () => window.clearInterval(id)
  }, [exchange, symbol])

  const p50 = h.latencyP50 != null ? `${Math.round(h.latencyP50)}ms` : '—'
  const p99 = h.latencyP99 != null ? `${Math.round(h.latencyP99)}ms` : '—'

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[40] border-t border-[#2b3139] bg-[#0b0e11]/95 px-3 py-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] font-mono-nums text-[#848e9c]"
      title={`${FEED_HEALTH_NOTES.latency} ${FEED_HEALTH_NOTES.history}`}
    >
      <span className="text-[#eaecef] font-semibold">
        {exchange}:{symbol}
      </span>
      <span>
        lag p50 <span className="text-[#eaecef]">{p50}</span>
        {' · '}
        p99 <span className="text-[#eaecef]">{p99}</span>
      </span>
      <span>
        gaps <span className={h.gaps > 0 ? 'text-[#f0b90b]' : 'text-[#eaecef]'}>{h.gaps}</span>
        {' · '}
        resync <span className="text-[#eaecef]">{h.resyncs}</span>
        {' · '}
        reconn <span className="text-[#eaecef]">{h.reconnects}</span>
      </span>
      <span
        className={
          h.bookStale
            ? 'text-[#f6465d] font-semibold'
            : h.status === 'connected'
              ? 'text-[#0ecb81]'
              : 'text-[#f0b90b]'
        }
      >
        {h.bookStale ? 'BOOK STALE' : h.status}
      </span>
      <span className="text-[#5e6673] hidden sm:inline">
        free tier · IDB history · no MBO
      </span>
    </div>
  )
}
