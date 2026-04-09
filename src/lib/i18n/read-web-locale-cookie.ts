import {
  DEFAULT_WEB_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_NAME_LEGACY,
  normalizeWebLocale,
  type WebLocale,
} from '@/lib/i18n/config'

function rawLocaleCookieValue(cookieStr: string, name: string): string | undefined {
  const part = cookieStr
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${name}=`))
  if (!part) return undefined
  const eq = part.indexOf('=')
  return eq >= 0 ? part.slice(eq + 1).trim() : undefined
}

/** Gọi từ client: đọc cookie locale (ưu tiên `app_web_locale`, fallback `nanoai_locale`). */
export function readWebLocaleFromDocumentCookie(): WebLocale {
  if (typeof document === 'undefined') return DEFAULT_WEB_LOCALE
  const raw =
    rawLocaleCookieValue(document.cookie, LOCALE_COOKIE_NAME)
    ?? rawLocaleCookieValue(document.cookie, LOCALE_COOKIE_NAME_LEGACY)
  return normalizeWebLocale(raw) ?? DEFAULT_WEB_LOCALE
}
