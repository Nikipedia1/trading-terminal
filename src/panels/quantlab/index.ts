import { registerPanelType } from '../registry'
import { QuantLabPanel } from './QuantLabPanel'

registerPanelType({
  kind: 'quantlab',
  title: 'Quant Lab',
  minW: 4,
  minH: 8,
  defaultW: 6,
  defaultH: 14,
  component: QuantLabPanel,
})

export { QuantLabPanel }
