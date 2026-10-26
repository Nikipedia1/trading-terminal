/** Warn when desk has many widgets – soft + hard performance guard. */

import { useLayoutStore } from '@/stores/layoutStore'
import { useLocale } from '@/i18n'

const SOFT_LIMIT = 8

/** Cap concurrent chart panels for DOM safety. */
export const MAX_CHART_PANELS = 6
/** Cap concurrent widgets (addWidget no-ops beyond this). */
export const MAX_WIDGETS = 12

export function PerfGuard() {
  const n = useLayoutStore((s) => s.panels.length + s.widgets.length)
  const { t } = useLocale()
  if (n < SOFT_LIMIT) return null
  const hard = n >= MAX_WIDGETS + MAX_CHART_PANELS
  return (
    <div
      className="fixed top-12 left-1/2 -translate-x-1/2 z-[46] max-w-md px-3 py-1.5 rounded border border-[#f0b90b]/50 bg-[#1a1508] text-[10px] text-[#f0b90b] shadow-lg"
      role="status"
    >
      {t('perf.panelWarn')} ({n}
      {hard ? ` · hard cap charts≤${MAX_CHART_PANELS} widgets≤${MAX_WIDGETS}` : ''})
    </div>
  )
}
