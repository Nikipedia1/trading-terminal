/**
 * Watchlist panel – multi-symbol live quotes on the desk grid.
 * Shares store with terminal WL commands. Real tickers only.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useWatchlistStore, MAX_WATCHLIST } from '@/stores/watchlistStore'
import { useMarketStore } from '@/stores/marketStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { getExchangeClient } from '@/data/exchanges/registry'
import { SYMBOL_PRESETS } from '@/data/symbols'
import type { Ticker } from '@/types'

const POLL_MS = 8_000

function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function fmtPx(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1000) return fmt(n, 2)
  if (n >= 1) return fmt(n, 4)
  return n.toPrecision(5)
}

interface RowState {
  ticker: Ticker | null
  error?: string
  loading: boolean
}

export function WatchlistPanel() {
  const symbols = useWatchlistStore((s) => s.symbols)
  const add = useWatchlistStore((s) => s.add)
  const remove = useWatchlistStore((s) => s.remove)

  const exchange = useMarketStore((s) => s.exchange)
  const activeSymbol = useMarketStore((s) => s.symbol)
  const setSymbol = useMarketStore((s) => s.setSymbol)
  const loadHistorical = useMarketStore((s) => s.loadHistorical)
  const startLive = useMarketStore((s) => s.startLive)

  const updatePanel = useLayoutStore((s) => s.updatePanel)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)

  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [draft, setDraft] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)
  const abortRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!symbols.length) {
      setRows({})
      return
    }
    const token = ++abortRef.current
    const client = getExchangeClient(exchange)

    setRows((prev) => {
      const next = { ...prev }
      for (const s of symbols) {
        next[s] = { ticker: prev[s]?.ticker ?? null, loading: true, error: undefined }
      }
      return next
    })

    const results = await Promise.all(
      symbols.map(async (sym) => {
        try {
          const t = await client.getTicker(sym)
          return { sym, ticker: t as Ticker, error: undefined }
        } catch (e: unknown) {
          return {
            sym,
            ticker: null as Ticker | null,
            error: e instanceof Error ? e.message.slice(0, 40) : 'error',
          }
        }
      })
    )

    if (token !== abortRef.current) return

    setRows((prev) => {
      const next = { ...prev }
      for (const r of results) {
        next[r.sym] = { ticker: r.ticker, error: r.error, loading: false }
      }
      // drop removed
      for (const k of Object.keys(next)) {
        if (!symbols.includes(k)) delete next[k]
      }
      return next
    })
    setLastRefresh(Date.now())
  }, [symbols, exchange])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), POLL_MS)
    return () => {
      window.clearInterval(id)
      abortRef.current++
    }
  }, [refresh])

  const selectSymbol = (sym: string) => {
    setSymbol(sym)
    updatePanel(primaryPanelId, { symbol: sym })
    void loadHistorical().then(() => startLive())
  }

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = draft.trim()
    if (!raw) return
    // allow space-separated batch
    const parts = raw.split(/[\s,]+/).filter(Boolean)
    let added = 0
    for (const p of parts) {
      const r = add(p)
      if (r.ok) added++
      else if (r.error) setMsg(r.error)
    }
    if (added) setMsg(`+${added} symbol${added > 1 ? 's' : ''}`)
    setDraft('')
    window.setTimeout(() => setMsg(null), 2000)
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[11px]">
      {/* Toolbar */}
      <div className="shrink-0 px-2 py-1.5 border-b border-[#1e2329] flex items-center gap-2">
        <form onSubmit={onAdd} className="flex-1 flex gap-1 min-w-0">
          <input
            className="flex-1 min-w-0 bg-[#12161c] border border-[#2b3139] rounded px-1.5 py-1 font-mono text-[#eaecef] placeholder:text-[#5e6673]"
            placeholder="Add e.g. PEPEUSDT"
            value={draft}
            list="wl-presets"
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
          />
          <datalist id="wl-presets">
            {SYMBOL_PRESETS.map((p) => (
              <option key={p.symbol} value={p.symbol} />
            ))}
          </datalist>
          <button
            type="submit"
            className="px-2 py-1 rounded bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30 hover:bg-[#f0b90b]/25 shrink-0"
          >
            +
          </button>
        </form>
        <button
          type="button"
          title="Refresh"
          className="px-1.5 py-1 text-[#848e9c] hover:text-[#eaecef] shrink-0"
          onClick={() => void refresh()}
        >
          ↻
        </button>
      </div>

      {(msg || lastRefresh) && (
        <div className="shrink-0 px-2 py-0.5 text-[9px] text-[#5e6673] flex justify-between border-b border-[#1e2329]/50">
          <span>{msg ?? ''}</span>
          <span>
            {symbols.length}/{MAX_WATCHLIST}
            {lastRefresh ? ` · ${new Date(lastRefresh).toLocaleTimeString()}` : ''}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-2 py-1 text-[9px] text-[#848e9c] uppercase tracking-wider border-b border-[#1e2329]">
        <span>Symbol</span>
        <span className="text-right min-w-[72px]">Last</span>
        <span className="text-right min-w-[56px]">Chg%</span>
        <span className="w-5" />
      </div>

      {/* Rows */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {symbols.length === 0 && (
          <div className="p-4 text-center text-[#5e6673] text-[11px]">
            Empty watchlist — add a symbol above
          </div>
        )}
        {symbols.map((sym) => {
          const row = rows[sym]
          const t = row?.ticker
          const active = sym === activeSymbol
          const up = (t?.priceChangePercent ?? 0) >= 0
          return (
            <div
              key={sym}
              className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center px-2 py-1.5 border-b border-[#1e2329]/40 cursor-pointer hover:bg-[#12161c] ${
                active ? 'bg-[#f0b90b]/08 border-l-2 border-l-[#f0b90b]' : ''
              }`}
              onClick={() => selectSymbol(sym)}
              title="Click to set as primary symbol"
            >
              <div className="min-w-0">
                <div className={`font-semibold font-mono truncate ${active ? 'text-[#f0b90b]' : 'text-[#eaecef]'}`}>
                  {sym}
                </div>
                {row?.error && (
                  <div className="text-[9px] text-[#f6465d] truncate">{row.error}</div>
                )}
                {row?.loading && !t && (
                  <div className="text-[9px] text-[#5e6673]">…</div>
                )}
              </div>
              <span className="text-right font-mono tabular-nums text-[#eaecef] min-w-[72px]">
                {t ? fmtPx(t.lastPrice) : '—'}
              </span>
              <span
                className={`text-right font-mono tabular-nums min-w-[56px] ${
                  t ? (up ? 'text-[#0ecb81]' : 'text-[#f6465d]') : 'text-[#5e6673]'
                }`}
              >
                {t
                  ? `${up ? '+' : ''}${fmt(t.priceChangePercent, 2)}%`
                  : '—'}
              </span>
              <button
                type="button"
                className="w-5 text-[#5e6673] hover:text-[#f6465d] text-xs"
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(sym)
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div className="shrink-0 px-2 py-1 text-[9px] text-[#5e6673] border-t border-[#1e2329]">
        Poll {POLL_MS / 1000}s · {exchange} · click row → chart
      </div>
    </div>
  )
}
