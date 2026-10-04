/**
 * On-chain analysis desk panel – professional network / DeFi metrics.
 * Live data from GET /api/onchain (mempool.space, DefiLlama, public RPC).
 * No mock / synthetic values at runtime.
 */

import { useCallback, useEffect, useState } from 'react'
import type { OnchainSnapshot, OnchainTab } from './types'
import { OnchainBody, fmtWhen } from './OnchainViews'

const POLL_MS = 60_000

const TABS: { id: OnchainTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'btc', label: 'Bitcoin' },
  { id: 'eth', label: 'Ethereum' },
  { id: 'defi', label: 'DeFi' },
]

export function OnchainPanel() {
  const [tab, setTab] = useState<OnchainTab>('overview')
  const [data, setData] = useState<OnchainSnapshot | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await fetch('/api/onchain', { headers: { Accept: 'application/json' } })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as OnchainSnapshot
      setData(json)
      setErr(null)
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : 'Cannot reach /api/onchain. Deploy CF Functions or run npm run cf:pages:dev'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px] bg-terminal-panel text-terminal-text">
      <div className="px-2 py-1.5 border-b border-terminal-border shrink-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[#eaecef]">On-chain</span>
          <span className="text-[9px] text-[#5e6673]">
            {data?.updatedAt ? `upd ${fmtWhen(data.updatedAt)}` : ''}
            {data?.cached ? ' · cache' : ''}
          </span>
          <button
            type="button"
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#f0b90b] hover:border-[#f0b90b]/40 disabled:opacity-40"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            {refreshing ? '…' : 'Refresh'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                tab === t.id
                  ? 'bg-[#1e2329] text-[#f0b90b] border-[#f0b90b]/50'
                  : 'text-terminal-muted border-terminal-border hover:text-terminal-text'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
        {loading && !data ? (
          <div className="py-8 text-center text-terminal-muted">Loading on-chain metrics…</div>
        ) : null}
        {err && !data ? (
          <div className="px-2 py-4 text-[#f6465d] text-[11px] leading-relaxed">{err}</div>
        ) : null}
        {data ? <OnchainBody tab={tab} data={data} /> : null}
        {data?.warnings?.length ? (
          <div className="text-[9px] text-[#f0b90b]/80 border border-[#f0b90b]/20 rounded px-2 py-1.5">
            Partial upstream issues: {data.warnings.slice(0, 3).join(' · ')}
            {data.warnings.length > 3 ? ` (+${data.warnings.length - 3})` : ''}
          </div>
        ) : null}
        {data?.sources?.length ? (
          <div className="text-[9px] text-[#5e6673] px-0.5 pb-2">
            Sources: {data.sources.join(', ')} · real public APIs only
          </div>
        ) : null}
      </div>
    </div>
  )
}
