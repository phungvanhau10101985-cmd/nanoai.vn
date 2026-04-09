/**
 * Web đa ngôn ngữ (Multilingual).
 * Mọi chuỗi hiển thị phải dùng dictionary hoặc localText – không hardcode.
 * @see .cursor/rules/multilingual-i18n.mdc
 */
export const IS_MULTILINGUAL_WEB = true

export const WEB_LOCALES = ['vi', 'en', 'zh', 'ja', 'ko'] as const
export type WebLocale = (typeof WEB_LOCALES)[number]

/** Ngôn ngữ mẹ đẻ & đích trong học ngoại ngữ AI – do người dùng chọn, không cố định vi. */
export const LEARNING_LOCALES = ['vi', 'en', 'zh', 'ja', 'ko', 'th', 'hi'] as const
export type LearningLocale = (typeof LEARNING_LOCALES)[number]

export const DEFAULT_WEB_LOCALE: WebLocale = 'vi'
/** Cookie chính (ưu tiên). Legacy `nanoai_locale` vẫn được ghi/đọc song song. */
export const LOCALE_COOKIE_NAME = 'app_web_locale'
export const LOCALE_COOKIE_NAME_LEGACY = 'nanoai_locale'

/** Đọc locale từ `cookies()` (server / route handlers). */
export function resolveWebLocaleFromCookieStore(cookieStore: {
  get: (name: string) => { value?: string } | undefined
}): WebLocale {
  const fromNew = normalizeWebLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  if (fromNew) return fromNew
  const fromLegacy = normalizeWebLocale(cookieStore.get(LOCALE_COOKIE_NAME_LEGACY)?.value)
  return fromLegacy ?? DEFAULT_WEB_LOCALE
}

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

