/**
 * Spot-style wallet holdings – user balances, persisted locally.
 * Prices come from live Binance public ticker (no mocks).
 * Default: empty portfolio, cash 0 – user adds assets manually.
 */

import { create } from 'zustand'

export interface WalletHolding {
  /** Base asset e.g. BTC */
  asset: string
  qty: number
  /** Optional note */
  note?: string
  updatedAt: number
}

interface WalletState {
  holdings: WalletHolding[]
  /** Extra cash in USDT not in paper account (optional) */
  cashUsdt: number
  addOrUpdate: (asset: string, qty: number, note?: string) => void
  remove: (asset: string) => void
  setCashUsdt: (v: number) => void
  reset: () => void
}

const STORAGE_KEY = 'tt-wallet:v1'

function load(): { holdings: WalletHolding[]; cashUsdt: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        holdings: [],
        cashUsdt: 0,
      }
    }
    const p = JSON.parse(raw)
    return {
      holdings: Array.isArray(p.holdings) ? p.holdings : [],
      cashUsdt: typeof p.cashUsdt === 'number' ? p.cashUsdt : 0,
    }
  } catch {
    return { holdings: [], cashUsdt: 0 }
  }
}

function persist(holdings: WalletHolding[], cashUsdt: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ holdings, cashUsdt }))
  } catch {
    /* quota */
  }
}

const initial = load()

export const useWalletStore = create<WalletState>((set, get) => ({
  holdings: initial.holdings,
  cashUsdt: initial.cashUsdt,

  addOrUpdate: (asset, qty, note) => {
    const a = asset.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!a) return
    const q = Number(qty)
    if (!Number.isFinite(q) || q < 0) return
    set((s) => {
      const rest = s.holdings.filter((h) => h.asset !== a)
      const holdings =
        q === 0
          ? rest
          : [...rest, { asset: a, qty: q, note, updatedAt: Date.now() }].sort((x, y) =>
              x.asset.localeCompare(y.asset)
            )
      persist(holdings, s.cashUsdt)
      return { holdings }
    })
  },

  remove: (asset) => {
    const a = asset.toUpperCase()
    set((s) => {
      const holdings = s.holdings.filter((h) => h.asset !== a)
      persist(holdings, s.cashUsdt)
      return { holdings }
    })
  },

  setCashUsdt: (v) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) return
    set((s) => {
      persist(s.holdings, n)
      return { cashUsdt: n }
    })
  },

  reset: () => {
    persist([], 0)
    set({ holdings: [], cashUsdt: 0 })
  },
}))
