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
