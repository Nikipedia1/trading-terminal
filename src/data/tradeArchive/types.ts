/** Local tick archive types – real trades only, no cloud required. */

import type { AggressorTrade } from '@/data/shared'

export interface StoredTrade extends AggressorTrade {
  /** Primary key: feed|id|time */
  pk: string
  feed: string
}

export interface ArchiveFeedMeta {
  feed: string
  count: number
  oldestMs: number | null
  newestMs: number | null
  updatedAt: number
}

export interface ArchiveStats {
  count: number
  oldestMs: number | null
  newestMs: number | null
}

export interface StorageEstimate {
  usage: number
  quota: number
  /** 0–1 */
  ratio: number
}

/** Wire format for export/import (gzip JSON) */
export interface ArchiveExportDoc {
  version: 1
  exportedAt: number
  feed: string
  exchange: string
  symbol: string
  trades: AggressorTrade[]
}

/** Soft defaults – keep browser storage healthy */
export const ARCHIVE_LIMITS = {
  /** Max trades retained per feed after prune */
  maxPerFeed: 120_000,
  /** Prefer drop older than this (ms) when over soft cap */
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  /** When estimated usage exceeds this fraction of quota, prune aggressively */
  quotaSoftRatio: 0.8,
  /** Batch size for IDB put */
  writeBatch: 400,
} as const
