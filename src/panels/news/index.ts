import { registerPanelType } from '../registry'
import { NewsPanel } from './NewsPanel'

registerPanelType({
  kind: 'news',
  title: 'News',
  minW: 3,
  minH: 6,
  defaultW: 4,
  defaultH: 12,
  component: NewsPanel,
})

export { NewsPanel } from './NewsPanel'
export type { NewsPanelProps } from './NewsPanel'
export type { NewsItem, NewsAssetFilter } from './types'
