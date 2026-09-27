/**
 * IndexedDB tick archive – survives beyond in-memory ring buffer.
 * Real ticks only. Best-effort: never blocks live trading path.
 */

import type { AggressorTrade } from '@/data/shared'
import type { ExchangeId } from '@/types'
import { feedKey } from '@/data/shared'
import {
  ARCHIVE_LIMITS,
  type ArchiveFeedMeta,
  type ArchiveStats,
  type StoredTrade,
  type StorageEstimate,
} from './types'

const DB_NAME = 'tt-trade-archive'
const DB_VERSION = 2
const STORE = 'trades'
const META = 'meta'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (ev) => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'pk' })
        os.createIndex('byFeedTime', ['feed', 'time'], { unique: false })
        os.createIndex('byFeed', 'feed', { unique: false })
        os.createIndex('byTime', 'time', { unique: false })
      } else if (ev.oldVersion < 2) {
        const tx = (ev.target as IDBOpenDBRequest).transaction
        const os = tx?.objectStore(STORE)
        if (os && !os.indexNames.contains('byTime')) {
          os.createIndex('byTime', 'time', { unique: false })
        }
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: 'feed' })
      }
    }
  })
}

function toStored(feed: string, t: AggressorTrade): StoredTrade {
  return {
    ...t,
    pk: `${feed}|${t.id}|${t.time}`,
    feed,
  }
}

async function withStore<T>(
  mode: IDBTransactionMode,
  storeName: string,
  fn: (os: IDBObjectStore, tx: IDBTransaction) => void
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const os = tx.objectStore(storeName)
    let result: T
    try {
      fn(os, tx)
    } catch (e) {
      reject(e)
      return
    }
    tx.oncomplete = () => resolve(result!)
    tx.onerror = () => reject(tx.error)
    // allow fn to assign via closure on req.onsuccess for reads
    ;(tx as unknown as { __set: (v: T) => void }).__set = (v: T) => {
      result = v
    }
  })
}

function txResult<T>(tx: IDBTransaction, value: T) {
  ;(tx as unknown as { __set: (v: T) => void }).__set?.(value)
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
    const batch = ARCHIVE_LIMITS.writeBatch

    for (let i = 0; i < trades.length; i += batch) {
      const slice = trades.slice(i, i + batch)
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        const os = tx.objectStore(STORE)
        for (const t of slice) os.put(toStored(feed, t))
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    }

    void refreshMeta(feed).then(() => maybePrune(feed))
  } catch {
    /* silent – archive is best-effort, never block trading */
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

/** All trades for a feed (export). Cap to avoid OOM on huge archives. */
export async function loadAllForFeed(
  exchange: ExchangeId,
  symbol: string,
  max = ARCHIVE_LIMITS.maxPerFeed
): Promise<AggressorTrade[]> {
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
    all.sort((a, b) => a.time - b.time)
    const slice = all.length > max ? all.slice(all.length - max) : all
    return slice.map(({ pk: _pk, feed: _f, ...rest }) => rest as AggressorTrade)
  } catch {
    return []
  }
}

/** Bulk import (dedupe by pk). */
export async function importTrades(
  exchange: ExchangeId,
  symbol: string,
  trades: AggressorTrade[]
): Promise<number> {
  if (trades.length === 0) return 0
  const feed = feedKey(exchange, symbol)
  try {
    const db = await openDb()
    const batch = ARCHIVE_LIMITS.writeBatch
    let written = 0
    for (let i = 0; i < trades.length; i += batch) {
      const slice = trades.slice(i, i + batch)
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        const os = tx.objectStore(STORE)
        for (const t of slice) {
          os.put(toStored(feed, t))
          written += 1
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    }
    await refreshMeta(feed)
    await maybePrune(feed)
    return written
  } catch {
    return 0
  }
}

async function refreshMeta(feed: string): Promise<ArchiveFeedMeta> {
  const db = await openDb()
  const rows = await new Promise<StoredTrade[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const idx = tx.objectStore(STORE).index('byFeed')
    const req = idx.getAll(feed)
    req.onsuccess = () => resolve((req.result as StoredTrade[]) || [])
    req.onerror = () => reject(req.error)
  })
  let oldest: number | null = null
  let newest: number | null = null
  for (const r of rows) {
    if (oldest == null || r.time < oldest) oldest = r.time
    if (newest == null || r.time > newest) newest = r.time
  }
  const meta: ArchiveFeedMeta = {
    feed,
    count: rows.length,
    oldestMs: oldest,
    newestMs: newest,
    updatedAt: Date.now(),
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META, 'readwrite')
    tx.objectStore(META).put(meta)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  return meta
}

export async function archiveStats(
  exchange: ExchangeId,
  symbol: string
): Promise<ArchiveStats> {
  try {
    const feed = feedKey(exchange, symbol)
    const db = await openDb()
    const meta = await new Promise<ArchiveFeedMeta | undefined>((resolve, reject) => {
      const tx = db.transaction(META, 'readonly')
      const req = tx.objectStore(META).get(feed)
      req.onsuccess = () => resolve(req.result as ArchiveFeedMeta | undefined)
      req.onerror = () => reject(req.error)
    })
    if (meta && Date.now() - meta.updatedAt < 15_000) {
      return {
        count: meta.count,
        oldestMs: meta.oldestMs,
        newestMs: meta.newestMs,
      }
    }
    const m = await refreshMeta(feed)
    return { count: m.count, oldestMs: m.oldestMs, newestMs: m.newestMs }
  } catch {
    return { count: 0, oldestMs: null, newestMs: null }
  }
}

export async function estimateStorage(): Promise<StorageEstimate> {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate()
      const usage = e.usage ?? 0
      const quota = e.quota ?? 1
      return { usage, quota, ratio: quota > 0 ? usage / quota : 0 }
    }
  } catch {
    /* ignore */
  }
  return { usage: 0, quota: 0, ratio: 0 }
}

/**
 * Drop oldest trades for feed until under maxPerFeed and maxAgeMs.
 * If quota soft limit hit, also drop extra 20%.
 */
export async function maybePrune(feed?: string): Promise<number> {
  try {
    const db = await openDb()
    const est = await estimateStorage()
    const aggressive = est.ratio >= ARCHIVE_LIMITS.quotaSoftRatio
    const maxKeep = aggressive
      ? Math.floor(ARCHIVE_LIMITS.maxPerFeed * 0.8)
      : ARCHIVE_LIMITS.maxPerFeed
    const minTime = Date.now() - ARCHIVE_LIMITS.maxAgeMs

    const feeds: string[] = feed
      ? [feed]
      : await new Promise((resolve, reject) => {
          const tx = db.transaction(META, 'readonly')
          const req = tx.objectStore(META).getAllKeys()
          req.onsuccess = () => resolve((req.result as string[]) || [])
          req.onerror = () => reject(req.error)
        })

    let deleted = 0
    for (const f of feeds) {
      const all = await new Promise<StoredTrade[]>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const idx = tx.objectStore(STORE).index('byFeed')
        const req = idx.getAll(f)
        req.onsuccess = () => resolve((req.result as StoredTrade[]) || [])
        req.onerror = () => reject(req.error)
      })
      if (all.length === 0) continue
      all.sort((a, b) => a.time - b.time)

      const drop: StoredTrade[] = []
      for (const r of all) {
        if (r.time < minTime) drop.push(r)
      }
      const remaining = all.length - drop.length
      if (remaining > maxKeep) {
        const need = remaining - maxKeep
        const survivors = all.filter((r) => r.time >= minTime)
        drop.push(...survivors.slice(0, need))
      }

      if (drop.length === 0) continue

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        const os = tx.objectStore(STORE)
        for (const r of drop) os.delete(r.pk)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      deleted += drop.length
      await refreshMeta(f)
    }
    return deleted
  } catch {
    return 0
  }
}

export async function clearFeed(
  exchange: ExchangeId,
  symbol: string
): Promise<void> {
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
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, META], 'readwrite')
      const os = tx.objectStore(STORE)
      for (const r of all) os.delete(r.pk)
      tx.objectStore(META).delete(feed)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* ignore */
  }
}

// silence unused helper lint if tree-shaken differently
void withStore
void txResult
