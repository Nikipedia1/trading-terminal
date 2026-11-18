/** Panel grid – charts + widgets */
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
import { PlansPanel } from '@/billing/PlansPanel'
import { LiquidityPanel } from '@/ui/liquidity/LiquidityPanel'
import { BacktestPanel } from '@/bots/backtest/BacktestPanel'
import { LiveKeysPanel } from '@/live/LiveKeysPanel'
import { PluginIndicatorPanel } from '@/plugins/PluginIndicatorPanel'
import { MicrostructurePanel } from '@/analysis/microstructure/MicrostructurePanel'
import { Viz3DPanel } from '@/analysis/viz3d'
import { QuantLabPanel } from '@/panels/quantlab/QuantLabPanel'
import { BattlefieldPanel } from '@/panels/battlefield/BattlefieldPanel'
import { OrderBlockPanel } from '@/panels/orderblock/OrderBlockPanel'
import { NewsPanel } from '@/panels/news'
import { CalendarPanel } from '@/panels/calendar'
import { LiveTvPanel } from '@/panels/livetv'
import { LearnPanel } from '@/panels/learn'
import { OpsHealthPanel } from '@/ops/OpsHealthPanel'
import { OpsScannerPanel } from '@/panels/opscanner/OpsScannerPanel'
import { OnchainPanel } from '@/panels/onchain'
import { DrawToolsPanel } from '@/drawings/DrawToolsPanel'
import { DeepPrintPanel } from '@/panels/instruments/DeepPrintPanel'
import { VolumeProfilePanel } from '@/panels/instruments/VolumeProfilePanel'
import { DomPanel } from '@/panels/instruments/DomPanel'
import { FootprintPanel } from '@/panels/instruments/FootprintPanel'
import { ClusterChartPanel } from '@/panels/instruments/ClusterChartPanel'
import { TpoChartPanel } from '@/panels/instruments/TpoChartPanel'
import { GammaPanel } from '@/panels/instruments/GammaPanel'
import { CvdPanel } from '@/panels/instruments/CvdPanel'
import { AbsorptionPanel } from '@/panels/instruments/AbsorptionPanel'
import { ImbalancePanel } from '@/panels/instruments/ImbalancePanel'
import { DeepTradesPanel } from '@/panels/instruments/DeepTradesPanel'
import { OfiPanel } from '@/panels/instruments/OfiPanel'
import { CyclesViewPanel } from '@/panels/instruments/CyclesViewPanel'
import { IcebergPanel } from '@/panels/instruments/IcebergPanel'
import { FuturesMetricsPanel } from '@/ui/FuturesMetricsPanel'
import { LargeTradesWidget } from '@/ui/LargeTradesWidget'
import { getRegisteredPanel } from '@/panels/registry'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { WidgetShell } from '@/layout/WidgetShell'
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
    case 'plans':
      return <PlansPanel />
    case 'liquidity':
      return <LiquidityPanel />
    case 'backtest':
      return <BacktestPanel />
    case 'livekeys':
      return <LiveKeysPanel />
    case 'plugins':
      return <PluginIndicatorPanel />
    case 'microstructure':
      return <MicrostructurePanel />
    case 'viz3d':
      return <Viz3DPanel />
    case 'quantlab':
      return <QuantLabPanel />
    case 'battlefield':
      return <BattlefieldPanel />
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
    case 'opscanner':
      return <OpsScannerPanel />
    case 'onchain':
      return <OnchainPanel />
    case 'drawtools':
      return <DrawToolsPanel />
    case 'deepprint':
      return <DeepPrintPanel />
    case 'volprofile':
      return <VolumeProfilePanel />
    case 'domladder':
      return <DomPanel />
    case 'footprint':
      return <FootprintPanel />
    case 'cluster':
      return <ClusterChartPanel />
    case 'tpo':
      return <TpoChartPanel />
    case 'gex':
      return <GammaPanel />
    case 'cvd':
      return <CvdPanel />
    case 'absorption':
      return <AbsorptionPanel />
    case 'imbalance':
      return <ImbalancePanel />
    case 'deeptrades':
      return <DeepTradesPanel />
    case 'ofi':
      return <OfiPanel />
    case 'cyclesview':
      return <CyclesViewPanel />
    case 'iceberg':
      return <IcebergPanel />
    case 'futures':
      return <FuturesMetricsPanel />
    case 'largetrades':
      return <LargeTradesWidget />
    case 'orderblock':
      return <OrderBlockPanel />
    default: {
      const Reg = getRegisteredPanel(kind)
      const Comp = Reg?.component
      if (Comp) return <Comp />
      return (
        <div className="h-full flex items-center justify-center text-[11px] text-[#5e6673]">
          Unknown panel: {kind}
        </div>
      )
    }
  }
}

export function PanelGrid() {
  const charts = useLayoutStore((s) => s.charts)
  const widgets = useLayoutStore((s) => s.widgets)
  const layout = useLayoutStore((s) => s.layout)
  const setLayout = useLayoutStore((s) => s.setLayout)

  const layouts = useMemo(() => ({ lg: layout }), [layout])

  return (
    <ResponsiveGrid
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={24}
      onLayoutChange={(l) => setLayout(l)}
      draggableHandle=".tt-panel-drag"
      compactType="vertical"
      margin={[6, 6]}
    >
      {charts.map((c) => (
        <div key={c.id} className="min-h-0">
          <ErrorBoundary name={`chart-${c.id}`}>
            <ChartPanel id={c.id} />
          </ErrorBoundary>
        </div>
      ))}
      {widgets.map((w) => (
        <div key={w.id} className="min-h-0">
          <WidgetShell id={w.id} title={w.title || WIDGET_META[w.kind]?.title || w.kind}>
            <ErrorBoundary name={w.kind}>{renderWidget(w.kind)}</ErrorBoundary>
          </WidgetShell>
        </div>
      ))}
    </ResponsiveGrid>
  )
}
