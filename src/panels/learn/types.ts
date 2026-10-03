export type LearnCategoryId =
  | 'order-flow'
  | 'indicatori'
  | 'risk'
  | 'psicologia'
  | string

export type LearnItemType = 'lesson' | 'glossary' | 'video' | 'quiz'

export interface LearnCategory {
  id: LearnCategoryId
  label: string
}

export interface LearnLesson {
  id: string
  type: 'lesson'
  category: LearnCategoryId
  title: string
  summary?: string
  body: string
}

export interface LearnGlossaryEntry {
  id: string
  type: 'glossary'
  category: LearnCategoryId
  term: string
  definition: string
}

export interface LearnVideo {
  id: string
  type: 'video'
  category: LearnCategoryId
  title: string
  summary?: string
  videoId: string
  durationMin?: number
}

export interface LearnQuizQuestion {
  id: string
  prompt: string
  options: string[]
  answerIndex: number
}

export interface LearnQuiz {
  id: string
  type: 'quiz'
  category: LearnCategoryId
  title: string
  questions: LearnQuizQuestion[]
}

export type LearnContentItem =
  | LearnLesson
  | LearnGlossaryEntry
  | LearnVideo
  | LearnQuiz

export interface LearnCatalog {
  version?: number
  title?: string
  categories: LearnCategory[]
  lessons: LearnLesson[]
  glossary: LearnGlossaryEntry[]
  videos: LearnVideo[]
  quizzes: LearnQuiz[]
}
