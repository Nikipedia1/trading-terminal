import { registerPanelType } from '../registry'
import { BattlefieldPanel } from './BattlefieldPanel'

registerPanelType({
  kind: 'battlefield',
  title: 'Battlefield',
  minW: 5,
  minH: 10,
  defaultW: 8,
  defaultH: 16,
  component: BattlefieldPanel,
})

export { BattlefieldPanel }
