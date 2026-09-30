/**
 * Persist desk layout across reloads (even without workspace cloud save).
 * Side-effect module – import once from main.tsx.
 */

import { useLayoutStore } from './layoutStore'

const KEY = 'tt-layout:v1'

function hydrate() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const d = JSON.parse(raw) as {
      panels?: unknown[]
      widgets?: unknown[]
      layout?: unknown[]
      primaryPanelId?: string
    }
    if (!Array.isArray(d.layout) || !d.layout.length) return
    if (!Array.isArray(d.panels) || !d.panels.length) return
    useLayoutStore.setState({
      panels: d.panels as ReturnType<typeof useLayoutStore.getState>['panels'],
      widgets: (Array.isArray(d.widgets) ? d.widgets : []) as ReturnType<
        typeof useLayoutStore.getState
      >['widgets'],
      layout: d.layout as ReturnType<typeof useLayoutStore.getState>['layout'],
      primaryPanelId: d.primaryPanelId || 'panel-main',
    })
    useLayoutStore.getState().reconcileLayout()
  } catch {
    /* ignore corrupt */
  }
}

function persist() {
  try {
    const s = useLayoutStore.getState()
    localStorage.setItem(
      KEY,
      JSON.stringify({
        panels: s.panels,
        widgets: s.widgets,
        layout: s.layout,
        primaryPanelId: s.primaryPanelId,
      })
    )
  } catch {
    /* quota */
  }
}

if (typeof window !== 'undefined') {
  hydrate()
  let tmr: ReturnType<typeof setTimeout> | null = null
  useLayoutStore.subscribe(() => {
    if (tmr) clearTimeout(tmr)
    tmr = setTimeout(persist, 300)
  })
}

export {}
