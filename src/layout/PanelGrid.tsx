/**
 * PanelGrid – magnetic grid for charts + desk widgets.
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
]

export function PanelGrid({ width }: PanelGridProps) {
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
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const onLayoutChange = useCallback(
    (next: Layout[]) => {
      setLayout(
        next.map((l) => ({
          i: l.i,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          minW: l.minW,
          minH: l.minH,
        }))
      )
    },
    [setLayout]
  )

  const chartMap = useMemo(() => new Map(panels.map((p) => [p.id, p])), [panels])
  const widgetMap = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets])
  const layoutIds = useMemo(() => new Set(layout.map((l) => l.i)), [layout])

  const onDeskKinds = useMemo(() => {
    const set = new Set<WidgetKind>()
    for (const w of widgets) {
      if (layoutIds.has(w.id)) set.add(w.kind)
    }
    return set
  }, [widgets, layoutIds])

  if (width <= 0) return null

  return (
    <div className="relative h-full w-full overflow-auto bg-[#0b0e11]">
      <div ref={menuRef} className="absolute top-1 right-2 z-20 flex gap-1">
        <button
          type="button"
          onClick={() => addPanel()}
          className="px-2 py-0.5 text-xs bg-[#1e2329] text-[#eaecef] border border-[#2b3139] rounded hover:border-[#5e6673]"
          title="Add chart panel"
        >
          + Chart
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="px-2 py-0.5 text-xs bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/40 rounded hover:bg-[#f0b90b]/25"
          title="Add widget panel"
        >
          + Panel
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 min-w-[140px] bg-[#12161c] border border-[#2b3139] rounded shadow-xl py-1 text-xs z-30">
            {ADDABLE.map((k) => {
              const onDesk = onDeskKinds.has(k)
              return (
                <button
                  key={k}
                  type="button"
                  disabled={onDesk}
                  className={`block w-full text-left px-3 py-1.5 ${
                    onDesk
                      ? 'text-[#5e6673] cursor-not-allowed'
                      : 'text-[#eaecef] hover:bg-[#1e2329]'
                  }`}
                  onClick={() => {
                    if (!onDesk) {
                      addWidget(k)
                      setMenuOpen(false)
                    }
                  }}
                >
                  {WIDGET_META[k].title}
                  {onDesk ? ' ✓' : ''}
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
        width={width}
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
