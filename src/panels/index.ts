/**
 * Desk panel extensions.
 * Side-effect imports register panel types via registerPanelType.
 */
import './news'

export {
  registerPanelType,
  getRegisteredPanel,
  listRegisteredPanels,
  getRegisteredPanelMeta,
} from './registry'
export type { PanelTypeRegistration } from './registry'
export { NewsPanel } from './news'
export type { NewsItem, NewsAssetFilter, NewsPanelProps } from './news'
