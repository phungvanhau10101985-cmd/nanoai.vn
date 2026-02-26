import type { PairPromptConfig } from '../i18n/types'

export type BuildChatPromptsInput = {
  teacherIdentity: string
  nativeLanguage: string
  targetLanguage: string
  nativeLanguageCode: string
  targetLanguageCode: string
  teacherLocale: string
  learnerContext: string
  genderLabel: string
  modePrompt: string
  responseStyleGuide: string
  explanationLanguage: string
  bilingualGuide: string
  nativeLanguageGuide: string
  micGuide: string
  speakingModeGuide: string
  strictLanguagePairGuide: string
  howToSayGuide: string
  contextualReplyGuide: string
  mixedAnalysisGuide: string
  levelPromptIndependent: string
  micAnalysisGuide: string
  pinyinGuide: string
  topicGuide: string
  retrievalGuide: string
  transcript: string
  studentText: string
  mixedNormalizedStudentText: string
  speakingMode: 'auto' | 'target' | 'native' | 'mixed'
  sessionMemory: {
    runningSummary: string
    pinnedFacts: {
      repeatedMistakes: string[]
      correctedSentences: string[]
      learnedPhrases: string[]
      topicFocus: string
    }
  }
  pairConfig: PairPromptConfig
}
