export const WEB_LOCALES = ['vi', 'en', 'zh', 'ja', 'ko'] as const
export type WebLocale = (typeof WEB_LOCALES)[number]

export const LEARNING_LOCALES = ['vi', 'en', 'zh', 'ja', 'ko', 'th', 'hi'] as const
export type LearningLocale = (typeof LEARNING_LOCALES)[number]

export const DEFAULT_WEB_LOCALE: WebLocale = 'vi'
export const LOCALE_COOKIE_NAME = 'nanoai_locale'

export function normalizeWebLocale(raw: string | undefined | null): WebLocale | null {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return null
  if ((WEB_LOCALES as readonly string[]).includes(value)) return value as WebLocale
  const prefix = value.split('-')[0]
  if ((WEB_LOCALES as readonly string[]).includes(prefix)) return prefix as WebLocale
  return null
}

export function resolveWebLocaleFromAcceptLanguage(headerValue: string | null): WebLocale {
  const raw = String(headerValue || '')
  if (!raw) return DEFAULT_WEB_LOCALE
  const tags = raw
    .split(',')
    .map((part) => part.trim().split(';')[0]?.trim())
    .filter(Boolean)
  for (const tag of tags) {
    const locale = normalizeWebLocale(tag)
    if (locale) return locale
  }
  return DEFAULT_WEB_LOCALE
}

