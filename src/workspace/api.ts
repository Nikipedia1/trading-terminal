/**
 * Workspace persistence:
 *  1. Always write/read localStorage (works offline, €0)
 *  2. Same-origin /api/workspace/:id → Cloudflare KV (Pages Function)
 * Cloud writes require authenticated session (HttpOnly cookie).
 * Ownership is stored server-side (wsmeta). Local cache still works offline.
 */

import type {
  WorkspaceDocument,
  WorkspaceLoadResult,
  WorkspaceSaveResult,
} from './types'
import { WORKSPACE_VERSION } from './types'
import {
  getOrCreateWorkspaceId,
  getWorkspaceName,
  setWorkspaceId,
  setWorkspaceName,
} from './id'

const LOCAL_PREFIX = 'tt_workspace_doc:'

function apiBase(): string {
  const env = import.meta.env.VITE_WORKSPACE_API as string | undefined
  if (env && env.trim()) return env.replace(/\/$/, '')
  return ''
}

function localKey(id: string): string {
  return LOCAL_PREFIX + id
}

export function saveLocal(doc: WorkspaceDocument): void {
  try {
    localStorage.setItem(localKey(doc.id), JSON.stringify(doc))
  } catch (e) {
    console.warn('[workspace] localStorage full or blocked', e)
  }
}

export function loadLocal(id: string): WorkspaceDocument | null {
  try {
    const raw = localStorage.getItem(localKey(id))
    if (!raw) return null
    const doc = JSON.parse(raw) as WorkspaceDocument
    if (doc.version !== WORKSPACE_VERSION) return null
    return doc
  } catch {
    return null
  }
}

async function cloudGet(id: string): Promise<WorkspaceDocument | null> {
  const base = apiBase()
  const url = `${base}/api/workspace/${encodeURIComponent(id)}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`cloud GET ${res.status}`)
    const doc = (await res.json()) as WorkspaceDocument
    if (doc.version !== WORKSPACE_VERSION) return null
    return doc
  } catch (e) {
    console.warn('[workspace] cloud GET failed', e)
    return null
  }
}

async function cloudPut(doc: WorkspaceDocument): Promise<boolean> {
  const base = apiBase()
  const url = `${base}/api/workspace/${encodeURIComponent(doc.id)}`
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(doc),
      credentials: 'include',
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`cloud PUT ${res.status} ${t}`)
    }
    return true
  } catch (e) {
    console.warn('[workspace] cloud PUT failed', e)
    return false
  }
}

/** True when cloud workspace API is available (Pages / localhost with Functions). */
export function cloudEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const h = window.location.hostname
    if (h.endsWith('pages.dev') || h === 'localhost' || h === '127.0.0.1') {
      return true
    }
  } catch {
    /* */
  }
  if (apiBase()) return true
  return false
}

export async function saveWorkspace(
  partial: Omit<WorkspaceDocument, 'version' | 'id' | 'updatedAt' | 'name'> & {
    name?: string
    id?: string
  }
): Promise<WorkspaceSaveResult> {
  const id = partial.id || getOrCreateWorkspaceId()
  setWorkspaceId(id)
  if (partial.name) setWorkspaceName(partial.name)

  const doc: WorkspaceDocument = {
    version: WORKSPACE_VERSION,
    id,
    name: partial.name || getWorkspaceName(),
    updatedAt: Date.now(),
    layout: partial.layout,
    indicators: partial.indicators,
    chartStyle: partial.chartStyle,
    orderflow: partial.orderflow,
    drawings: partial.drawings,
  }

  saveLocal(doc)

  if (cloudEnabled()) {
    const ok = await cloudPut(doc)
    if (ok) return { ok: true, source: 'cloud', id, updatedAt: doc.updatedAt }
  }

  return { ok: true, source: 'local', id, updatedAt: doc.updatedAt }
}

export async function loadWorkspace(
  id?: string
): Promise<WorkspaceLoadResult> {
  const wid = id || getOrCreateWorkspaceId()
  if (id) setWorkspaceId(id)

  if (cloudEnabled()) {
    const cloud = await cloudGet(wid)
    if (cloud) {
      saveLocal(cloud)
      if (cloud.name) setWorkspaceName(cloud.name)
      return { ok: true, source: 'cloud', doc: cloud }
    }
  }

  const local = loadLocal(wid)
  if (local) return { ok: true, source: 'local', doc: local }

  return { ok: false, error: 'no workspace found (local or cloud)' }
}

export function exportWorkspaceFile(doc: WorkspaceDocument): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `workspace-${doc.name || doc.id}-${doc.updatedAt}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function importWorkspaceFile(
  file: File
): Promise<WorkspaceLoadResult> {
  try {
    const text = await file.text()
    const doc = JSON.parse(text) as WorkspaceDocument
    if (doc.version !== WORKSPACE_VERSION) {
      return { ok: false, error: 'unsupported workspace version' }
    }
    if (!doc.id || !doc.layout) {
      return { ok: false, error: 'invalid workspace file' }
    }
    setWorkspaceId(doc.id)
    if (doc.name) setWorkspaceName(doc.name)
    saveLocal(doc)
    return { ok: true, source: 'local', doc }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'import failed' }
  }
}
