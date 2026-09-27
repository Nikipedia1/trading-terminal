/**
 * Local audit log – every order intent and result (paper + live).
 * Append-only in localStorage; exportable JSON. Personal compliance only.
 */

export type AuditMode = 'paper' | 'live'
export type AuditAction =
  | 'place'
  | 'cancel'
  | 'cancel_all'
  | 'close'
  | 'tp'
  | 'sl'
  | 'trail'
  | 'liquidate'
  | 'arm_live'
  | 'disarm_live'
  | 'vault_store'
  | 'vault_unlock'
  | 'error'

export interface AuditEntry {
  id: string
  ts: number
  mode: AuditMode
  action: AuditAction
  symbol?: string
  detail: string
  /** Redacted – never full secrets */
  ok: boolean
}

const KEY = 'tt-audit:v1'
const MAX = 500

function load(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as AuditEntry[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function save(entries: AuditEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)))
  } catch {
    /* quota */
  }
}

export function auditAppend(
  entry: Omit<AuditEntry, 'id' | 'ts'> & { ts?: number }
): AuditEntry {
  const full: AuditEntry = {
    id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: entry.ts ?? Date.now(),
    mode: entry.mode,
    action: entry.action,
    symbol: entry.symbol,
    detail: entry.detail.slice(0, 500),
    ok: entry.ok,
  }
  const next = [full, ...load()].slice(0, MAX)
  save(next)
  return full
}

export function auditList(limit = 100): AuditEntry[] {
  return load().slice(0, limit)
}

export function auditClear() {
  localStorage.removeItem(KEY)
}

export function auditExportJson(): string {
  return JSON.stringify(load(), null, 2)
}
