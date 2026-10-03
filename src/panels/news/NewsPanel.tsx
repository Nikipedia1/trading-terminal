/**
 * News panel – live feed from GET /api/news (real RSS, no runtime mocks).
 * Poll every 45s; NEW badge on fresh items for 60s; pause when tab/panel hidden.
 * Asset tags from titles; click switches marketStore.symbol; active-symbol first.
 * Optional `items` prop is only for unit tests.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NewsApiResponse, NewsAssetFilter, NewsItem } from './types'
import {
  enrichTags,
  matchesActiveSymbol,
  symbolFromTitle,
} from './assetTags'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'

const FILTERS: { id: NewsAssetFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'BTC', label: 'BTC' },
  { id: 'ETH', label: 'ETH' },
  { id: 'macro', label: 'Macro' },
]

const POLL_MS = 45_000
const NEW_BADGE_MS = 60_000

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

function matchesFilter(tags: string[], filter: NewsAssetFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'macro') {
    return tags.some((t) =>
      ['macro', 'FOMC', 'CPI', 'ETF', 'SEC', 'FED'].includes(t)
    )
  }
  return tags.some((t) => t.toUpperCase() === filter.toUpperCase())
}

function networkErrorMessage(e: unknown, httpStatus?: number): string {
  if (httpStatus === 404) {
    return 'News API not found (/api/news). Deploy Cloudflare Pages Functions or run: npm run cf:pages:dev'
  }
  if (httpStatus === 502 || httpStatus === 503) {
    return 'News upstream temporarily unavailable. Retrying automatically…'
  }
  if (httpStatus === 429) {
    return 'Too many requests to the news API. Waiting for the next poll…'
  }
  if (httpStatus && httpStatus >= 400) {
    return `News API error (HTTP ${httpStatus}). Check network or try Refresh.`
  }
  const name = (e as { name?: string })?.name
  const msg = e instanceof Error ? e.message : String(e ?? '')
  if (name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Network error: cannot reach /api/news. Check connection, CORS, or local proxy (VITE_API_PROXY).'
  }
  if (/invalid response|unexpected token|json/i.test(msg)) {
    return 'News API returned invalid data. The endpoint may be misconfigured.'
  }
  return msg ? `News feed error: ${msg}` : 'News feed error: unknown network failure.'
}

export interface NewsPanelProps {
  items?: NewsItem[]
}

export function NewsPanel({ items: itemsProp }: NewsPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const firstLoadDoneRef = useRef(false)
  const visibleRef = useRef(true)
  const wasPausedRef = useRef(false)

  const activeSymbol = useMarketStore((s) => s.symbol)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const updatePanel = useLayoutStore((s) => s.updatePanel)

  const [filter, setFilter] = useState<NewsAssetFilter>('all')
  const [feed, setFeed] = useState<NewsItem[]>(itemsProp ?? [])
  const [newSince, setNewSince] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(!itemsProp)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (itemsProp) return
      setLoading(true)
      try {
        const res = await fetch('/api/news', {
          signal,
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
        }
        const data = (await res.json()) as NewsApiResponse
        if (!data || !Array.isArray(data.items)) {
          throw new Error('Invalid response')
        }

        const incoming = data.items.map((it) => ({
          ...it,
          tags: enrichTags(it.title, it.source, it.tags),
        }))
        const known = knownIdsRef.current
        const arrivedAt = Date.now()

        if (!firstLoadDoneRef.current) {
          for (const it of incoming) known.add(it.id)
          firstLoadDoneRef.current = true
          setNewSince({})
        } else {
          const fresh: Record<string, number> = {}
          for (const it of incoming) {
            if (!known.has(it.id)) {
              known.add(it.id)
              fresh[it.id] = arrivedAt
            }
          }
          if (Object.keys(fresh).length > 0) {
            setNewSince((prev) => {
              const next = { ...prev, ...fresh }
              const cutoff = arrivedAt - NEW_BADGE_MS
              for (const id of Object.keys(next)) {
                if ((next[id] ?? 0) < cutoff) delete next[id]
              }
              return next
            })
          }
        }

        setFeed(incoming)
        setWarnings(Array.isArray(data.warnings) ? data.warnings : [])
        setFetchedAt(data.fetchedAt ?? new Date().toISOString())
        setError(null)
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return
        const status = (e as { status?: number })?.status
        setError(networkErrorMessage(e, status))
      } finally {
        setLoading(false)
      }
    },
    [itemsProp]
  )

  useEffect(() => {
    if (itemsProp) return

    const updatePaused = (panelInView: boolean) => {
      const docVisible = document.visibilityState === 'visible'
      const active = docVisible && panelInView
      visibleRef.current = active
      setPaused(!active)
    }

    const onVis = () => {
      updatePaused(document.visibilityState === 'visible')
    }

    document.addEventListener('visibilitychange', onVis)

    let io: IntersectionObserver | null = null
    const el = rootRef.current
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          const inView =
            !!entry?.isIntersecting && (entry.intersectionRatio ?? 0) > 0.05
          updatePaused(inView)
        },
        { threshold: [0, 0.05, 0.25] }
      )
      io.observe(el)
    } else {
      updatePaused(true)
    }

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      io?.disconnect()
    }
  }, [itemsProp])

  useEffect(() => {
    if (itemsProp) {
      setFeed(
        itemsProp.map((it) => ({
          ...it,
          tags: enrichTags(it.title, it.source, it.tags),
        }))
      )
      setLoading(false)
      return
    }

    const ac = new AbortController()
    void load(ac.signal)

    const id = window.setInterval(() => {
      if (!visibleRef.current) return
      void load()
    }, POLL_MS)

    return () => {
      ac.abort()
      window.clearInterval(id)
    }
  }, [itemsProp, load])

  useEffect(() => {
    if (itemsProp) return
    if (wasPausedRef.current && !paused) {
      void load()
    }
    wasPausedRef.current = paused
  }, [paused, itemsProp, load])

  useEffect(() => {
    if (Object.keys(newSince).length === 0) return
    const id = window.setInterval(() => {
      const now = Date.now()
      setNowTick(now)
      setNewSince((prev) => {
        const next = { ...prev }
        let changed = false
        for (const k of Object.keys(next)) {
          if ((next[k] ?? 0) + NEW_BADGE_MS <= now) {
            delete next[k]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 5_000)
    return () => window.clearInterval(id)
  }, [newSince])

  const isNew = useCallback(
    (id: string) => {
      const t = newSince[id]
      if (t == null) return false
      return nowTick - t < NEW_BADGE_MS
    },
    [newSince, nowTick]
  )

  /** Filter + pin headlines matching active chart symbol on top. */
  const visible = useMemo(() => {
    const filtered = feed.filter((n) => matchesFilter(n.tags ?? [], filter))
    const related: NewsItem[] = []
    const rest: NewsItem[] = []
    for (const n of filtered) {
      if (matchesActiveSymbol(n.tags ?? [], n.title, activeSymbol)) related.push(n)
      else rest.push(n)
    }
    // both groups already newest-first from API
    return [...related, ...rest]
  }, [feed, filter, activeSymbol])

  const applySymbolFromNews = useCallback(
    (sym: string) => {
      const v = sym.toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (!v || v === activeSymbol) return
      setSymbol(v)
      updatePanel(primaryPanelId, { symbol: v })
      void loadHistorical().then(() => startLive())
    },
    [activeSymbol, setSymbol, updatePanel, primaryPanelId, loadHistorical, startLive]
  )

  const onHeadlineClick = useCallback(
    (e: React.MouseEvent, item: NewsItem) => {
      const sym = symbolFromTitle(item.title, item.tags ?? [])
      if (sym && sym !== activeSymbol) {
        // Modifier or middle-click: only open URL (default). Primary click: switch symbol + open.
        if (!e.metaKey && !e.ctrlKey && e.button === 0) {
          applySymbolFromNews(sym)
        }
      }
      // always allow default navigation to article (target=_blank)
    },
    [activeSymbol, applySymbolFromNews]
  )

  const activeBase = activeSymbol.replace(/USDT$/i, '').replace(/USD$/i, '')

  return (
    <div
      ref={rootRef}
      className="flex flex-col h-full min-h-0 text-[11px] bg-terminal-panel text-terminal-text"
    >
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
          className="text-xxs px-1.5 py-0.5 rounded border border-terminal-border text-terminal-muted hover:text-[#f0b90b] disabled:opacity-40"
          title="Refresh now"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? '…' : '↻'}
        </button>
        {paused && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e2329] text-[#848e9c] border border-[#2b3139]"
            title="Polling paused while the panel or tab is hidden"
          >
            paused
          </span>
        )}
        <span
          className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e2329] text-[#f0b90b] border border-[#f0b90b]/30"
          title="Headlines matching this pair are pinned to the top"
        >
          {activeBase || activeSymbol}
        </span>
        <span className="ml-auto text-terminal-muted text-[10px]">
          {visible.length}/{feed.length}
          {fetchedAt ? ` · ${formatTime(fetchedAt)}` : ''}
        </span>
      </div>

      {error && (
        <div className="px-2 py-1.5 text-[10px] text-terminal-red border-b border-terminal-red/30 shrink-0 leading-snug">
          <div className="font-medium">Network / API</div>
          <div>{error}</div>
          {feed.length > 0 && (
            <div className="text-[#848e9c] mt-0.5">Showing last successful headlines.</div>
          )}
        </div>
      )}
      {warnings.length > 0 && !error && (
        <div
          className="px-2 py-0.5 text-[9px] text-[#848e9c] border-b border-terminal-border/50 shrink-0 truncate"
          title={warnings.join('; ')}
        >
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
                  ? 'No headlines (API unreachable). Use Refresh when online.'
                  : 'No headlines from upstream RSS yet.'
                : 'No headlines for this filter.'}
          </div>
        ) : (
          <ul className="divide-y divide-terminal-border/60">
            {visible.map((n) => {
              const fresh = isNew(n.id)
              const tags = n.tags ?? []
              const related = matchesActiveSymbol(tags, n.title, activeSymbol)
              const chartSym = symbolFromTitle(n.title, tags)
              return (
                <li
                  key={n.id}
                  className={`px-2 py-2 hover:bg-[#12161c]/80 ${
                    fresh ? 'bg-[#f0b90b]/5' : ''
                  } ${related ? 'border-l-2 border-l-[#f0b90b]' : ''}`}
                >
                  <div className="flex items-start gap-1.5">
                    {fresh && (
                      <span className="shrink-0 mt-0.5 text-[9px] font-bold tracking-wide px-1 py-px rounded bg-[#f0b90b] text-[#0b0e11]">
                        NEW
                      </span>
                    )}
                    {related && !fresh && (
                      <span
                        className="shrink-0 mt-0.5 text-[9px] font-semibold tracking-wide px-1 py-px rounded bg-[#1e2329] text-[#f0b90b] border border-[#f0b90b]/40"
                        title={`Related to ${activeSymbol}`}
                      >
                        {activeBase}
                      </span>
                    )}
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block flex-1 text-[#eaecef] hover:text-[#f0b90b] font-medium leading-snug"
                      title={
                        chartSym
                          ? `Open article · click switches chart to ${chartSym}`
                          : 'Open article'
                      }
                      onClick={(e) => onHeadlineClick(e, n)}
                    >
                      {n.title}
                    </a>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-terminal-muted">
                    <span className="text-[#848e9c]">{n.source}</span>
                    <span>·</span>
                    <time dateTime={new Date(publishedMs(n.publishedAt)).toISOString()}>
                      {formatTime(n.publishedAt)}
                    </time>
                    <span className="flex gap-0.5 flex-wrap">
                      {tags.map((a) => (
                        <span
                          key={a}
                          className={`px-1 rounded border ${
                            a.toUpperCase() === activeBase
                              ? 'bg-[#f0b90b]/15 text-[#f0b90b] border-[#f0b90b]/40'
                              : 'bg-[#1e2329] text-[#848e9c] border-[#2b3139]'
                          }`}
                        >
                          {a}
                        </span>
                      ))}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
