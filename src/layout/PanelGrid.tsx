/** Panel grid – charts + widgets. Quant Lab registered. */
import { useMemo } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import { useLayoutStore, WIDGET_META } from '@/stores/layoutStore'
import { ChartPanel } from '@/charts/ChartPanel'
import { OrderBookWidget } from '@/ui/OrderBookWidget'
import { VirtualizedTape } from '@/ui/VirtualizedTape'
import { ExecutionBar } from '@/trading'
import { AlertPanel } from '@/alerts'
import { JournalPanel } from '@/journal'
import { BloombergTerminal } from '@/ui/BloombergTerminal'
import { WatchlistPanel } from '@/ui/WatchlistPanel'
import { AiAnalysisPanel } from '@/ui/AiAnalysisPanel'
import { WalletPanel } from '@/wallet/WalletPanel'
import { BotsPanel } from '@/bots/BotsPanel'
import { AdminPanel } from '@/auth/AdminPanel'
import { LiquidityPanel } from '@/ui/liquidity/LiquidityPanel'
import { BacktestPanel } from '@/bots/backtest/BacktestPanel'
import { LiveKeysPanel } from '@/live/LiveKeysPanel'
import { PluginIndicatorPanel } from '@/plugins/PluginIndicatorPanel'
import { MicrostructurePanel } from '@/analysis/microstructure/MicrostructurePanel'
import { Viz3DPanel } from '@/analysis/viz3d'
import { QuantLabPanel } from '@/panels/quantlab/QuantLabPanel'
import { NewsPanel } from '@/panels/news'
import { CalendarPanel } from '@/panels/calendar'
import { LiveTvPanel } from '@/panels/livetv'
import { LearnPanel } from '@/panels/learn'
import { OpsHealthPanel } from '@/panels/ops'
import { OnchainPanel } from '@/panels/onchain'
import { FuturesMetricsPanel } from '@/ui/FuturesMetricsPanel'
import { LargeTradesWidget } from '@/ui/OrderBookWidget'
import { getRegisteredPanel } from '@/panels'
import type { WidgetKind } from '@/types'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGrid = WidthProvider(Responsive)

function renderWidget(kind: WidgetKind) {
  switch (kind) {
    case 'paper':
      return <ExecutionBar />
    case 'book':
      return <OrderBookWidget />
    case 'tape':
      return <VirtualizedTape />
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
    case 'live_keys':
      return <LiveKeysPanel />
    case 'plugin_indicator':
      return <PluginIndicatorPanel />
    case 'microstructure':
      return <MicrostructurePanel />
    case 'viz3d':
      return <Viz3DPanel />
    case 'quantlab':
      return <QuantLabPanel />
    case 'news':
      return <NewsPanel />
    case 'calendar':
      return <CalendarPanel />
    case 'livetv':
      return <LiveTvPanel />
    case 'learn':
      return <LearnPanel />
    case 'ops':
      return <OpsHealthPanel />
    case 'onchain':
      return <OnchainPanel />
    default: {
      const Custom = getRegisteredPanel(kind)
      if (Custom) return <Custom />
      return (
        <div className="h-full flex items-center justify-center text-[11px] text-[#5e6673]">
          Unknown panel: {String(kind)}
        </div>
      )
    }
  }
}

export function PanelGrid({ width, height }: { width: number; height: number }) {
  const panels = useLayoutStore((s) => s.panels)
  const widgets = useLayoutStore((s) => s.widgets)
  const layouts = useLayoutStore((s) => s.layouts)
  const setLayouts = useLayoutStore((s) => s.setLayouts)
  const removeWidget = useLayoutStore((s) => s.removeWidget)

  const cols = useMemo(() => ({ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }), [])

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <ResponsiveGrid
        className="layout"
        width={width}
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={cols}
        rowHeight={Math.max(24, Math.floor(height / 24))}
        margin={[6, 6]}
        containerPadding={[6, 6]}
        draggableHandle=".panel-drag-handle"
        onLayoutChange={(_layout, all) => setLayouts(all)}
        compactType="vertical"
        preventCollision={false}
      >
        {panels.map((p) => (
          <div key={p.id} className="nacs-widget-shell overflow-visible">
            <ChartPanel config={p} />
          </div>
        ))}
        {widgets.map((w) => (
          <div key={w.id} className="nacs-widget-shell overflow-visible">
            <div className="panel-drag-handle nacs-widget-title cursor-move select-none min-h-[32px]">
              <span className="truncate font-semibold tracking-wide text-[#c8cdd5]">{w.title}</span>
              <button
                type="button"
                className="ml-auto shrink-0 flex items-center justify-center w-7 h-7 rounded border border-terminal-border bg-terminal-bg text-terminal-red text-sm font-bold leading-none hover:bg-terminal-red/15 hover:border-terminal-red/60 active:scale-95"
                title="Close panel"
                onClick={(e) => {
                  e.stopPropagation()
                  removeWidget(w.id)
                }}
              >
                ×
              </button>
            </div>
            <div className="flex-1 min-h-0">{renderWidget(w.kind)}</div>
          </div>
        ))}
      </ResponsiveGrid>
    </div>
  )
}

void WIDGET_META
