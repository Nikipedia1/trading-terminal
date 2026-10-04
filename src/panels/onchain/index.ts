import { registerPanelType } from '../registry'
import { OnchainPanel } from './OnchainPanel'

registerPanelType({
  kind: 'onchain',
  title: 'On-chain',
  minW: 3,
  minH: 8,
  defaultW: 4,
  defaultH: 14,
  component: OnchainPanel,
})

export { OnchainPanel } from './OnchainPanel'
export type {
  OnchainSnapshot,
  OnchainTab,
  OnchainBtc,
  OnchainEth,
  OnchainDefi,
} from './types'
