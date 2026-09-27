/**
 * Built-in workspace templates – apply interval + orderflow presets.
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
    orderflow: {
      print: true,
      delta: true,
      trades: true,
      dom: true,
      profile: false,
      footprint: false,
    },
  },
  {
    id: 'swing-4h',
    name: 'Swing 4h',
    description: '4h · profile + delta',
    interval: '4h',
    orderflow: {
      print: false,
      delta: true,
      profile: true,
      trades: false,
      dom: false,
      footprint: false,
    },
  },
  {
    id: 'event-risk',
    name: 'Event risk',
    description: '5m · footprint + trades + DOM + profile',
    interval: '5m',
    orderflow: {
      print: true,
      delta: true,
      trades: true,
      dom: true,
      footprint: true,
      profile: true,
    },
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
    useOrderflowStore.getState().patch(primaryId, t.orderflow)
  }

  return { ok: true }
}
