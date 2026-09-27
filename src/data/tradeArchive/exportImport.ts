/**
 * Local export / import of tick archive as .json.gz
 * Zero cloud cost – file stays on the user's disk.
 */

import type { AggressorTrade } from '@/data/shared'
import type { ExchangeId } from '@/types'
import { feedKey } from '@/data/shared'
import { loadAllForFeed, importTrades } from './idb'
import type { ArchiveExportDoc } from './types'

async function gzipBlob(data: Uint8Array | string): Promise<Blob> {
  const stream =
    typeof data === 'string'
      ? new Blob([data]).stream()
      : new Blob([data]).stream()

  if (typeof CompressionStream !== 'undefined') {
    const compressed = stream.pipeThrough(new CompressionStream('gzip'))
    return new Response(compressed).blob()
  }
  // Fallback uncompressed JSON (still downloadable)
  return new Blob([typeof data === 'string' ? data : data], {
    type: 'application/json',
  })
}

async function gunzipToText(file: Blob): Promise<string> {
  const name = file.name?.toLowerCase() ?? ''
  const isGz = name.endsWith('.gz') || file.type === 'application/gzip'
  if (isGz && typeof DecompressionStream !== 'undefined') {
    const ds = file.stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(ds).text()
  }
  return file.text()
}

/** Build export document and trigger browser download (.json.gz). */
export async function exportArchiveFile(
  exchange: ExchangeId,
  symbol: string
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const trades = await loadAllForFeed(exchange, symbol)
    if (trades.length === 0) {
      return { ok: false, count: 0, error: 'No archived ticks for this symbol' }
    }
    const doc: ArchiveExportDoc = {
      version: 1,
      exportedAt: Date.now(),
      feed: feedKey(exchange, symbol),
      exchange,
      symbol,
      trades,
    }
    const json = JSON.stringify(doc)
    const blob = await gzipBlob(json)
    const ext =
      typeof CompressionStream !== 'undefined' ? 'json.gz' : 'json'
    const filename = `ticks-${exchange}-${symbol}-${new Date()
      .toISOString()
      .slice(0, 10)}.${ext}`

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return { ok: true, count: trades.length }
  } catch (e) {
    return {
      ok: false,
      count: 0,
      error: e instanceof Error ? e.message : 'Export failed',
    }
  }
}

/** Import from user-selected .json / .json.gz file. */
export async function importArchiveFile(
  file: File,
  exchange: ExchangeId,
  symbol: string
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const text = await gunzipToText(file)
    const parsed = JSON.parse(text) as ArchiveExportDoc | AggressorTrade[]

    let trades: AggressorTrade[]
    if (Array.isArray(parsed)) {
      trades = parsed
    } else if (parsed && Array.isArray(parsed.trades)) {
      trades = parsed.trades
    } else {
      return { ok: false, count: 0, error: 'Unrecognized archive format' }
    }

    // Light validation – real fields only
    trades = trades.filter(
      (t) =>
        t &&
        typeof t.time === 'number' &&
        typeof t.price === 'number' &&
        typeof t.qty === 'number' &&
        (t.aggressor === 'buy' || t.aggressor === 'sell')
    )

    const n = await importTrades(exchange, symbol, trades)
    return { ok: n > 0, count: n }
  } catch (e) {
    return {
      ok: false,
      count: 0,
      error: e instanceof Error ? e.message : 'Import failed',
    }
  }
}
