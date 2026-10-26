/**
 * Layout store – multi-panel desk: charts + movable widgets on one grid.
 */

import { create } from 'zustand'
import type {
  ChartPanelConfig,
  GridLayoutItem,
  WidgetKind,
  WidgetPanelConfig,
} from '@/types'

function uid(prefix = 'panel') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const WIDGET_META: Record<
  WidgetKind,
  { title: string; minW: number; minH: number; defaultW: number; defaultH: number }
> = {
  paper: { title: 'Trade', minW: 3, minH: 8, defaultW: 4, defaultH: 14 },
  book: { title: 'Order Book', minW: 3, minH: 6, defaultW: 3, defaultH: 12 },
  tape: { title: 'Tape', minW: 2, minH: 4, defaultW: 3, defaultH: 10 },
  large: { title: 'Large Trades', minW: 3, minH: 4, defaultW: 3, defaultH: 10 },
  futures: { title: 'Futures', minW: 3, minH: 4, defaultW: 3, defaultH: 8 },
  alerts: { title: 'Alerts', minW: 3, minH: 4, defaultW: 3, defaultH: 8 },
  journal: { title: 'Journal', minW: 3, minH: 4, defaultW: 3, defaultH: 8 },
  terminal: { title: 'Terminal', minW: 4, minH: 6, defaultW: 5, defaultH: 10 },
  watchlist: { title: 'Watchlist', minW: 3, minH: 5, defaultW: 3, defaultH: 12 },
  ai: { title: 'AI Analysis', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  wallet: { title: 'Wallet', minW: 3, minH: 8, defaultW: 4, defaultH: 14 },
  bots: { title: 'Bots', minW: 4, minH: 8, defaultW: 5, defaultH: 14 },
  admin: { title: 'Admin', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  liquidity: { title: 'Liquidity', minW: 3, minH: 6, defaultW: 3, defaultH: 10 },
  backtest: { title: 'Backtest', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  livekeys: { title: 'Live Keys', minW: 3, minH: 6, defaultW: 3, defaultH: 12 },
  plugins: { title: 'Plugins', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  micro: { title: 'Microstructure', minW: 3, minH: 6, defaultW: 3, defaultH: 10 },
  viz3d: { title: '3D Pro', minW: 4, minH: 8, defaultW: 6, defaultH: 14 },
  news: { title: 'News', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  calendar: { title: 'Calendario', minW: 3, minH: 6, defaultW: 4, defaultH: 12 },
  livetv: { title: 'Live TV', minW: 3, minH: 6, defaultW: 5, defaultH: 12 },
  learn: { title: 'Learn', minW: 4, minH: 8, defaultW: 5, defaultH: 14 },
  ops: { title: 'Ops', minW: 3, minH: 4, defaultW: 4, defaultH: 10 },
  onchain: { title: 'On-chain', minW: 3, minH: 8, defaultW: 4, defaultH: 14 },
  quantlab: { title: 'Quant Lab', minW: 4, minH: 8, defaultW: 6, defaultH: 14 },
  battlefield: { title: 'Battlefield', minW: 5, minH: 10, defaultW: 8, defaultH: 16 },
  draw: { title: 'Draw Tools', minW: 3, minH: 4, defaultW: 4, defaultH: 8 },
  orderflow: { title: 'Deep Print', minW: 3, minH: 6, defaultW: 3, defaultH: 14 },
  cycles: { title: 'Cycles', minW: 3, minH: 4, defaultW: 3, defaultH: 10 },
  deepprint: { title: 'Deep Print', minW: 3, minH: 6, defaultW: 3, defaultH: 14 },
  volprofile: { title: 'Volume Profile', minW: 3, minH: 6, defaultW: 3, defaultH: 14 },
  domladder: { title: 'DOM Ladder', minW: 2, minH: 6, defaultW: 3, defaultH: 14 },
  footprint: { title: 'Footprint', minW: 3, minH: 6, defaultW: 4, defaultH: 14 },
  cluster: { title: 'Cluster Chart', minW: 4, minH: 8, defaultW: 6, defaultH: 16 },
  gex: { title: 'Gamma / GEX', minW: 3, minH: 5, defaultW: 3, defaultH: 12 },
  cvd: { title: 'CVD / Delta', minW: 3, minH: 6, defaultW: 3, defaultH: 14 },
  absorption: { title: 'Absorption', minW: 3, minH: 5, defaultW: 3, defaultH: 12 },
  imbalance: { title: 'Stacked Imbalance', minW: 3, minH: 5, defaultW: 3, defaultH: 12 },
  deeptrades: { title: 'Deep Trades', minW: 3, minH: 6, defaultW: 3, defaultH: 14 },
  ofi: { title: 'OFI / VPIN', minW: 3, minH: 6, defaultW: 3, defaultH: 12 },
  iceberg: { title: 'Iceberg', minW: 3, minH: 5, defaultW: 3, defaultH: 12 },
}
