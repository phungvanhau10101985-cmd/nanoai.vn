import {
  DEFAULT_WEB_LOCALE,
  LOCALE_COOKIE_NAME,
  normalizeWebLocale,
  type WebLocale,
} from '@/lib/i18n/config'

/** Gọi từ client: đọc `nanoai_locale` từ cookie. Trên server / khi không có cookie → `DEFAULT_WEB_LOCALE`. */
export function readWebLocaleFromDocumentCookie(): WebLocale {
  if (typeof document === 'undefined') return DEFAULT_WEB_LOCALE
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${LOCALE_COOKIE_NAME}=`))
    ?.split('=')[1]
    ?.trim()
  return normalizeWebLocale(cookieValue) ?? DEFAULT_WEB_LOCALE
}
