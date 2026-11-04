import { registerPanelType } from '../registry'
import { OpsScannerPanel } from './OpsScannerPanel'

registerPanelType({
  kind: 'opscanner',
  title: 'Ops Scanner',
  minW: 4,
  minH: 8,
  defaultW: 5,
  defaultH: 14,
  component: OpsScannerPanel,
})

export { OpsScannerPanel } from './OpsScannerPanel'
export type { ScanRow, ScanBias, ScanSetup, ScanFilter } from './types'
