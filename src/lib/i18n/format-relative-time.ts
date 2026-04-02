import type { WebLocale } from '@/lib/i18n/config'

const DATE_LOCALE: Record<WebLocale, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
}

/** Thời gian tương đối cho UI (chuông thông báo, v.v.). */
export function formatWebRelativeTime(iso: string, locale: WebLocale): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return iso
  const now = Date.now()
  const sec = Math.round((now - then) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (sec < 45) return rtf.format(-Math.max(1, sec), 'second')
  const min = Math.floor(sec / 60)
  if (min < 60) return rtf.format(-min, 'minute')
  const hours = Math.floor(min / 60)
  if (hours < 36) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 40) return rtf.format(-days, 'day')
  return new Date(iso).toLocaleDateString(DATE_LOCALE[locale])
}
