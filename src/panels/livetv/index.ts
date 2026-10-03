import { registerPanelType } from '../registry'
import { LiveTvPanel } from './LiveTvPanel'

registerPanelType({
  kind: 'livetv',
  title: 'Live TV',
  minW: 3,
  minH: 6,
  defaultW: 5,
  defaultH: 12,
  component: LiveTvPanel,
})

export { LiveTvPanel } from './LiveTvPanel'
export type { LiveTvChannel, LiveTvConfigFile } from './types'
