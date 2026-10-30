'use client'

import { useMemo } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  buildMonthCells,
  formatBannerDateLine,
  formatCalendarHeaderMonth,
  parseIsoDateLocal,
  resolveWeddingReceptionAndPartyTimes,
  webLocaleToBcp47,
} from '@/lib/wedding/wedding-calendar-utils'
import { resolveWeddingDateIso } from '@/lib/wedding/wedding-date-normalize'
import { WeddingCountdownBlock } from '@/components/wedding/wedding-countdown-block'
import { cn } from '@/lib/utils'

type CalendarTx = Dictionary['weddingCardCalendar']

type Props = {
  weddingDateIso: string | null
  weddingTimeText: string
  partyStartTime?: string
  locale: WebLocale
  tx: CalendarTx
  /** Trong preview chỉnh sửa: thu nhỏ nhẹ typography */
  compact?: boolean
  className?: string
  /** Áp dụng text-shadow khi đặt trên nền ảnh */
  textGlow?: string
  /** Preview editor không cần nhảy từng giây; public mặc định vẫn realtime. */
  countdownLive?: boolean
  /** Ẩn khối đếm ngược (dùng khi đã hiển thị ở phần bìa). */
  showCountdown?: boolean
  /** Nền đỏ long phụng: chữ vàng sáng, không dùng xanh ô-liu. */
  onDarkPaper?: boolean
  /** Tấm kem Song hỷ: chữ đỏ son, không dùng vàng kem. */
  onCreamPaper?: boolean
}

function HeartDayCell({ day, active, ink }: { day: number; active: boolean; ink: string }) {
  return (
    <div className="flex aspect-square max-h-10 items-center justify-center sm:max-h-11">
      {active ? (
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center sm:h-9 sm:w-9">
          <svg
            className={cn('absolute inset-0 h-full w-full', ink)}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
          </svg>
          <span className="relative z-10 text-xs font-semibold leading-none text-white sm:text-[13px]">{day}</span>
        </div>
      ) : (
        <span className={cn('text-xs font-medium sm:text-[13px]', ink)}>{day}</span>
      )}
    </div>
  )
}

function TimeColumn(props: { label: string; time: string; compact?: boolean; labelInk: string; timeInk: string }) {
  return (
    <div className="text-center">
      <p
        className={cn(
          'font-serif font-semibold uppercase leading-snug tracking-[0.08em]',
          props.labelInk,
          props.compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]',
        )}
      >
        {props.label}
      </p>
      <p
        className={cn(
          'mt-1 font-serif font-semibold tabular-nums',
          props.timeInk,
          props.compact ? 'text-2xl' : 'text-3xl sm:text-4xl',
        )}
      >
        {props.time}
      </p>
    </div>
  )
}

function bilingualViLine(locale: WebLocale, primary: string, enLine: string): string {
  return locale === 'vi' ? `${primary} / ${enLine}` : primary
}

/** Khối save-the-date: tiêu đề, giờ khai tiệc, ngày, đón khách / khai tiệc, đếm ngược, lịch tháng. */
export function WeddingEventCalendarBlock({
  weddingDateIso,
  weddingTimeText,
  partyStartTime = '',
  locale,
  tx,
  compact,
  className,
  textGlow,
  countdownLive = true,
  showCountdown = true,
  onDarkPaper = false,
  onCreamPaper = false,
}: Props) {
  const enTx = useMemo(() => (locale === 'vi' ? getDictionary('en').weddingCardCalendar : null), [locale])
  const dateIso = useMemo(() => resolveWeddingDateIso(weddingDateIso), [weddingDateIso])
  const eventDate = useMemo(() => parseIsoDateLocal(dateIso), [dateIso])
  const { receptionTime, partyTime } = useMemo(
    () => resolveWeddingReceptionAndPartyTimes(weddingTimeText, partyStartTime),
    [partyStartTime, weddingTimeText],
  )
  const calendarTitle = eventDate ? formatCalendarHeaderMonth(locale, eventDate) : ''
  const banner = eventDate ? formatBannerDateLine(locale, eventDate) : null
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

  if (!dateIso && !eventDate) return null

  const ink = onCreamPaper ? 'text-[#7a1c28]' : onDarkPaper ? 'text-[#fff0cc]' : 'text-[#556b47]'
  const inkSoft = onCreamPaper ? 'text-[#8d4038]' : onDarkPaper ? 'text-[#fff6e4]' : 'text-[#556b47]/85'
  const labelInk = onCreamPaper ? 'text-[#6e2a32]' : onDarkPaper ? 'text-[#fff6e4]' : 'text-[#556b47]/80'
  const strong = onCreamPaper ? 'text-[#5c121c]' : onDarkPaper ? 'text-[#fffaf0]' : 'text-[#3d4a32]'
  const line = onCreamPaper ? 'border-[#7a1c28]/40' : onDarkPaper ? 'border-[#f3d27a]/45' : 'border-[#556b47]/25'
  const rule = onCreamPaper ? 'border-[#b48a4a]/80' : onDarkPaper ? 'border-[#f3d27a]/35' : 'border-[#556b47]/20'
  const dayInk = onCreamPaper ? 'text-[#7a1c28]' : onDarkPaper ? 'text-[#fff0cc]' : 'text-[#556b47]/85'
  const heartInk = onCreamPaper ? 'text-[#9a1c2c]' : onDarkPaper ? 'text-[#fff0cc]' : 'text-[#556b47]'
  const welcomeDisplay = receptionTime || tx.timePlaceholderDash
  const partyDisplay = partyTime || tx.timePlaceholderDash
  const mainPartyDisplay = partyTime || receptionTime || tx.timePlaceholderDash
  const sectionHeading = bilingualViLine(locale, tx.sectionTitle, enTx?.sectionTitle ?? tx.sectionTitle)
  const introHeading = bilingualViLine(locale, tx.introLine, enTx?.introLine ?? tx.introLine)
  const receptionLabel = bilingualViLine(locale, tx.receptionLabel, enTx?.receptionLabel ?? tx.receptionLabel)
  const partyLabel = bilingualViLine(locale, tx.partyLabel, enTx?.partyLabel ?? tx.partyLabel)

  return (
    <div
      className={cn(
        'rounded-2xl px-2 py-4 sm:px-4 sm:py-5',
        ink,
        compact ? 'py-3' : 'py-5',
        onCreamPaper ? undefined : textGlow,
        className,
      )}
    >
      <p
        className={cn(
          'text-center font-serif font-semibold uppercase tracking-[0.14em]',
          onCreamPaper || onDarkPaper ? ink : 'text-[#556b47]/90',
          compact ? 'text-[10px]' : 'text-[11px] sm:text-xs',
        )}
      >
        {sectionHeading}
      </p>

      <p
        className={cn(
          'mt-3 text-center font-serif font-medium uppercase leading-snug tracking-[0.06em]',
          inkSoft,
          compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]',
        )}
      >
        {introHeading}
      </p>

      <p
        className={cn(
          'mt-2 text-center font-serif font-semibold tabular-nums',
          strong,
          compact ? 'text-4xl' : 'text-5xl sm:text-6xl',
        )}
      >
        {mainPartyDisplay}
      </p>

      {banner ? (
        <div className={cn('mt-4 sm:mt-5', compact && 'mt-3')}>
          <div className={cn('flex items-center justify-center gap-0 font-serif uppercase', onCreamPaper || onDarkPaper ? ink : 'text-[#556b47]/90')}>
            <div className={cn('px-2 text-center', compact ? 'text-[10px]' : 'text-[11px] sm:text-xs')}>
              <p className="leading-snug">{banner.weekdayUpper}</p>
              {locale === 'vi' && enTx ? (
                <p className={cn('mt-0.5 text-[9px] font-normal normal-case sm:text-[10px]', onCreamPaper ? 'text-[#8d4038]' : 'opacity-75')}>
                  {formatBannerDateLine('en', eventDate!).weekdayUpper}
                </p>
              ) : null}
            </div>
            <div
              className={cn(
                'border-l px-3 text-center font-semibold tabular-nums',
                line,
                strong,
                compact ? 'text-3xl' : 'text-4xl sm:text-5xl',
              )}
            >
              {banner.dayPad}
            </div>
            <div className={cn('border-l px-2 text-center', line, compact ? 'text-[10px]' : 'text-[11px] sm:text-xs')}>
              <p className="leading-snug">{banner.monthUpper}</p>
              {locale === 'vi' && enTx ? (
                <p className={cn('mt-0.5 text-[9px] font-normal normal-case sm:text-[10px]', onCreamPaper ? 'text-[#8d4038]' : 'opacity-75')}>
                  {formatBannerDateLine('en', eventDate!).monthUpper}
                </p>
              ) : null}
            </div>
          </div>
          <p
            className={cn(
              'mt-2 text-center font-serif font-medium tabular-nums',
              labelInk,
              compact ? 'text-2xl' : 'text-3xl sm:text-4xl',
            )}
          >
            {banner.yearNum}
          </p>
        </div>
      ) : null}

      <div className={cn('mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-4', compact && 'mt-3 gap-2')}>
        <TimeColumn label={receptionLabel} time={welcomeDisplay} compact={compact} labelInk={labelInk} timeInk={strong} />
        <TimeColumn label={partyLabel} time={partyDisplay} compact={compact} labelInk={labelInk} timeInk={strong} />
      </div>

      {showCountdown ? (
        <WeddingCountdownBlock
          weddingDateIso={dateIso}
          weddingTimeText={weddingTimeText}
          partyStartTime={partyStartTime}
          locale={locale}
          tx={tx}
          compact={compact}
          className={cn(compact ? 'mt-4' : 'mt-6')}
          live={countdownLive}
        />
      ) : null}

      {eventDate ? (
        <div className={cn('mt-4 px-0 pb-1 pt-1 sm:mt-5 sm:px-1', compact && 'mt-3')}>
          <p className={cn('border-b pb-2 text-center font-serif text-sm font-semibold', rule)}>{calendarTitle}</p>
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
                <HeartDayCell key={idx} day={cell} active={cell === highlightDay} ink={cell === highlightDay ? heartInk : dayInk} />
              ),
            )}
          </div>
        </div>
      ) : null}
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
