/** Capture / restore workspace slices from live Zustand stores. */

import { useLayoutStore } from '@/stores/layoutStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useChartStyleStore } from '@/stores/chartStyleStore'
import { useOrderflowStore } from '@/stores/orderflowStore'
import { useDrawingStore } from '@/drawings/drawingStore'
import type { WorkspaceDocument, WorkspaceLayoutSlice } from './types'

function stripFns(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === 'function') continue
    clean[k] = v
  }
  return clean
}

export function captureLayout(): WorkspaceLayoutSlice {
  const s = useLayoutStore.getState()
  return {
    panels: s.panels.map((p) => ({ ...p })),
    widgets: s.widgets.map((w) => ({ ...w })),
    layout: s.layout.map((l) => ({ ...l })),
    primaryPanelId: s.primaryPanelId,
  }
}

export function captureIndicators(): unknown {
  try {
    return stripFns(useIndicatorStore.getState() as unknown as Record<string, unknown>)
  } catch {
    return undefined
  }
}

export function captureChartStyle(): unknown {
  try {
    return stripFns(useChartStyleStore.getState() as unknown as Record<string, unknown>)
  } catch {
    return undefined
  }
}

export function captureOrderflow(): unknown {
  try {
    return useOrderflowStore.getState().exportAll()
  } catch {
    return undefined
  }
}

export function captureDrawings(): unknown {
  try {
    const s = useDrawingStore.getState()
    return JSON.parse(JSON.stringify(s.byPanelSymbol))
  } catch {
    return undefined
  }
}

export function applyLayout(slice: WorkspaceLayoutSlice): void {
  const patch: Record<string, unknown> = {
    panels: slice.panels,
    layout: slice.layout,
    primaryPanelId: slice.primaryPanelId,
  }
  if (Array.isArray(slice.widgets)) {
    patch.widgets = slice.widgets
  }
  useLayoutStore.setState(patch as any)
  // Repair: widgets listed but missing grid slots → re-attach
  useLayoutStore.getState().reconcileLayout?.()
}

export function applyIndicators(data: unknown): void {
  if (!data || typeof data !== 'object') return
  try {
    const d = data as Record<string, unknown>
    if (d.byPanel && typeof d.byPanel === 'object') {
      useIndicatorStore.setState({ byPanel: d.byPanel as any })
    }
  } catch {
    /* schema drift */
  }
}

export function applyChartStyle(data: unknown): void {
  if (!data || typeof data !== 'object') return
  try {
    const d = data as Record<string, unknown>
    if (d.style && typeof d.style === 'object') {
      useChartStyleStore.setState({ style: d.style as any })
    }
  } catch {
    /* */
  }
}

export function applyOrderflow(data: unknown): void {
  if (!data || typeof data !== 'object') return
  try {
    useOrderflowStore.getState().hydrate(data as any)
  } catch {
    /* */
  }
}

export function applyDrawings(data: unknown): void {
  if (!data || typeof data !== 'object') return
  try {
    const map = data as Record<string, Record<string, unknown[]>>
    useDrawingStore.setState({ byPanelSymbol: map as any })
    for (const [panelId, bySym] of Object.entries(map)) {
      if (!bySym || typeof bySym !== 'object') continue
      for (const [sym, drawings] of Object.entries(bySym)) {
        if (Array.isArray(drawings)) {
          useDrawingStore.getState().setDrawings(panelId, sym, drawings as any)
        }
      }
    }
  } catch {
    /* */
  }
}

export function applyWorkspace(doc: WorkspaceDocument): void {
  applyLayout(doc.layout)
  if (doc.indicators) applyIndicators(doc.indicators)
  if (doc.chartStyle) applyChartStyle(doc.chartStyle)
  if (doc.orderflow) applyOrderflow(doc.orderflow)
  if (doc.drawings) applyDrawings(doc.drawings)
}

export function buildSnapshot(name?: string): {
  name?: string
  layout: WorkspaceLayoutSlice
  indicators?: unknown
  chartStyle?: unknown
  orderflow?: unknown
  drawings?: unknown
} {
  return {
    name: name || undefined,
    layout: captureLayout(),
    indicators: captureIndicators(),
    chartStyle: captureChartStyle(),
    orderflow: captureOrderflow(),
    drawings: captureDrawings(),
  }
}
