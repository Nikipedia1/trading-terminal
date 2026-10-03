import { registerPanelType } from '../registry'
import { OpsHealthPanel } from './OpsHealthPanel'

registerPanelType({
  kind: 'ops',
  title: 'Ops',
  minW: 3,
  minH: 6,
  defaultW: 4,
  defaultH: 12,
  component: OpsHealthPanel,
})

export { OpsHealthPanel } from './OpsHealthPanel'
