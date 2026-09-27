import { useEffect, useRef, useState } from 'react'
import {
  saveWorkspace,
  loadWorkspace,
  exportWorkspaceFile,
  importWorkspaceFile,
  cloudEnabled,
} from './api'
import { buildSnapshot, applyWorkspace } from './snapshot'
import {
  getOrCreateWorkspaceId,
  getWorkspaceName,
  setWorkspaceName,
  setWorkspaceId,
  generateWorkspaceId,
} from './id'
import type { WorkspaceDocument } from './types'

export function WorkspaceMenu() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(getWorkspaceName())
  const [id, setId] = useState(getOrCreateWorkspaceId())
  const fileRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const flash = (msg: string) => {
    setStatus(msg)
    window.setTimeout(() => setStatus(''), 4500)
  }

  const onSave = async () => {
    setBusy(true)
    setWorkspaceName(name)
    const snap = buildSnapshot(name)
    const res = await saveWorkspace({ ...snap, id, name })
    setBusy(false)
    if (res.ok) {
      flash(
        `Saved → ${res.source} · layout+orderflow+drawings · ${new Date(res.updatedAt).toLocaleTimeString()}`
      )
    } else {
      flash(`Save failed: ${res.error}`)
    }
  }

  const onLoad = async () => {
    setBusy(true)
    const res = await loadWorkspace(id)
    setBusy(false)
    if (!res.ok) {
      flash(`Load failed: ${res.error}`)
      return
    }
    applyWorkspace(res.doc)
    setName(res.doc.name || name)
    setWorkspaceName(res.doc.name || name)
    flash(`Loaded ← ${res.source} · ${res.doc.name}`)
  }

  const onExport = async () => {
    const snap = buildSnapshot(name)
    const res = await saveWorkspace({ ...snap, id, name })
    if (res.ok) {
      const doc: WorkspaceDocument = {
        version: 1,
        id: res.id,
        name,
        updatedAt: res.updatedAt,
        layout: snap.layout,
        indicators: snap.indicators,
        chartStyle: snap.chartStyle,
        orderflow: snap.orderflow,
        drawings: snap.drawings,
      }
      exportWorkspaceFile(doc)
      flash('Exported JSON (full workspace)')
    }
  }

  const onImportFile = async (file: File) => {
    setBusy(true)
    const res = await importWorkspaceFile(file)
    setBusy(false)
    if (!res.ok) {
      flash(`Import failed: ${res.error}`)
      return
    }
    applyWorkspace(res.doc)
    setId(res.doc.id)
    setName(res.doc.name)
    flash(`Imported · ${res.doc.name}`)
  }

  const onNewId = () => {
    const nid = generateWorkspaceId()
    setWorkspaceId(nid)
    setId(nid)
    flash('New workspace id – Save to create cloud slot')
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className={`px-2.5 py-0.5 text-xs rounded border font-semibold whitespace-nowrap ${
          open
            ? 'bg-[#1e2329] text-[#f0b90b] border-[#f0b90b]/50'
            : 'text-[#eaecef] border-[#2b3139] hover:bg-[#1e2329]'
        }`}
        onClick={() => setOpen((v) => !v)}
        title="Save / load workspace (layout, orderflow, drawings)"
      >
        Workspace {open ? '▴' : '▾'}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-[320px] bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-2xl p-3 space-y-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-[#5e6673] uppercase tracking-wider">
            Workspace · {cloudEnabled() ? 'local + cloud' : 'local only'}
          </div>

          <label className="block text-[11px] text-[#848e9c]">
            Name
            <input
              className="mt-0.5 w-full bg-[#12161c] border border-[#2b3139] rounded px-2 py-1 text-[12px] text-[#eaecef]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
            />
          </label>

          <label className="block text-[11px] text-[#848e9c]">
            Id (token segreto)
            <input
              className="mt-0.5 w-full bg-[#12161c] border border-[#2b3139] rounded px-2 py-1 text-[11px] font-mono text-[#eaecef]"
              value={id}
              onChange={(e) => {
                const v = e.target.value.trim()
                setId(v)
                if (/^[a-zA-Z0-9_-]{8,64}$/.test(v)) setWorkspaceId(v)
              }}
              spellCheck={false}
            />
          </label>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className="px-2 py-1 text-[11px] rounded bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40 hover:bg-[#0ecb81]/30 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onLoad}
              className="px-2 py-1 text-[11px] rounded bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/40 hover:bg-[#3b82f6]/30 disabled:opacity-50"
            >
              Load
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onExport}
              className="px-2 py-1 text-[11px] rounded bg-[#1e2329] text-[#eaecef] border border-[#2b3139] hover:border-[#848e9c] disabled:opacity-50"
            >
              Export
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="px-2 py-1 text-[11px] rounded bg-[#1e2329] text-[#eaecef] border border-[#2b3139] hover:border-[#848e9c] disabled:opacity-50"
            >
              Import
            </button>
            <button
              type="button"
              onClick={onNewId}
              className="px-2 py-1 text-[11px] rounded bg-[#1e2329] text-[#848e9c] border border-[#2b3139] hover:text-[#eaecef]"
            >
              New id
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportFile(f)
              e.target.value = ''
            }}
          />

          {status && (
            <p className="text-[10px] text-[#f0b90b] leading-snug">{status}</p>
          )}

          <p className="text-[9px] text-[#5e6673] leading-snug">
            Salva: griglia, simboli, orderflow, drawings, indicatori, stile. Id =
            token: non condividerlo.
          </p>
        </div>
      )}
    </div>
  )
}
