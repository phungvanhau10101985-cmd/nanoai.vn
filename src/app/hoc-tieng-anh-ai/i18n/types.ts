export type CoachUiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko' | 'th' | 'hi'

export type LanguagePairCode = `${CoachUiLocale}__${CoachUiLocale}`

export type PairPromptConfig = {
  key: string
  nativeLanguageCode: CoachUiLocale | 'any'
  targetLanguageCode: CoachUiLocale | 'any'
  uiTone: 'supportive' | 'professional' | 'direct'
  enforceStrictPair: boolean
  nativeFirstExplanation: boolean
  maxReplyCharsConcise: number
  maxReplyCharsDetailed: number
  conversationFocus: string[]
  correctionFocus: string[]
  lexicalFocus: string[]
  avoidPatterns: string[]
  extraSystemRules: string[]
}
