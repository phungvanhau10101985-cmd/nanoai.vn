import type { WebLocale } from '@/lib/i18n/config'

export const PRINT_LANGUAGE_STEP_KEY = 'print_language'
export const PRINT_LANGUAGE_DETAIL_STEP_KEY = 'print_language_detail'

export type PackagingPrintLanguageKey = 'vi' | 'en' | 'bilingual' | 'other'

export type PackagingPrintLanguageChoice = {
  key: PackagingPrintLanguageKey
  labels: Record<WebLocale, string>
  brief: Record<WebLocale, string>
}

export const PACKAGING_PRINT_LANGUAGE_CHOICES: PackagingPrintLanguageChoice[] = [
  {
    key: 'vi',
    labels: {
      vi: 'Tiếng Việt',
      en: 'Vietnamese',
      zh: '越南语',
      ja: 'ベトナム語',
      ko: '베트남어',
    },
    brief: {
      vi: 'Ngôn ngữ in: tiếng Việt',
      en: 'Print language: Vietnamese',
      zh: '印刷语言：越南语',
      ja: '印刷言語：ベトナム語',
      ko: '인쇄 언어: 베트남어',
    },
  },
  {
    key: 'en',
    labels: {
      vi: 'Tiếng Anh',
      en: 'English',
      zh: '英语',
      ja: '英語',
      ko: '영어',
    },
    brief: {
      vi: 'Ngôn ngữ in: tiếng Anh',
      en: 'Print language: English',
      zh: '印刷语言：英语',
      ja: '印刷言語：英語',
      ko: '인쇄 언어: 영어',
    },
  },
  {
    key: 'bilingual',
    labels: {
      vi: 'Song ngữ (VI + EN)',
      en: 'Bilingual (VI + EN)',
      zh: '双语（越+英）',
      ja: '二言語（越+英）',
      ko: '이중 언어 (베+영)',
    },
    brief: {
      vi: 'Ngôn ngữ in: song ngữ Việt + Anh',
      en: 'Print language: bilingual Vietnamese + English',
      zh: '印刷语言：越南语+英语双语',
      ja: '印刷言語：ベトナム語+英語の二言語',
      ko: '인쇄 언어: 베트남어+영어 이중 언어',
    },
  },
  {
    key: 'other',
    labels: {
      vi: 'Khác',
      en: 'Other',
      zh: '其他',
      ja: 'その他',
      ko: '기타',
    },
    brief: {
      vi: 'Ngôn ngữ in: khác',
      en: 'Print language: other',
      zh: '印刷语言：其他',
      ja: '印刷言語：その他',
      ko: '인쇄 언어: 기타',
    },
  },
]

const OTHER_LANGUAGE_DETAIL: Partial<Record<WebLocale, string>> = {
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
}

export function findPackagingPrintLanguageChoice(
  key: string
): PackagingPrintLanguageChoice | undefined {
  return PACKAGING_PRINT_LANGUAGE_CHOICES.find((c) => c.key === key)
}

export function packagingPrintLanguageLabel(
  choice: PackagingPrintLanguageChoice,
  locale: WebLocale
): string {
  return choice.labels[locale] ?? choice.labels.en
}

export function packagingPrintLanguageBrief(
  choice: PackagingPrintLanguageChoice,
  locale: WebLocale
): string {
  return choice.brief[locale] ?? choice.brief.en
}

export function defaultPrintLanguageKey(locale: WebLocale): PackagingPrintLanguageKey {
  if (locale === 'vi') return 'vi'
  if (locale === 'en') return 'en'
  return 'other'
}

export function defaultPrintLanguageDetail(locale: WebLocale): string | undefined {
  if (locale === 'vi' || locale === 'en') return undefined
  return OTHER_LANGUAGE_DETAIL[locale]
}

export function defaultPrintLanguageFields(locale: WebLocale): {
  print_language: PackagingPrintLanguageKey
  print_language_detail?: string
} {
  const print_language = defaultPrintLanguageKey(locale)
  const detail = defaultPrintLanguageDetail(locale)
  return detail ? { print_language, print_language_detail: detail } : { print_language }
}

export function resolvePrintLanguageKey(
  briefNotes: Record<string, string>
): PackagingPrintLanguageKey {
  const raw = briefNotes[PRINT_LANGUAGE_STEP_KEY]?.trim()
  const choice = raw ? findPackagingPrintLanguageChoice(raw) : undefined
  return choice?.key ?? 'vi'
}

export function resolvePrintLanguageDetail(briefNotes: Record<string, string>): string | undefined {
  const detail = briefNotes[PRINT_LANGUAGE_DETAIL_STEP_KEY]?.trim()
  return detail || undefined
}

export function applyDefaultPrintLanguageToBriefNotes(
  briefNotes: Record<string, string>,
  locale: WebLocale
): Record<string, string> {
  if (briefNotes[PRINT_LANGUAGE_STEP_KEY]?.trim()) return briefNotes
  const defaults = defaultPrintLanguageFields(locale)
  return {
    ...briefNotes,
    [PRINT_LANGUAGE_STEP_KEY]: defaults.print_language,
    ...(defaults.print_language_detail
      ? { [PRINT_LANGUAGE_DETAIL_STEP_KEY]: defaults.print_language_detail }
      : {}),
  }
}

export function buildPackagingPrintLanguagePromptBlock(
  briefNotes: Record<string, string>
): string {
  const key = resolvePrintLanguageKey(briefNotes)
  const detail = resolvePrintLanguageDetail(briefNotes)
  const detailLine = detail ? ` (${detail})` : ''

  const rules: Record<PackagingPrintLanguageKey, string> = {
    vi: 'Default all auto-generated or suggested packaging print copy to Vietnamese. User-supplied quoted text stays verbatim in its original language.',
    en: 'Default all auto-generated or suggested packaging print copy to English. User-supplied quoted text stays verbatim in its original language.',
    bilingual:
      'Default packaging print copy to bilingual Vietnamese + English (e.g. Vietnamese primary with English subtitle, or side-by-side on the same panel). User-supplied quoted text stays verbatim in its original language.',
    other: detail
      ? `Default all auto-generated or suggested packaging print copy to ${detail}. User-supplied quoted text stays verbatim in its original language.`
      : 'Follow the language implied by user brief and discovery answers for auto-generated print copy. User-supplied quoted text stays verbatim in its original language.',
  }

  return `PRINT LANGUAGE (from discovery — key: ${key}${detailLine}):
${rules[key]}`
}
