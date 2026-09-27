/** Workspace document – serializable snapshot of terminal UI state. */

import type { ChartPanelConfig, GridLayoutItem } from '@/types'

export const WORKSPACE_VERSION = 1 as const

export interface WorkspaceLayoutSlice {
  panels: ChartPanelConfig[]
  layout: GridLayoutItem[]
  primaryPanelId: string
}

/**
 * Full workspace payload stored in localStorage + Cloudflare KV.
 * id is an opaque capability token (keep private).
 */
export interface WorkspaceDocument {
  version: typeof WORKSPACE_VERSION
  id: string
  name: string
  updatedAt: number
  layout: WorkspaceLayoutSlice
  /** indicatorStore serializable fields */
  indicators?: unknown
  /** chartStyleStore serializable fields */
  chartStyle?: unknown
  /** useOrderflowStore.byPanel */
  orderflow?: unknown
  /** useDrawingStore.byPanelSymbol */
  drawings?: unknown
}

export type WorkspaceSaveResult =
  | { ok: true; source: 'local' | 'cloud'; id: string; updatedAt: number }
  | { ok: false; error: string }

export type WorkspaceLoadResult =
  | { ok: true; source: 'local' | 'cloud'; doc: WorkspaceDocument }
  | { ok: false; error: string }
