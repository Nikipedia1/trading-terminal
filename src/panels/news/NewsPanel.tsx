/**
 * News panel – desk widget UI (title, source, time, link, asset filter).
 * Production renders an empty list until a live feed is wired.
 * Inject `items` only from tests (see __tests__/news.mock.ts).
 */

import { useMemo, useState } from 'react'
import type { NewsAssetFilter, NewsItem } from './types'

const FILTERS: { id: NewsAssetFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'BTC', label: 'BTC' },
  { id: 'ETH', label: 'ETH' },
  { id: 'macro', label: 'Macro' },
]

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
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

function matchesFilter(item: NewsItem, filter: NewsAssetFilter): boolean {
  if (filter === 'all') return true
  return item.assets.includes(filter)
}

export interface NewsPanelProps {
  /** Optional override – production leaves this undefined (empty feed). */
  items?: NewsItem[]
}

export function NewsPanel({ items }: NewsPanelProps) {
  const [filter, setFilter] = useState<NewsAssetFilter>('all')
  const feed = items ?? []

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
        <span className="ml-auto text-terminal-muted text-[10px]">
          {visible.length}/{feed.length}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="px-3 py-6 text-center text-terminal-muted">
            {feed.length === 0
              ? 'No news feed connected yet.'
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
                  <time dateTime={new Date(n.publishedAt).toISOString()}>
                    {formatTime(n.publishedAt)}
                  </time>
                  <span className="flex gap-0.5">
                    {n.assets.map((a) => (
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
