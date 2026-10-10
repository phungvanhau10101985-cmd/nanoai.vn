import { createHash } from 'node:crypto'
import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

const built = new Map<WebLocale, { body: string; version: string }>()

/** JS that registers one locale for the browser `getDictionary` (Vietnamese is already bundled). */
export function clientDictionaryScript(locale: WebLocale): { body: string; version: string } {
  const hit = built.get(locale)
  if (hit) return hit
  const body = `(window.__NANOAI_DICTS__=window.__NANOAI_DICTS__||{})[${JSON.stringify(locale)}]=${JSON.stringify(getDictionary(locale))};`
  const row = { body, version: createHash('sha1').update(body).digest('hex').slice(0, 12) }
  built.set(locale, row)
  return row
}

export function clientDictionaryScriptSrc(locale: WebLocale): string | null {
  if (locale === DEFAULT_WEB_LOCALE) return null
  return `/api/i18n-dict/${locale}?v=${clientDictionaryScript(locale).version}`
}
