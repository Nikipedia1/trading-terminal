/**
 * Multi-account wallet – named accounts, holdings + cash, localStorage.
 * Default: one empty "Main" account. No demo balances.
 */

import { create } from 'zustand'

export interface WalletHolding {
  asset: string
  qty: number
  note?: string
  updatedAt: number
}

export interface WalletAccount {
  id: string
  name: string
  holdings: WalletHolding[]
  cashUsdt: number
  createdAt: number
}

interface WalletState {
  accounts: WalletAccount[]
  activeId: string
  /** Derived from active account */
  holdings: WalletHolding[]
  cashUsdt: number

  setActive: (id: string) => void
  createAccount: (name: string) => string | null
  renameAccount: (id: string, name: string) => void
  deleteAccount: (id: string) => void
  addOrUpdate: (asset: string, qty: number, note?: string) => void
  remove: (asset: string) => void
  setCashUsdt: (v: number) => void
  /** Clear holdings + cash of active account only */
  resetActive: () => void
  /** Clear all accounts → single empty Main */
  resetAll: () => void
}

const STORAGE_KEY = 'tt-wallet:v2'
const LEGACY_KEY = 'tt-wallet:v1'

function uid() {
  return `wa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function emptyAccount(name = 'Main'): WalletAccount {
  return {
    id: uid(),
    name,
    holdings: [],
    cashUsdt: 0,
    createdAt: Date.now(),
  }
}

function derive(accounts: WalletAccount[], activeId: string) {
  const a = accounts.find((x) => x.id === activeId) ?? accounts[0]
  return {
    accounts,
    activeId: a?.id ?? activeId,
    holdings: a?.holdings ?? [],
    cashUsdt: a?.cashUsdt ?? 0,
  }
}

function persist(accounts: WalletAccount[], activeId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts, activeId }))
  } catch {
    /* quota */
  }
}

function migrateLegacy(): { accounts: WalletAccount[]; activeId: string } | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    const main = emptyAccount('Main')
    main.holdings = Array.isArray(p.holdings) ? p.holdings : []
    main.cashUsdt = typeof p.cashUsdt === 'number' ? p.cashUsdt : 0
    localStorage.removeItem(LEGACY_KEY)
    return { accounts: [main], activeId: main.id }
  } catch {
    return null
  }
}

function load(): { accounts: WalletAccount[]; activeId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const migrated = migrateLegacy()
      if (migrated) {
        persist(migrated.accounts, migrated.activeId)
        return migrated
      }
      const main = emptyAccount('Main')
      return { accounts: [main], activeId: main.id }
    }
    const p = JSON.parse(raw)
    const accounts: WalletAccount[] = Array.isArray(p.accounts) ? p.accounts : []
    if (!accounts.length) {
      const main = emptyAccount('Main')
      return { accounts: [main], activeId: main.id }
    }
    const activeId =
      typeof p.activeId === 'string' && accounts.some((a) => a.id === p.activeId)
        ? p.activeId
        : accounts[0].id
    return { accounts, activeId }
  } catch {
    const main = emptyAccount('Main')
    return { accounts: [main], activeId: main.id }
  }
}

const initial = load()
const derived = derive(initial.accounts, initial.activeId)

export const useWalletStore = create<WalletState>((set, get) => ({
  accounts: derived.accounts,
  activeId: derived.activeId,
  holdings: derived.holdings,
  cashUsdt: derived.cashUsdt,

  setActive: (id) => {
    const { accounts } = get()
    if (!accounts.some((a) => a.id === id)) return
    const next = derive(accounts, id)
    persist(next.accounts, next.activeId)
    set(next)
  },

  createAccount: (name) => {
    const n = name.trim().slice(0, 32) || `Wallet ${get().accounts.length + 1}`
    if (get().accounts.length >= 12) return null
    const acc = emptyAccount(n)
    const accounts = [...get().accounts, acc]
    const next = derive(accounts, acc.id)
    persist(next.accounts, next.activeId)
    set(next)
    return acc.id
  },

  renameAccount: (id, name) => {
    const n = name.trim().slice(0, 32)
    if (!n) return
    const accounts = get().accounts.map((a) => (a.id === id ? { ...a, name: n } : a))
    const next = derive(accounts, get().activeId)
    persist(next.accounts, next.activeId)
    set(next)
  },

  deleteAccount: (id) => {
    let accounts = get().accounts.filter((a) => a.id !== id)
    if (!accounts.length) accounts = [emptyAccount('Main')]
    const activeId =
      get().activeId === id ? accounts[0].id : get().activeId
    const next = derive(accounts, activeId)
    persist(next.accounts, next.activeId)
    set(next)
  },

  addOrUpdate: (asset, qty, note) => {
    const a = asset.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!a) return
    const q = Number(qty)
    if (!Number.isFinite(q) || q < 0) return
    const { accounts, activeId } = get()
    const accounts2 = accounts.map((acc) => {
      if (acc.id !== activeId) return acc
      const rest = acc.holdings.filter((h) => h.asset !== a)
      const holdings =
        q === 0
          ? rest
          : [...rest, { asset: a, qty: q, note, updatedAt: Date.now() }].sort((x, y) =>
              x.asset.localeCompare(y.asset)
            )
      return { ...acc, holdings }
    })
    const next = derive(accounts2, activeId)
    persist(next.accounts, next.activeId)
    set(next)
  },

  remove: (asset) => {
    const a = asset.toUpperCase()
    const { accounts, activeId } = get()
    const accounts2 = accounts.map((acc) =>
      acc.id !== activeId
        ? acc
        : { ...acc, holdings: acc.holdings.filter((h) => h.asset !== a) }
    )
    const next = derive(accounts2, activeId)
    persist(next.accounts, next.activeId)
    set(next)
  },

  setCashUsdt: (v) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) return
    const { accounts, activeId } = get()
    const accounts2 = accounts.map((acc) =>
      acc.id === activeId ? { ...acc, cashUsdt: n } : acc
    )
    const next = derive(accounts2, activeId)
    persist(next.accounts, next.activeId)
    set(next)
  },

  resetActive: () => {
    const { accounts, activeId } = get()
    const accounts2 = accounts.map((acc) =>
      acc.id === activeId ? { ...acc, holdings: [], cashUsdt: 0 } : acc
    )
    const next = derive(accounts2, activeId)
    persist(next.accounts, next.activeId)
    set(next)
  },

  resetAll: () => {
    const main = emptyAccount('Main')
    const next = derive([main], main.id)
    persist(next.accounts, next.activeId)
    set(next)
  },
}))
