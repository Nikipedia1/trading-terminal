import { registerPanelType } from '../registry'
import { OrderBlockPanel } from './OrderBlockPanel'

registerPanelType({
  kind: 'orderblock',
  title: 'Order Block',
  minW: 4,
  minH: 8,
  defaultW: 5,
  defaultH: 14,
  component: OrderBlockPanel,
})

export { OrderBlockPanel } from './OrderBlockPanel'
export type {
  MarketBreadth,
  RankedAsset,
  AssetDetail,
  ObBoardTab,
  CryptoSector,
} from './types'
