import { cookies } from 'next/headers'
import { resolveWebLocaleFromCookieStore, type WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export function getCurrentWebLocale(): WebLocale {
  return resolveWebLocaleFromCookieStore(cookies())
}

export function getServerDictionary() {
  const locale = getCurrentWebLocale()
  return { locale, t: getDictionary(locale) }
}

