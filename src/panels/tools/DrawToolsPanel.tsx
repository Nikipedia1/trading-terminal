/**
 * External Draw tools panel — linked to primary chart (no overlay on chart).
 */
import { useLayoutStore } from '@/stores/layoutStore'
import { DrawingToolbar } from '@/drawings/DrawingToolbar'

export function DrawToolsPanel() {
  const primaryId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryId) ?? panels[0]

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
        DRAW · {primary.symbol} · {primary.interval}
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-1">
        <DrawingToolbar panelId={primary.id} symbol={primary.symbol} />
      </div>
    </div>
  )
}
