/**
 * Built-in workspace templates – apply interval + orderflow presets.
 * Does not invent market data; only UI config.
 */

import type { Interval } from '@/types'
import { useLayoutStore } from '@/stores/layoutStore'
import { useOrderflowStore } from '@/stores/orderflowStore'
import { useMarketStore } from '@/stores/marketStore'

export interface WorkspaceTemplate {
  id: string
  name: string
  description: string
  interval: Interval
  /** Orderflow toggles applied to primary panel */
  orderflow?: {
    print?: boolean
    delta?: boolean
    profile?: boolean
    trades?: boolean
    dom?: boolean
    footprint?: boolean
  }
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'scalp-1m',
    name: 'Scalp 1m',
    description: '1m · print + delta + trades + DOM',
    interval: '1m',
    orderflow: { print: true, delta: true, trades: true, dom: true, profile: false, footprint: false },
  },
  {
    id: 'swing-4h',
    name: 'Swing 4h',
    description: '4h · profile + delta CVD',
    interval: '4h',
    orderflow: { print: false, delta: true, profile: true, trades: false, dom: false, footprint: false },
  },
  {
    id: 'event-risk',
    name: 'Event risk',
    description: '5m · footprint + trades + DOM ladder',
    interval: '5m',
    orderflow: { print: true, delta: true, trades: true, dom: true, footprint: true, profile: true },
  },
]

export function applyTemplate(id: string): { ok: true } | { ok: false; error: string } {
  const t = WORKSPACE_TEMPLATES.find((x) => x.id === id)
  if (!t) return { ok: false, error: 'Unknown template' }

  const layout = useLayoutStore.getState()
  const primaryId = layout.primaryPanelId
  layout.updatePanel(primaryId, { interval: t.interval })

  useMarketStore.getState().setInterval(t.interval)

  if (t.orderflow) {
    try {
      const of = useOrderflowStore.getState()
      // hydrate partial toggles if API exists
      if (typeof (of as any).patchPanel === 'function') {
        ;(of as any).patchPanel(primaryId, t.orderflow)
      } else if (typeof (of as any).setPanel === 'function') {
        ;(of as any).setPanel(primaryId, t.orderflow)
      }
    } catch {
      /* orderflow schema may differ */
    }
  }

  return { ok: true }
}
