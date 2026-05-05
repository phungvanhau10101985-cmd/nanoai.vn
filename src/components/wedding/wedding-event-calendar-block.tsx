'use client'

import { useMemo } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  buildMonthCells,
  extractClockTimes,
  formatBannerDateLine,
  formatCalendarHeaderMonth,
  parseIsoDateLocal,
  webLocaleToBcp47,
} from '@/lib/wedding/wedding-calendar-utils'
import { cn } from '@/lib/utils'

type CalendarTx = Dictionary['weddingCardCalendar']

type Props = {
  weddingDateIso: string | null
  weddingTimeText: string
  locale: WebLocale
  tx: CalendarTx
  /** Trong preview chỉnh sửa: thu nhỏ nhẹ typography */
  compact?: boolean
  className?: string
}

function HeartDayCell({ day, active }: { day: number; active: boolean }) {
  return (
    <div className="flex aspect-square max-h-11 items-center justify-center">
      {active ? (
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <svg
            className="absolute inset-0 h-full w-full text-[#734d4d]"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
          </svg>
          <span className="relative z-10 text-[13px] font-semibold leading-none text-white">{day}</span>
        </div>
      ) : (
        <span className="text-[13px] font-medium text-[#734d4d]/85">{day}</span>
      )}
    </div>
  )
}

/** Khối «save the date»: tiêu đề, giờ, lưới lịch tháng với ngày cưới đánh dấu trái tim. */
export function WeddingEventCalendarBlock({
  weddingDateIso,
  weddingTimeText,
  locale,
  tx,
  compact,
  className,
}: Props) {
  const eventDate = useMemo(() => parseIsoDateLocal(weddingDateIso), [weddingDateIso])
  const times = useMemo(() => extractClockTimes(weddingTimeText), [weddingTimeText])
  const primaryTime = (
    times.length >= 2 ? times[1] : times.length === 1 ? times[0] : weddingTimeText.trim()
  ).trim()
  const welcomeTime = times.length >= 2 ? times[0] : null
  const partyTime = times.length >= 2 ? times[1] : times[0] ?? null

  const banner = eventDate ? formatBannerDateLine(locale, eventDate) : null
  const calendarTitle = eventDate ? formatCalendarHeaderMonth(locale, eventDate) : ''
  const cells = useMemo(() => {
    if (!eventDate) return []
    return buildMonthCells(eventDate.getFullYear(), eventDate.getMonth())
  }, [eventDate])
  const highlightDay = eventDate?.getDate() ?? null

  const weekShort = useMemo(() => {
    const tag = webLocaleToBcp47(locale)
    const labels: string[] = []
    const base = new Date(2024, 0, 1)
    while (base.getDay() !== 1) base.setDate(base.getDate() + 1)
    for (let i = 0; i < 7; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      const s = new Intl.DateTimeFormat(tag, { weekday: 'narrow' }).format(d)
      labels.push(locale === 'vi' ? viNarrowWeekday(d.getDay()) : s.toUpperCase())
    }
    return labels
  }, [locale])

  if (!eventDate || !banner) return null

  return (
    <div
      className={cn(
        'rounded-2xl border border-[#734d4d]/20 bg-[#fdf8f6]/92 px-4 py-5 text-[#734d4d] shadow-inner backdrop-blur-sm',
        compact ? 'py-3' : 'py-5',
        className,
      )}
    >
      <p className={cn('text-center font-serif font-semibold tracking-[0.2em]', compact ? 'text-[10px]' : 'text-xs')}>
        {tx.sectionTitle}
      </p>
      <p
        className={cn(
          'mt-2 text-center font-serif font-medium tracking-[0.12em]',
          compact ? 'text-[9px]' : 'text-[10px]',
        )}
      >
        {tx.introLine}
      </p>

      {primaryTime ? (
        <p
          className={cn('mt-4 text-center font-serif tabular-nums', compact ? 'text-4xl' : 'text-5xl')}
        >
          {primaryTime}
        </p>
      ) : null}

      <div
        className={cn(
          'flex items-center justify-center gap-2 font-serif font-semibold uppercase tracking-[0.08em]',
          compact ? 'text-xs' : 'text-sm md:text-base',
          primaryTime ? 'mt-2' : 'mt-4',
        )}
      >
        <span className="truncate">{banner.weekdayUpper}</span>
        <span className="shrink-0 opacity-70">|</span>
        <span className="shrink-0 text-lg tabular-nums md:text-xl">{banner.dayPad}</span>
        <span className="shrink-0 opacity-70">|</span>
        <span className="truncate text-sm">{banner.monthUpper}</span>
      </div>
      <p className={cn('mt-1 text-center font-serif tabular-nums', compact ? 'text-xl' : 'text-2xl')}>
        {banner.yearNum}
      </p>

      <div
        className={cn(
          'mt-5 grid grid-cols-2 gap-x-4 gap-y-1 font-serif text-xs uppercase tracking-wide',
          compact && 'mt-3 text-[10px]',
        )}
      >
        <div className="text-right">
          {tx.receptionLabel}:{' '}
          <span className="font-semibold tabular-nums normal-case">
            {welcomeTime ??
              (partyTime ? tx.timePlaceholderDash : weddingTimeText.trim() || tx.timePlaceholderDash)}
          </span>
        </div>
        <div className="text-left">
          {tx.partyLabel}:{' '}
          <span className="font-semibold tabular-nums normal-case">
            {(partyTime ?? weddingTimeText.trim()) || tx.timePlaceholderDash}
          </span>
        </div>
      </div>

      <div
        className={cn(
          'mt-5 rounded-xl border border-[#734d4d]/15 bg-white/55 px-2 pb-2 pt-2',
          compact && 'mt-3',
        )}
      >
        <p className="border-b border-[#734d4d]/15 pb-2 text-center font-serif text-sm font-semibold">{calendarTitle}</p>
        <div className="mt-2 grid grid-cols-7 gap-y-0.5 text-center font-serif text-[10px] font-semibold uppercase opacity-90">
          {weekShort.map((label, i) => (
            <span key={`w-${i}-${label}`}>{label}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {cells.map((cell, idx) =>
            cell == null ? (
              <div key={`e-${idx}`} className="aspect-square max-h-11" aria-hidden />
            ) : (
              <HeartDayCell key={idx} day={cell} active={cell === highlightDay} />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

/** T2 … CN kiểu thiệp VN; thứ 2 trong grid đầu cột là Monday (getDay=1 → T2 index 0). */
function viNarrowWeekday(daySun0: number): string {
  const map: Record<number, string> = {
    0: 'CN',
    1: 'T2',
    2: 'T3',
    3: 'T4',
    4: 'T5',
    5: 'T6',
    6: 'T7',
  }
  return map[daySun0] ?? ''
}
