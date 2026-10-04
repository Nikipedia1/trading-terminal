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
import { BacktestPanel } from '@/backtest/BacktestPanel'
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
    case 'livekeys':
      return <LiveKeysPanel />
    case 'plugins':
      return <PluginIndicatorPanel />
    case 'micro':
      return <MicrostructurePanel />
    case 'viz3d':
      return <Viz3DPanel />
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
    case 'quantlab':
      return <QuantLabPanel />
    default: {
      const reg = getRegisteredPanel(kind)
      if (reg) {
        const C = reg.component
        return <C />
      }
      return null
    }
  }
}

const ADDABLE: WidgetKind[] = [
  'viz3d',
  'quantlab',
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
  'news',
  'calendar',
  'livetv',
  'learn',
  'ops',
  'onchain',
]

interface PanelGridProps {
  width: number
  height?: number
}

export function PanelGrid({ width }: PanelGridProps) {
  const panels = useLayoutStore((s) => s.panels)
  const widgets = useLayoutStore((s) => s.widgets)
  const layout = useLayoutStore((s) => s.layout)
  const setLayout = useLayoutStore((s) => s.setLayout)
  const addPanel = useLayoutStore((s) => s.addPanel)
  const addWidget = useLayoutStore((s) => s.addWidget)
  const primaryPanelId = useLayoutStore((s) => s.primaryPanelId)

  const layouts = useMemo(() => ({ lg: layout }), [layout])

  return (
    <div className="h-full w-full relative">
      <div className="absolute top-1 right-2 z-30 flex gap-1">
        <button
          type="button"
          className="text-[10px] px-2 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#f0b90b]"
          onClick={() => addPanel()}
        >
          + Chart
        </button>
        <div className="relative group">
          <button
            type="button"
            className="text-[10px] px-2 py-0.5 rounded border border-[#2b3139] text-[#848e9c] hover:text-[#f0b90b]"
          >
            + Panel
          </button>
          <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-[#0b0e11] border border-[#2b3139] rounded-md shadow-xl p-1 z-50 max-h-64 overflow-y-auto min-w-[140px]">
            {ADDABLE.map((k) => (
              <button
                key={k}
                type="button"
                className="block w-full text-left text-[10px] px-2 py-1 text-[#c8cdd5] hover:bg-[#1e2329] rounded"
                onClick={() => addWidget(k)}
              >
                {WIDGET_META[k]?.title ?? k}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ResponsiveGrid
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={24}
        width={width || 1200}
        onLayoutChange={(l) => setLayout(l)}
        draggableHandle=".panel-drag-handle"
      >
        {panels.map((p) => (
          <div key={p.id} className="bg-[#0b0e11] border border-[#2b3139] rounded overflow-hidden">
            <ChartPanel config={p} isPrimary={p.id === primaryPanelId} />
          </div>
        ))}
        {widgets.map((w) => (
          <div key={w.id} className="bg-[#0b0e11] border border-[#2b3139] rounded overflow-hidden flex flex-col">
            <div className="panel-drag-handle px-2 py-1 text-[10px] text-[#848e9c] border-b border-[#2b3139] cursor-move">
              {w.title}
            </div>
            <div className="flex-1 min-h-0">{renderWidget(w.kind)}</div>
          </div>
        ))}
      </ResponsiveGrid>
    </div>
  )
}
