/**
 * Desk panel extensions.
 * Side-effect imports register panel types via registerPanelType.
 */
import './news'
import './calendar'
import './livetv'
import './learn'

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
export { LearnPanel } from './learn'
export type { NewsItem, NewsAssetFilter, NewsPanelProps } from './news'
