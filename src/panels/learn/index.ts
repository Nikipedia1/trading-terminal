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
export { GlossaryLinkedText, GlossaryHitChips } from './GlossaryLinkedText'
export { loadGlossaryEntries, findGlossaryHits, linkifyGlossary } from './glossaryIndex'
export { LEARN_OPEN_EVENT } from './types'
export type {
  LearnCatalog,
  LearnLesson,
  LearnGlossaryEntry,
  LearnVideo,
  LearnQuiz,
  LearnOpenDetail,
} from './types'
