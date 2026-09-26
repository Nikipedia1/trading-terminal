/**
 * IndexedDB archive for aggressor trades – survives beyond ring buffer.
 * Used for historical orderflow replay. Real ticks only.
 */

import type { AggressorTrade } from '@/data/shared'
import type { ExchangeId } from '@/types'
import { feedKey } from '@/data/shared'

const DB_NAME = 'tt-trade-archive'
const DB_VERSION = 1
const STORE = 'trades'

/** Soft cap per key to avoid unbounded growth (~hours of dense BTC) */
const MAX_PER_KEY = 80_000

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'pk' })
        os.createIndex('byFeedTime', ['feed', 'time'], { unique: false })
        os.createIndex('byFeed', 'feed', { unique: false })
      }
    }
  })
}

interface StoredTrade extends AggressorTrade {
  pk: string
  feed: string
}

function toStored(feed: string, t: AggressorTrade): StoredTrade {
  return {
    ...t,
    pk: `${feed}|${t.id}|${t.time}`,
    feed,
  }
}

export async function archiveTrades(
  exchange: ExchangeId,
  symbol: string,
  trades: AggressorTrade[]
): Promise<void> {
  if (trades.length === 0) return
  try {
    const db = await openDb()
    const feed = feedKey(exchange, symbol)
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const os = tx.objectStore(STORE)
      for (const t of trades) {
        os.put(toStored(feed, t))
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    // Opportunistic trim
    void trimFeed(exchange, symbol)
  } catch {
    /* silent – archive is best-effort */
  }
}

export async function queryArchivedTrades(
  exchange: ExchangeId,
  symbol: string,
  startMs: number,
  endMs: number
): Promise<AggressorTrade[]> {
  try {
    const db = await openDb()
    const feed = feedKey(exchange, symbol)
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const idx = tx.objectStore(STORE).index('byFeedTime')
      const range = IDBKeyRange.bound([feed, startMs], [feed, endMs], false, true)
      const req = idx.getAll(range)
      req.onsuccess = () => {
        const rows = (req.result as StoredTrade[]) || []
        resolve(
          rows.map(({ pk: _pk, feed: _f, ...rest }) => rest as AggressorTrade)
        )
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

async function trimFeed(exchange: ExchangeId, symbol: string) {
  try {
    const db = await openDb()
    const feed = feedKey(exchange, symbol)
    const all = await new Promise<StoredTrade[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const idx = tx.objectStore(STORE).index('byFeed')
      const req = idx.getAll(feed)
      req.onsuccess = () => resolve((req.result as StoredTrade[]) || [])
      req.onerror = () => reject(req.error)
    })
    if (all.length <= MAX_PER_KEY) return
    all.sort((a, b) => a.time - b.time)
    const drop = all.slice(0, all.length - MAX_PER_KEY)
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const os = tx.objectStore(STORE)
      for (const r of drop) os.delete(r.pk)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* ignore */
  }
}

export async function archiveStats(
  exchange: ExchangeId,
  symbol: string
): Promise<{ count: number; oldestMs: number | null; newestMs: number | null }> {
  try {
    const db = await openDb()
    const feed = feedKey(exchange, symbol)
    const all = await new Promise<StoredTrade[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const idx = tx.objectStore(STORE).index('byFeed')
      const req = idx.getAll(IDBKeyRange.only(feed))
      req.onsuccess = () => resolve((req.result as StoredTrade[]) || [])
      req.onerror = () => reject(req.error)
    })
    if (all.length === 0) return { count: 0, oldestMs: null, newestMs: null }
    let oldest = all[0].time
    let newest = all[0].time
    for (const r of all) {
      if (r.time < oldest) oldest = r.time
      if (r.time > newest) newest = r.time
    }
    return { count: all.length, oldestMs: oldest, newestMs: newest }
  } catch {
    return { count: 0, oldestMs: null, newestMs: null }
  }
}
