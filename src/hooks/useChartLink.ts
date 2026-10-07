/**
 * Link analysis widgets to a chart panel (primary by default) or local symbol/TF.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import type { Interval, ExchangeId, ChartPanelConfig } from '@/types'

export type ChartLinkMode = 'follow' | 'custom'

export function useChartLink(initialMode: ChartLinkMode = 'follow') {
  const panels = useLayoutStore((s) => s.panels)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const setPrimaryPanel = useLayoutStore((s) => s.setPrimaryPanel)
  const updatePanel = useLayoutStore((s) => s.updatePanel)

  const [mode, setMode] = useState<ChartLinkMode>(initialMode)
  const [linkedId, setLinkedId] = useState<string | null>(null)
  const [customSymbol, setCustomSymbol] = useState('BTCUSDT')
  const [customInterval, setCustomInterval] = useState<Interval>('15m')
  const [customExchange, setCustomExchange] = useState<ExchangeId>('binance')

  const effectiveId = useMemo(() => {
    if (linkedId && panels.some((p) => p.id === linkedId)) return linkedId
    return primaryPanelId
  }, [linkedId, panels, primaryPanelId])

  const panel: ChartPanelConfig | undefined = useMemo(
    () => panels.find((p) => p.id === effectiveId) ?? panels[0],
    [panels, effectiveId]
  )

  // Keep custom fields in sync when following so switching to custom starts from chart
  useEffect(() => {
    if (mode !== 'follow' || !panel) return
    setCustomSymbol(panel.symbol)
    setCustomInterval(panel.interval)
    setCustomExchange(panel.exchange)
  }, [mode, panel?.id, panel?.symbol, panel?.interval, panel?.exchange])

  const symbol = mode === 'custom' ? customSymbol : (panel?.symbol ?? 'BTCUSDT')
  const interval: Interval = mode === 'custom' ? customInterval : (panel?.interval ?? '15m')
  const exchange: ExchangeId = mode === 'custom' ? customExchange : (panel?.exchange ?? 'binance')

  const applyToChart = useCallback(() => {
    if (!panel) return
    updatePanel(panel.id, {
      symbol: customSymbol.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      interval: customInterval,
      exchange: customExchange,
    })
  }, [panel, customSymbol, customInterval, customExchange, updatePanel])

  const makePrimary = useCallback(() => {
    if (panel) setPrimaryPanel(panel.id)
  }, [panel, setPrimaryPanel])

  return {
    mode,
    setMode,
    linkedPanelId: effectiveId,
    setLinkedPanelId: setLinkedId,
    symbol,
    interval,
    exchange,
    panel,
    panels,
    customSymbol,
    setCustomSymbol,
    customInterval,
    setCustomInterval,
    customExchange,
    setCustomExchange,
    applyToChart,
    makePrimary,
    isPrimary: panel?.id === primaryPanelId,
  }
}
