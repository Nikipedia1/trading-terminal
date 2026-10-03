/**
 * Local disaster-recovery backup of workspace + preferences (JSON download/upload).
 * Cloud workspace remains primary when KV is configured.
 */

import { buildSnapshot, applyWorkspace } from '@/workspace/snapshot'
import type { WorkspaceDocument } from '@/workspace/types'
import { getLogBuffer } from '@/lib/logger'
import { getMetricsSnapshot } from '@/lib/metrics'
import { listFeatureOverrides } from '@/lib/features'
import { auditList } from '@/trading/audit/auditLog'

export interface DeskBackup {
  v: 1
  exportedAt: number
  app: 'nacs-lab-terminal'
  workspace: ReturnType<typeof buildSnapshot>
  featureOverrides: ReturnType<typeof listFeatureOverrides>
  auditTail?: unknown[]
  metrics?: unknown
  logs?: unknown[]
}

export function createDeskBackup(includeOps = false): DeskBackup {
  const backup: DeskBackup = {
    v: 1,
    exportedAt: Date.now(),
    app: 'nacs-lab-terminal',
    workspace: buildSnapshot('backup'),
    featureOverrides: listFeatureOverrides(),
  }
  if (includeOps) {
    backup.auditTail = auditList(50)
    backup.metrics = getMetricsSnapshot()
    backup.logs = [...getLogBuffer()].slice(-50)
  }
  return backup
}

export function downloadDeskBackup(includeOps = false) {
  const data = createDeskBackup(includeOps)
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `nacs-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function restoreDeskBackup(data: unknown): { ok: true } | { ok: false; error: string } {
  try {
    const b = data as DeskBackup
    if (!b || b.v !== 1 || !b.workspace?.layout) {
      return { ok: false, error: 'Invalid backup format' }
    }
    const doc: WorkspaceDocument = {
      id: 'restored',
      name: b.workspace.name || 'Restored',
      updatedAt: Date.now(),
      layout: b.workspace.layout,
      indicators: b.workspace.indicators,
      chartStyle: b.workspace.chartStyle,
      orderflow: b.workspace.orderflow,
      drawings: b.workspace.drawings,
    }
    applyWorkspace(doc)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'restore failed' }
  }
}

export async function restoreDeskBackupFromFile(file: File) {
  const text = await file.text()
  return restoreDeskBackup(JSON.parse(text))
}
