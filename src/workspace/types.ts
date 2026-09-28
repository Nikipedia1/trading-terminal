/** Workspace document – serializable snapshot of terminal UI state. */

import type { ChartPanelConfig, GridLayoutItem, WidgetPanelConfig } from '@/types'

export const WORKSPACE_VERSION = 1 as const

export interface WorkspaceLayoutSlice {
  panels: ChartPanelConfig[]
  /** Desk side panels (Trade, Order Book, Tape, …) */
  widgets?: WidgetPanelConfig[]
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
  indicators?: unknown
  chartStyle?: unknown
  orderflow?: unknown
  drawings?: unknown
}

export type WorkspaceSaveResult =
  | { ok: true; source: 'local' | 'cloud'; id: string; updatedAt: number }
  | { ok: false; error: string }

export type WorkspaceLoadResult =
  | { ok: true; source: 'local' | 'cloud'; doc: WorkspaceDocument }
  | { ok: false; error: string }
