/**
 * External Orderflow tools panel — toggles print/profile/dom/… for primary chart.
 */
import { useEffect } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { useOrderflowStore, defaultOrderflowState } from '@/stores/orderflowStore'
import { OrderflowMenu } from '@/charts/OrderflowMenu'

export function OrderflowToolsPanel() {
  const primaryId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryId) ?? panels[0]
  const id = primary?.id ?? ''

  const ofRaw = useOrderflowStore((s) => (id ? s.byPanel[id] : undefined))
  const ofState = { ...defaultOrderflowState(), ...(ofRaw ?? {}) }
  const patchOf = useOrderflowStore((s) => s.patch)

  useEffect(() => {
    if (!id) return
    const st = useOrderflowStore.getState()
    if (!st.byPanel[id]) st.set(id, defaultOrderflowState())
  }, [id])

  if (!primary) {
    return (
      <div className="h-full flex items-center justify-center text-[11px] text-[#5e6673]">
        Nessun chart primario
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0b0e11] text-[#eaecef]">
      <div className="shrink-0 px-2 py-1 border-b border-[#1e2329] text-[10px] text-[#848e9c] font-mono">
        ORDERFLOW · {primary.symbol} · {primary.exchange}
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-2">
        <OrderflowMenu
          state={ofState}
          exchange={primary.exchange}
          onChange={(next) => patchOf(id, next)}
          onPrintToggle={() => patchOf(id, { print: !ofState.print })}
        />
      </div>
    </div>
  )
}
