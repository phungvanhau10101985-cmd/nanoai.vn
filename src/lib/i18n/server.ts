import { cookies } from 'next/headers'
import {
  DEFAULT_WEB_LOCALE,
  LOCALE_COOKIE_NAME,
  normalizeWebLocale,
  type WebLocale,
} from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export function getCurrentWebLocale(): WebLocale {
  const cookieStore = cookies()
  const cookieLocale = normalizeWebLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  if (cookieLocale) return cookieLocale
  return DEFAULT_WEB_LOCALE
}

export function getServerDictionary() {
  const locale = getCurrentWebLocale()
  return { locale, t: getDictionary(locale) }
}

