/**
 * Per-widget chart link context — each widget shell owns its own useChartLink state.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { useChartLink, type ChartLinkMode } from '@/hooks/useChartLink'
import { ChartLinkBar } from '@/ui/ChartLinkBar'
import type { Interval, ExchangeId, ChartPanelConfig } from '@/types'

export type ChartLinkValue = ReturnType<typeof useChartLink>

const ChartLinkContext = createContext<ChartLinkValue | null>(null)

/** Read link state from the nearest widget shell (null if outside a linked widget). */
export function useChartLinkContext(): ChartLinkValue | null {
  return useContext(ChartLinkContext)
}

/**
 * Prefer context link; fall back to a local useChartLink if not wrapped.
 * Use in analysis panels so they work both with PanelGrid shell and standalone.
 */
export function useResolvedChartLink(initialMode: ChartLinkMode = 'follow'): ChartLinkValue {
  const ctx = useContext(ChartLinkContext)
  const local = useChartLink(initialMode)
  return ctx ?? local
}

/** Shell: provides context + visible ChartLinkBar for every widget panel. */
export function WidgetChartLinkShell({ children }: { children: ReactNode }) {
  const link = useChartLink('follow')
  return (
    <ChartLinkContext.Provider value={link}>
      <div className="h-full flex flex-col min-h-0">
        <ChartLinkBar
          dense
          mode={link.mode}
          setMode={link.setMode}
          panels={link.panels}
          linkedPanelId={link.linkedPanelId}
          setLinkedPanelId={link.setLinkedPanelId}
          symbol={link.symbol}
          interval={link.interval}
          exchange={link.exchange}
          customSymbol={link.customSymbol}
          setCustomSymbol={link.setCustomSymbol}
          customInterval={link.customInterval}
          setCustomInterval={link.setCustomInterval}
          customExchange={link.customExchange}
          setCustomExchange={link.setCustomExchange}
          applyToChart={link.applyToChart}
          makePrimary={link.makePrimary}
          isPrimary={link.isPrimary}
        />
        <div className="flex-1 min-h-0 min-w-0 overflow-auto">{children}</div>
      </div>
    </ChartLinkContext.Provider>
  )
}

// re-export types for convenience
export type { ChartLinkMode, Interval, ExchangeId, ChartPanelConfig }
