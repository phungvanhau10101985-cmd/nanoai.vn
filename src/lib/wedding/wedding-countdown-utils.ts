import type { WebLocale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { parseIsoDateLocal, resolveWeddingReceptionAndPartyTimes } from '@/lib/wedding/wedding-calendar-utils'
import { resolveWeddingDateIso } from '@/lib/wedding/wedding-date-normalize'

export type CountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
  past: boolean
}

type CountdownTx = Dictionary['weddingCardCalendar']

/** Mốc đếm ngược: ngày cưới + giờ khai tiệc. */
export function buildWeddingCountdownTarget(
  iso: string | null | undefined,
  weddingTimeText: string,
  partyStartTime?: string | null,
): Date | null {
  const dateIso = resolveWeddingDateIso(iso)
  const date = parseIsoDateLocal(dateIso)
  if (!date) return null
  const { partyTime } = resolveWeddingReceptionAndPartyTimes(weddingTimeText, partyStartTime)
  const timeStr = partyTime.trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr)
  if (match) {
    const hour = Number(match[1])
    const minute = Number(match[2])
    if (Number.isFinite(hour) && Number.isFinite(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0)
    }
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

export function diffCountdownParts(now: Date, target: Date): CountdownParts {
  let ms = target.getTime() - now.getTime()
  const past = ms <= 0
  ms = Math.max(0, ms)
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds, past }
}

export function formatCountdownRemaining(
  now: Date,
  target: Date | null,
  locale: WebLocale,
  tx: CountdownTx,
): string {
  if (!target) return ''
  const parts = diffCountdownParts(now, target)
  if (parts.past) return tx.countdownPast ?? ''

  const dayLabel = parts.days === 1 ? (tx.countdownDay ?? 'ngày') : (tx.countdownDays ?? 'ngày')
  const hourLabel = parts.hours === 1 ? (tx.countdownHour ?? 'giờ') : (tx.countdownHours ?? 'giờ')
  const minuteLabel = parts.minutes === 1 ? (tx.countdownMinute ?? 'phút') : (tx.countdownMinutes ?? 'phút')
  const secondLabel = parts.seconds === 1 ? (tx.countdownSecond ?? 'giây') : (tx.countdownSeconds ?? 'giây')

  if (locale === 'en') {
    return `${parts.days} ${dayLabel} ${parts.hours} ${hourLabel} ${parts.minutes} ${minuteLabel} ${parts.seconds} ${secondLabel}`
  }
  if (locale === 'zh') {
    return `${parts.days}${dayLabel} ${parts.hours}${hourLabel} ${parts.minutes}${minuteLabel} ${parts.seconds}${secondLabel}`
  }
  if (locale === 'ja') {
    return `${parts.days}${dayLabel} ${parts.hours}${hourLabel} ${parts.minutes}${minuteLabel} ${parts.seconds}${secondLabel}`
  }
  if (locale === 'ko') {
    return `${parts.days}${dayLabel} ${parts.hours}${hourLabel} ${parts.minutes}${minuteLabel} ${parts.seconds}${secondLabel}`
  }
  return `${parts.days} ${dayLabel} ${parts.hours} ${hourLabel} ${parts.minutes} ${minuteLabel} ${parts.seconds} ${secondLabel}`
}
