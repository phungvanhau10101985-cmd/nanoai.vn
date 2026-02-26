import en from './locales/en.json'
import hi from './locales/hi.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import th from './locales/th.json'
import vi from './locales/vi.json'
import zh from './locales/zh.json'
import type { CoachUiLocale } from './types'

const localeTable: Record<CoachUiLocale, Record<string, string>> = {
  vi,
  en,
  zh,
  ja,
  ko,
  th,
  hi,
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return Object.entries(params).reduce((text, [key, value]) => {
    return text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }, template)
}

export function tCoach(locale: CoachUiLocale, key: string, params?: Record<string, string | number>): string {
  const raw = localeTable[locale]?.[key] || key
  return interpolate(raw, params)
}

export function createCoachTranslator(locale: CoachUiLocale) {
  return (key: string, params?: Record<string, string | number>) => tCoach(locale, key, params)
}
