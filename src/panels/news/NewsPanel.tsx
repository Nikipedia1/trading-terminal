/**
 * News panel – live feed from GET /api/news (real RSS, no runtime mocks).
 * Optional `items` prop is only for unit tests.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NewsApiResponse, NewsAssetFilter, NewsItem } from './types'

const FILTERS: { id: NewsAssetFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'BTC', label: 'BTC' },
  { id: 'ETH', label: 'ETH' },
  { id: 'macro', label: 'Macro' },
]

const POLL_MS = 35_000

function publishedMs(v: string | number): number {
  if (typeof v === 'number') return v
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : 0
}

function formatTime(v: string | number): string {
  const ms = publishedMs(v)
  if (!ms) return '—'
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function itemTags(item: NewsItem): string[] {
  return Array.isArray(item.tags) ? item.tags : []
}

function matchesFilter(item: NewsItem, filter: NewsAssetFilter): boolean {
  if (filter === 'all') return true
  return itemTags(item).some((t) => t.toUpperCase() === filter.toUpperCase())
}

export interface NewsPanelProps {
  /** Test-only injection – production always fetches /api/news. */
  items?: NewsItem[]
}

export function NewsPanel({ items: itemsProp }: NewsPanelProps) {
  const [filter, setFilter] = useState<NewsAssetFilter>('all')
  const [feed, setFeed] = useState<NewsItem[]>(itemsProp ?? [])
  const [loading, setLoading] = useState(!itemsProp)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    // When tests inject items, skip network
    if (itemsProp) return
    setLoading(true)
    try {
      const res = await fetch('/api/news', {
        signal,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = (await res.json()) as NewsApiResponse
      if (!data || !Array.isArray(data.items)) {
        throw new Error('Invalid response')
      }
      // Trust only real payload – no client-side placeholders
      setFeed(data.items)
      setWarnings(Array.isArray(data.warnings) ? data.warnings : [])
      setFetchedAt(data.fetchedAt ?? new Date().toISOString())
      setError(null)
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Fetch failed')
      // Keep last good feed if any; do not invent headlines
    } finally {
      setLoading(false)
    }
  }, [itemsProp])

  useEffect(() => {
    if (itemsProp) {
      setFeed(itemsProp)
      setLoading(false)
      return
    }
    const ac = new AbortController()
    void load(ac.signal)
    const t = window.setInterval(() => void load(), POLL_MS)
    return () => {
      ac.abort()
      window.clearInterval(t)
    }
  }, [itemsProp, load])

  const visible = useMemo(
    () => feed.filter((n) => matchesFilter(n, filter)),
    [feed, filter]
  )

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px] bg-terminal-panel text-terminal-text">
      <div className="px-2 py-1.5 border-b border-terminal-border shrink-0 flex flex-wrap items-center gap-1">
        <span className="font-semibold text-[#eaecef] mr-1">News</span>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`text-xxs px-1.5 py-0.5 rounded border transition-colors ${
              filter === f.id
                ? 'bg-[#1e2329] text-[#f0b90b] border-[#f0b90b]/50'
                : 'text-terminal-muted border-terminal-border hover:text-terminal-text'
            }`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className="text-xxs px-1.5 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#f0b90b]"
          title="Refresh"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? '…' : '↻'}
        </button>
        <span className="ml-auto text-terminal-muted text-[10px]">
          {visible.length}/{feed.length}
          {fetchedAt
            ? ` · ${formatTime(fetchedAt)}`
            : ''}
        </span>
      </div>

      {error && (
        <div className="px-2 py-1 text-[10px] text-terminal-red border-b border-terminal-red/30 shrink-0">
          Feed error: {error}
          {!itemsProp && ' — deploy Pages Functions or run wrangler pages dev'}
        </div>
      )}
      {warnings.length > 0 && !error && (
        <div className="px-2 py-0.5 text-[9px] text-[#848e9c] border-b border-terminal-border/50 shrink-0 truncate" title={warnings.join('; ')}>
          Partial: {warnings.join(' · ')}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="px-3 py-6 text-center text-terminal-muted">
            {loading
              ? 'Loading headlines…'
              : feed.length === 0
                ? error
                  ? 'No live feed (API unreachable).'
                  : 'No headlines from upstream RSS yet.'
                : 'No headlines for this filter.'}
          </div>
        ) : (
          <ul className="divide-y divide-terminal-border/60">
            {visible.map((n) => (
              <li key={n.id} className="px-2 py-2 hover:bg-[#12161c]/80">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[#eaecef] hover:text-[#f0b90b] font-medium leading-snug"
                >
                  {n.title}
                </a>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-terminal-muted">
                  <span className="text-[#848e9c]">{n.source}</span>
                  <span>·</span>
                  <time dateTime={new Date(publishedMs(n.publishedAt)).toISOString()}>
                    {formatTime(n.publishedAt)}
                  </time>
                  <span className="flex gap-0.5">
                    {itemTags(n).map((a) => (
                      <span
                        key={a}
                        className="px-1 rounded bg-[#1e2329] text-[#848e9c] border border-[#2b3139]"
                      >
                        {a}
                      </span>
                    ))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
