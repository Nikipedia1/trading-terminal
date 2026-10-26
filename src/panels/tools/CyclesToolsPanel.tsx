/**
 * External Cycles tools panel — linked to primary chart.
 */
import { useEffect } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { useCycleStore, defaultCycleConfig } from '@/stores/cycleStore'
import { CycleMenu } from '@/analysis/cycles'
import { usePanelMarket } from '@/hooks/usePanelMarket'

export function CyclesToolsPanel() {
  const primaryId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryId) ?? panels[0]
  const id = primary?.id ?? ''

  const cycleRaw = useCycleStore((s) => (id ? s.byPanel[id] : undefined))
  const cycleCfg = { ...defaultCycleConfig(), ...(cycleRaw ?? {}) }
  const patchCycle = useCycleStore((s) => s.patch)

  const { candles } = usePanelMarket(
    primary?.symbol ?? 'BTCUSDT',
    primary?.interval ?? '15m',
    primary?.exchange ?? 'binance'
  )

  useEffect(() => {
    if (!id) return
    const cy = useCycleStore.getState()
    if (!cy.byPanel[id]) cy.set(id, defaultCycleConfig())
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
        CYCLES · {primary.symbol} · {primary.interval}
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-2">
        <CycleMenu
          config={cycleCfg}
          candles={candles}
          onChange={(patch) => patchCycle(id, patch)}
        />
      </div>
    </div>
  )
}
