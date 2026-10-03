import { registerPanelType } from '../registry'
import { LearnPanel } from './LearnPanel'

registerPanelType({
  kind: 'learn',
  title: 'Learn',
  minW: 4,
  minH: 8,
  defaultW: 5,
  defaultH: 14,
  component: LearnPanel,
})

export { LearnPanel } from './LearnPanel'
export type {
  LearnCatalog,
  LearnLesson,
  LearnGlossaryEntry,
  LearnVideo,
  LearnQuiz,
} from './types'
