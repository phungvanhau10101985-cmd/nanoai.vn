export type LocalTextFn = (vi: string, en: string) => string

export type SelectOption = {
  value: string
  label: string
}

export type MeaningItem = {
  text: string
  pinyin?: string
}

export type ExampleItem = {
  targetText: string
  targetPinyin?: string
  nativeText: string
}

export type WordPracticeProgress = {
  targetWord: string
  normalizedTarget: string
  attemptsTotal: number
  correctCount: number
  draft: string
  unlocked: boolean
  feedback: string
  expectedMeaning: string
  awaitingMeaningChoice: boolean
  meaningOptions: string[]
}

export type VocabularyItem = {
  id: string
  word: string
  targetLanguage?: string
  meaning?: string | null
  pronunciation?: string | null
  usageLevel?: 'high' | 'medium' | 'low'
  importanceScore?: number
  contextSensitive?: boolean
  meaningItems?: MeaningItem[]
  exampleItems?: ExampleItem[]
  exampleTarget?: string
  exampleNative?: string
}

export type PreLessonWordItem = {
  word: string
  meaning: string
  pronunciation: string
  pronunciationAudioUrl?: string
  targetLanguage?: string
  usageLevel?: 'high' | 'medium' | 'low'
  importanceScore?: number
  contextSensitive?: boolean
  exampleTarget?: string
  meaningItems?: MeaningItem[]
  exampleItems?: ExampleItem[]
}

export type HistorySessionItem = {
  sessionId: string
  languageCode: string
  teacherLabel: string
  mode: string
  lastTeacherText: string
  messageCount: number
}

