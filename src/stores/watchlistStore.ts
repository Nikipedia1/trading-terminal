/**
 * Shared watchlist – used by Watchlist panel and Bloomberg terminal.
 * Persisted in localStorage. Real tickers fetched on demand / poll.
 */

import { create } from 'zustand'

const WL_KEY = 'tt-watchlist:v1'
export const MAX_WATCHLIST = 30

const DEFAULT = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT']

function load(): string[] {
  try {
    const raw = localStorage.getItem(WL_KEY)
    if (!raw) return [...DEFAULT]
    const arr = JSON.parse(raw) as string[]
    if (!Array.isArray(arr)) return [...DEFAULT]
    return arr
      .map((s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, ''))
      .filter(Boolean)
      .slice(0, MAX_WATCHLIST)
  } catch {
    return [...DEFAULT]
  }
}

function persist(symbols: string[]) {
  localStorage.setItem(WL_KEY, JSON.stringify(symbols.slice(0, MAX_WATCHLIST)))
}

interface WatchlistState {
  symbols: string[]
  add: (symbol: string) => { ok: boolean; error?: string }
  addMany: (symbols: string[]) => void
  remove: (symbol: string) => void
  clear: () => void
  move: (from: number, to: number) => void
  swap: (a: string, b: string) => boolean
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  symbols: typeof window !== 'undefined' ? load() : [...DEFAULT],

  add: (raw) => {
    const symbol = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!symbol) return { ok: false, error: 'invalid symbol' }
    const { symbols } = get()
    if (symbols.includes(symbol)) return { ok: false, error: 'already in list' }
    if (symbols.length >= MAX_WATCHLIST) return { ok: false, error: `max ${MAX_WATCHLIST}` }
    const next = [...symbols, symbol]
    persist(next)
    set({ symbols: next })
    return { ok: true }
  },

  addMany: (raws) => {
    let next = [...get().symbols]
    for (const raw of raws) {
      const symbol = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (!symbol || next.includes(symbol)) continue
      if (next.length >= MAX_WATCHLIST) break
      next.push(symbol)
    }
    persist(next)
    set({ symbols: next })
  },

  remove: (raw) => {
    const symbol = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const next = get().symbols.filter((s) => s !== symbol)
    persist(next)
    set({ symbols: next })
  },

  clear: () => {
    persist([])
    set({ symbols: [] })
  },

  move: (from, to) => {
    const next = [...get().symbols]
    if (from < 0 || from >= next.length || to < 0 || to >= next.length) return
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    persist(next)
    set({ symbols: next })
  },

  swap: (a, b) => {
    const sa = a.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const sb = b.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const next = [...get().symbols]
    const ia = next.indexOf(sa)
    const ib = next.indexOf(sb)
    if (ia < 0 || ib < 0) return false
    ;[next[ia], next[ib]] = [next[ib], next[ia]]
    persist(next)
    set({ symbols: next })
    return true
  },
}))
