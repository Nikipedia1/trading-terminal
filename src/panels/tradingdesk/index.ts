import { registerPanelType } from '../registry'
import { TradingDeskPanel } from './TradingDeskPanel'

registerPanelType({
  kind: 'tradingdesk',
  title: 'Trading Desk',
  minW: 4,
  minH: 10,
  defaultW: 5,
  defaultH: 16,
  component: TradingDeskPanel,
})

export { TradingDeskPanel } from './TradingDeskPanel'
export type { DeskAgentId, DeskMessage, DeskTask } from './types'
