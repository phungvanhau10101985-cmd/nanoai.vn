import type { WebLocale } from '@/lib/i18n/config'

const BCP47: Record<WebLocale, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
}

/**
 * Format ISO timestamps for list UI using an explicit web locale so Node SSR and
 * the browser produce the same string (avoids hydration mismatch from default locale).
 */
export function formatSessionIsoDateTime(
  iso: string | null | undefined,
  locale: WebLocale
): string {
  if (iso == null || String(iso).trim() === '') return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(BCP47[locale], {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 19).replace('T', ' ')
  }
}
