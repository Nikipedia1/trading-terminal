/** Capture / restore workspace slices from live Zustand stores. */

import { useLayoutStore } from '@/stores/layoutStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useChartStyleStore } from '@/stores/chartStyleStore'
import type { WorkspaceDocument, WorkspaceLayoutSlice } from './types'

export function captureLayout(): WorkspaceLayoutSlice {
  const s = useLayoutStore.getState()
  return {
    panels: s.panels.map((p) => ({ ...p })),
    layout: s.layout.map((l) => ({ ...l })),
    primaryPanelId: s.primaryPanelId,
  }
}

export function captureIndicators(): unknown {
  try {
    const s = useIndicatorStore.getState() as Record<string, unknown>
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === 'function') continue
      clean[k] = v
    }
    return clean
  } catch {
    return undefined
  }
}

export function captureChartStyle(): unknown {
  try {
    const s = useChartStyleStore.getState() as Record<string, unknown>
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === 'function') continue
      clean[k] = v
    }
    return clean
  } catch {
    return undefined
  }
}

export function applyLayout(slice: WorkspaceLayoutSlice): void {
  useLayoutStore.setState({
    panels: slice.panels,
    layout: slice.layout,
    primaryPanelId: slice.primaryPanelId,
  })
}

export function applyIndicators(data: unknown): void {
  if (!data || typeof data !== 'object') return
  try {
    const cur = useIndicatorStore.getState()
    useIndicatorStore.setState({ ...cur, ...(data as object) } as any)
  } catch {
    /* schema drift – ignore */
  }
}

export function applyChartStyle(data: unknown): void {
  if (!data || typeof data !== 'object') return
  try {
    const cur = useChartStyleStore.getState()
    useChartStyleStore.setState({ ...cur, ...(data as object) } as any)
  } catch {
    /* */
  }
}

export function applyWorkspace(doc: WorkspaceDocument): void {
  applyLayout(doc.layout)
  if (doc.indicators) applyIndicators(doc.indicators)
  if (doc.chartStyle) applyChartStyle(doc.chartStyle)
}

export function buildSnapshot(name?: string): Omit<
  WorkspaceDocument,
  'version' | 'id' | 'updatedAt'
> & { name?: string } {
  return {
    name,
    layout: captureLayout(),
    indicators: captureIndicators(),
    chartStyle: captureChartStyle(),
  }
}
