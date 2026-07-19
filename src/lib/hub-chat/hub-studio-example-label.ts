import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export function studioExamplePrefix(locale: WebLocale): string {
  return getDictionary(locale).hubChat.suggestedExamplePrefix
}

/** Prefix selectable suggestion labels so users know they are examples, not requirements. */
export function formatStudioExampleLabel(locale: WebLocale, label: string): string {
  const prefix = studioExamplePrefix(locale)
  const trimmed = label.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith(prefix)) return trimmed
  if (/^(Ví dụ|VD|Example|示例|例|예)[:：]/i.test(trimmed)) return trimmed
  return `${prefix} ${trimmed}`
}
