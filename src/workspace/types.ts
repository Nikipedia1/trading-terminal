/** Workspace document – serializable snapshot of terminal UI state. */

import type { ChartPanelConfig, GridLayoutItem } from '@/types'

export const WORKSPACE_VERSION = 1 as const

export interface WorkspaceLayoutSlice {
  panels: ChartPanelConfig[]
  layout: GridLayoutItem[]
  primaryPanelId: string
}

export interface WorkspaceDocument {
  version: typeof WORKSPACE_VERSION
  id: string
  name: string
  updatedAt: number
  layout: WorkspaceLayoutSlice
  indicators?: unknown
  chartStyle?: unknown
  drawings?: unknown
}

export type WorkspaceSaveResult =
  | { ok: true; source: 'local' | 'cloud'; id: string; updatedAt: number }
  | { ok: false; error: string }

export type WorkspaceLoadResult =
  | { ok: true; source: 'local' | 'cloud'; doc: WorkspaceDocument }
  | { ok: false; error: string }
