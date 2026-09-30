import { userStorage } from '@/lib/userScopedStorage'
/**
 * Session journal – notes + PnL tags linked to chart time.
 * Optional screenshot as dataURL (local only).
 */

import { create } from 'zustand'

export interface JournalEntry {
  id: string
  ts: number
  chartTimeSec: number | null
  symbol: string
  note: string
  pnlTag: number | null
  screenshot?: string
}

const KEY = 'tt-journal:v1'
const MAX = 200

function load(): JournalEntry[] {
  try {
    const raw = userStorage.getItem(KEY)
    if (!raw) return []
    const a = JSON.parse(raw)
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

function save(entries: JournalEntry[]) {
  try {
    userStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)))
  } catch {
    try {
      const slim = entries.map((e) => ({ ...e, screenshot: undefined })).slice(0, MAX)
      userStorage.setItem(KEY, JSON.stringify(slim))
    } catch {
      /* */
    }
  }
}

interface JournalState {
  entries: JournalEntry[]
  add: (e: Omit<JournalEntry, 'id' | 'ts'>) => void
  remove: (id: string) => void
  clear: () => void
  exportJson: () => string
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: load(),

  add: (e) => {
    const entry: JournalEntry = {
      id: `j-${Date.now().toString(36)}`,
      ts: Date.now(),
      ...e,
    }
    const entries = [entry, ...get().entries].slice(0, MAX)
    save(entries)
    set({ entries })
  },

  remove: (id) => {
    const entries = get().entries.filter((x) => x.id !== id)
    save(entries)
    set({ entries })
  },

  clear: () => {
    save([])
    set({ entries: [] })
  },

  exportJson: () => JSON.stringify(get().entries, null, 2),
}))
