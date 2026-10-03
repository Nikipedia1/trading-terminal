/**
 * Lightweight panel type registry.
 * New desk widgets can self-register without hard-coding every switch case.
 */

import type { ComponentType } from 'react'

export interface PanelTypeRegistration {
  /** Stable widget kind id (must match WidgetKind when wired into the desk). */
  kind: string
  title: string
  minW: number
  minH: number
  defaultW: number
  defaultH: number
  component: ComponentType
}

const registry = new Map<string, PanelTypeRegistration>()

export function registerPanelType(reg: PanelTypeRegistration): void {
  if (registry.has(reg.kind)) {
    console.warn(`[panels] registerPanelType: kind "${reg.kind}" already registered – overwriting`)
  }
  registry.set(reg.kind, reg)
}

export function getRegisteredPanel(kind: string): PanelTypeRegistration | undefined {
  return registry.get(kind)
}

export function listRegisteredPanels(): PanelTypeRegistration[] {
  return [...registry.values()]
}

export function getRegisteredPanelMeta(
  kind: string
): Pick<PanelTypeRegistration, 'title' | 'minW' | 'minH' | 'defaultW' | 'defaultH'> | undefined {
  const r = registry.get(kind)
  if (!r) return undefined
  return {
    title: r.title,
    minW: r.minW,
    minH: r.minH,
    defaultW: r.defaultW,
    defaultH: r.defaultH,
  }
}
