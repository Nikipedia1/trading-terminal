/**
 * Desk panel extensions.
 * Side-effect imports register panel types via registerPanelType.
 */
import './news'
import './calendar'
import './livetv'

export {
  registerPanelType,
  getRegisteredPanel,
  listRegisteredPanels,
  getRegisteredPanelMeta,
} from './registry'
export type { PanelTypeRegistration } from './registry'
export { NewsPanel } from './news'
export { CalendarPanel } from './calendar'
export { LiveTvPanel } from './livetv'
export type { NewsItem, NewsAssetFilter, NewsPanelProps } from './news'
