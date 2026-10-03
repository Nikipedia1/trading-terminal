/**
 * PanelGrid - magnetic grid for charts + desk widgets.
 */

import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import GridLayout, { type Layout } from 'react-grid-layout'
import { useLayoutStore, WIDGET_META } from '@/stores/layoutStore'
import { ChartPanel } from '@/charts/ChartPanel'
import { WidgetShell } from './WidgetShell'
import { OrderBookWidget } from '@/ui/OrderBookWidget'
import { BloombergTerminal } from '@/ui/BloombergTerminal'
import { WatchlistPanel } from '@/ui/WatchlistPanel'
import { AiAnalysisPanel } from '@/ui/AiAnalysisPanel'
import { PaperTradingPanel } from '@/trading/paper'
import { LargeTradesPanel } from '@/analysis/deepTrades'
import { FuturesMetricsPanel } from '@/ui/FuturesMetricsPanel'
import { VirtualizedTape } from '@/ui/VirtualizedTape'
import { AlertPanel } from '@/alerts'
import { JournalPanel } from '@/journal'
import { WalletPanel } from '@/wallet'
import { BotsPanel } from '@/bots'
import { AdminPanel } from '@/auth'
import { useMarketStore } from '@/stores/marketStore'
import { usePanelMarket } from '@/hooks/usePanelMarket'
import type { WidgetKind } from '@/types'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { LiquidityPanel } from '@/ui/liquidity/LiquidityPanel'
import { BacktestPanel } from '@/bots/backtest/BacktestPanel'
import { LiveKeysPanel } from '@/live/LiveKeysPanel'
import { PluginIndicatorPanel } from '@/plugins/PluginIndicatorPanel'
import { MicrostructurePanel } from '@/analysis/microstructure'
import { useMobileLayout } from '@/layout/useMobileLayout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const COLS = 12
const ROW_HEIGHT = 28

interface PanelGridProps {
  width: number
  height: number
}

function TapeWidget() {
  const trades = useMarketStore((s) => s.trades)
  return <VirtualizedTape trades={trades} />
}

function LargeTradesWidget() {
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)
  const panels = useLayoutStore((s) => s.panels)
  const primary = panels.find((p) => p.id === primaryPanelId) ?? panels[0]
  const symbol = primary?.symbol ?? 'BTCUSDT'
  const interval = primary?.interval ?? '1m'
  const exchange = primary?.exchange ?? 'binance'
  const { candles } = usePanelMarket(symbol, interval, exchange)
  return (
    <LargeTradesPanel exchange={exchange} symbol={symbol} interval={interval} candles={candles} />
  )
}

function WidgetBody({ kind }: { kind: WidgetKind }) {
  return (
    <ErrorBoundary name={kind}>
      <WidgetBodyInner kind={kind} />
    </ErrorBoundary>
  )
}

function WidgetBodyInner({ kind }: { kind: WidgetKind }) {
  switch (kind) {
    case 'paper':
      return <PaperTradingPanel />
    case 'book':
      return <OrderBookWidget />
    case 'tape':
      return <TapeWidget />
    case 'large':
      return <LargeTradesWidget />
    case 'futures':
      return <FuturesMetricsPanel />
    case 'alerts':
      return <AlertPanel />
    case 'journal':
      return <JournalPanel />
    case 'terminal':
      return <BloombergTerminal />
    case 'watchlist':
      return <WatchlistPanel />
    case 'ai':
      return <AiAnalysisPanel />
    case 'wallet':
      return <WalletPanel />
    case 'bots':
      return <BotsPanel />
    case 'admin':
      return <AdminPanel />
    case 'liquidity':
      return <LiquidityPanel />
    case 'backtest':
      return <BacktestPanel />
    case 'livekeys':
      return <LiveKeysPanel />
    case 'plugins':
      return <PluginIndicatorPanel />
    case 'micro':
      return <MicrostructurePanel />
    default:
      return null
  }
}

const ADDABLE: WidgetKind[] = [
  'admin',
  'bots',
  'wallet',
  'ai',
  'watchlist',
  'terminal',
  'paper',
  'book',
  'tape',
  'large',
  'futures',
  'alerts',
  'journal',
  'liquidity',
  'backtest',
  'livekeys',
  'plugins',
  'micro',
]

export function PanelGrid({ width }: PanelGridProps) {
  const mobile = useMobileLayout()
  const panels = useLayoutStore((s) => s.panels)
  const widgets = useLayoutStore((s) => s.widgets)
  const layout = useLayoutStore((s) => s.layout)
  const setLayout = useLayoutStore((s) => s.setLayout)
  const addPanel = useLayoutStore((s) => s.addPanel)
  const addWidget = useLayoutStore((s) => s.addWidget)
  const reconcileLayout = useLayoutStore((s) => s.reconcileLayout)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    reconcileLayout()
  }, [reconcileLayout])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const chartMap = useMemo(() => {
    const m = new Map<string, (typeof panels)[0]>()
    for (const p of panels) m.set(p.id, p)
    return m
  }, [panels])

  const widgetMap = useMemo(() => {
    const m = new Map<string, (typeof widgets)[0]>()
    for (const w of widgets) m.set(w.id, w)
    return m
  }, [widgets])

  const onDeskKinds = useMemo(() => {
    const set = new Set<WidgetKind>()
    for (const w of widgets) set.add(w.kind)
    return set
  }, [widgets])

  const onLayoutChange = useCallback(
    (next: Layout) => {
      setLayout(
        next.map((it) => ({
          i: it.i,
          x: it.x,
          y: it.y,
          w: it.w,
          h: it.h,
          minW: it.minW,
          minH: it.minH,
        }))
      )
    },
    [setLayout]
  )

  if (mobile) {
    return (
      <div className="h-full overflow-y-auto p-2 space-y-2 bg-[#0b0e11]">
        {panels.map((p) => (
          <div key={p.id} className="min-h-[280px] rounded border border-[#2b3139] overflow-hidden">
            <ChartPanel config={p} />
          </div>
        ))}
        {widgets.map((w) => (
          <div key={w.id} className="min-h-[200px] rounded border border-[#2b3139] overflow-hidden">
            <WidgetShell id={w.id} title={w.title}>
              <WidgetBody kind={w.kind} />
            </WidgetShell>
          </div>
        ))}
        {panels.length === 0 && widgets.length === 0 && <EmptyState title="Empty desk" />}
      </div>
    )
  }

  return (
    <div className="h-full w-full relative bg-[#0b0e11] overflow-auto">
      <div className="absolute top-2 right-2 z-30" ref={menuRef}>
        <button
          type="button"
          className="px-2 py-1 text-[11px] rounded border border-[#2b3139] bg-[#1e2329] text-[#eaecef] hover:border-[#f0b90b]"
          onClick={() => setMenuOpen((v) => !v)}
        >
          + Panel
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-48 max-h-72 overflow-y-auto rounded border border-[#2b3139] bg-[#0d1118] shadow-xl py-1">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-[11px] text-[#eaecef] hover:bg-[#1e2329]"
              onClick={() => {
                addPanel()
                setMenuOpen(false)
              }}
            >
              Chart
            </button>
            <div className="border-t border-[#2b3139] my-1" />
            {ADDABLE.map((k) => {
              const onDesk = onDeskKinds.has(k)
              return (
                <button
                  key={k}
                  type="button"
                  disabled={onDesk}
                  className={
                    'w-full text-left px-3 py-1.5 text-[11px] ' +
                    (onDesk
                      ? 'text-[#5e6673] cursor-default'
                      : 'text-[#eaecef] hover:bg-[#1e2329]')
                  }
                  onClick={() => {
                    if (!onDesk) {
                      addWidget(k)
                      setMenuOpen(false)
                    }
                  }}
                >
                  {WIDGET_META[k].title}
                  {onDesk ? ' \u2713' : ''}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <GridLayout
        className="layout"
        layout={layout}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        width={Math.max(width, 320)}
        onLayoutChange={onLayoutChange}
        draggableHandle=".panel-drag-handle"
        compactType="vertical"
        preventCollision={false}
        margin={[4, 4]}
        containerPadding={[4, 4]}
        resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
      >
        {layout.map((item) => {
          const chart = chartMap.get(item.i)
          if (chart) {
            return (
              <div key={item.i} className="h-full overflow-hidden">
                <ChartPanel config={chart} />
              </div>
            )
          }
          const widget = widgetMap.get(item.i)
          if (widget) {
            return (
              <div key={item.i} className="h-full overflow-hidden">
                <WidgetShell id={widget.id} title={widget.title}>
                  <WidgetBody kind={widget.kind} />
                </WidgetShell>
              </div>
            )
          }
          return <div key={item.i} />
        })}
      </GridLayout>
    </div>
  )
}
