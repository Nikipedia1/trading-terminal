/**
 * Local tick archive controls – export/import .json.gz, stats, prune.
 * Zero cloud cost; optional file backup only.
 */

import { useEffect, useRef, useState } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import {
  archiveStats,
  estimateStorage,
  exportArchiveFile,
  importArchiveFile,
  maybePrune,
  clearFeed,
  ARCHIVE_LIMITS,
} from '@/data/tradeArchive'

function fmtBytes(n: number): string {
  if (n <= 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function ArchiveMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const panels = useLayoutStore((s) => s.panels)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const exchange = primary?.exchange ?? 'binance'
  const symbol = primary?.symbol ?? 'BTCUSDT'

  const [count, setCount] = useState(0)
  const [oldest, setOldest] = useState<number | null>(null)
  const [newest, setNewest] = useState<number | null>(null)
  const [usage, setUsage] = useState(0)
  const [quota, setQuota] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const refresh = async () => {
    const s = await archiveStats(exchange, symbol)
    setCount(s.count)
    setOldest(s.oldestMs)
    setNewest(s.newestMs)
    const e = await estimateStorage()
    setUsage(e.usage)
    setQuota(e.quota)
  }

  useEffect(() => {
    if (!open) return
    void refresh()
    const id = window.setInterval(() => void refresh(), 4000)
    return () => window.clearInterval(id)
  }, [open, exchange, symbol])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const onExport = async () => {
    setBusy(true)
    setMsg('')
    const r = await exportArchiveFile(exchange, symbol)
    setBusy(false)
    setMsg(
      r.ok
        ? `Exported ${r.count.toLocaleString()} ticks → .json.gz`
        : r.error || 'Export failed'
    )
  }

  const onImport = async (file: File) => {
    setBusy(true)
    setMsg('')
    const r = await importArchiveFile(file, exchange, symbol)
    setBusy(false)
    setMsg(
      r.ok
        ? `Imported ${r.count.toLocaleString()} ticks`
        : r.error || 'Import failed'
    )
    void refresh()
  }

  const onPrune = async () => {
    setBusy(true)
    const n = await maybePrune()
    setBusy(false)
    setMsg(n > 0 ? `Pruned ${n.toLocaleString()} old ticks` : 'Nothing to prune')
    void refresh()
  }

  const onClear = async () => {
    if (!confirm(`Clear local archive for ${exchange} ${symbol}?`)) return
    setBusy(true)
    await clearFeed(exchange, symbol)
    setBusy(false)
    setMsg('Feed cleared')
    void refresh()
  }

  const ratio = quota > 0 ? usage / quota : 0

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`px-2 py-0.5 text-xxs rounded border ${
          open
            ? 'bg-[#1e2329] text-[#f0b90b] border-[#f0b90b]/50'
            : 'text-terminal-muted border-terminal-border hover:text-terminal-text'
        }`}
        onClick={() => setOpen((v) => !v)}
        title="Local tick archive (IndexedDB)"
      >
        Archive
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[300px] bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-3 text-[11px]">
          <div className="text-[#eaecef] font-semibold mb-1">
            Local tick archive
          </div>
          <div className="text-[#848e9c] mb-2 leading-snug">
            {exchange} · {symbol}
            <br />
            {count.toLocaleString()} ticks
            {oldest != null && newest != null
              ? ` · ${new Date(oldest).toLocaleString()} → ${new Date(newest).toLocaleString()}`
              : ' · empty'}
          </div>

          <div className="mb-2 text-[#848e9c]">
            Storage {fmtBytes(usage)}
            {quota > 0 ? ` / ${fmtBytes(quota)} (${(ratio * 100).toFixed(0)}%)` : ''}
            <div className="mt-1 h-1 rounded bg-[#2b3139] overflow-hidden">
              <div
                className={`h-full ${
                  ratio > 0.8 ? 'bg-[#f6465d]' : 'bg-[#0ecb81]'
                }`}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-[#5e6673] mt-1">
              Cap {ARCHIVE_LIMITS.maxPerFeed.toLocaleString()}/feed · max age 7d ·
              prune at 80% quota. No cloud.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy || count === 0}
              className="px-2 py-1 rounded border border-[#2b3139] text-[#eaecef] hover:bg-[#1e2329] disabled:opacity-40"
              onClick={() => void onExport()}
            >
              Export .json.gz
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-2 py-1 rounded border border-[#2b3139] text-[#eaecef] hover:bg-[#1e2329] disabled:opacity-40"
              onClick={() => fileRef.current?.click()}
            >
              Import
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-2 py-1 rounded border border-[#2b3139] text-[#848e9c] hover:bg-[#1e2329] disabled:opacity-40"
              onClick={() => void onPrune()}
            >
              Prune
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-2 py-1 rounded border border-[#2b3139] text-[#f6465d]/90 hover:bg-[#1e2329] disabled:opacity-40"
              onClick={() => void onClear()}
            >
              Clear
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json,.json.gz,application/gzip,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />

          {msg && (
            <p className="mt-2 text-[10px] text-[#f0b90b] leading-snug">{msg}</p>
          )}
        </div>
      )}
    </div>
  )
}
