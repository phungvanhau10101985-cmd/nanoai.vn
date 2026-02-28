/**
 * Học ngoại ngữ AI – đa ngôn ngữ.
 * nativeLanguageCode: do người dùng chọn, không cố định vi.
 * targetLanguageCode: ngôn ngữ đích người dùng muốn học.
 */
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
