/** Shared desk / layout types for NACS Lab Terminal. */

export interface ChartPanelConfig {
  id: string
  symbol: string
  interval?: string
}

export interface GridLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  static?: boolean
}

/** Side widgets that live on the same magnetic grid as charts. */
export type WidgetKind =
  | 'paper'
  | 'book'
  | 'tape'
  | 'large'
  | 'futures'
  | 'alerts'
  | 'journal'
  | 'terminal'
  | 'watchlist'
  | 'ai'
  | 'wallet'
  | 'bots'
  | 'admin'
  | 'plans'
  | 'liquidity'
  | 'backtest'
  | 'livekeys'
  | 'plugins'
  | 'micro'
  | 'viz3d'
  | 'news'
  | 'calendar'
  | 'livetv'
  | 'learn'
  | 'ops'
  | 'onchain'
  | 'quantlab'
  | 'battlefield'
  | 'orderblock'
  | 'draw'
  | 'orderflow'
  | 'cycles'
  | 'deepprint'
  | 'volprofile'
  | 'domladder'
  | 'footprint'
  | 'cluster'
  | 'tpo'
  | 'gex'
  | 'cvd'
  | 'absorption'
  | 'imbalance'
  | 'deeptrades'
  | 'ofi'
  | 'iceberg'
  | 'tradingdesk'
  | 'opscanner'

export interface WidgetPanelConfig {
  id: string
  kind: WidgetKind
  title?: string
}
