'use client'

import { useEffect, useMemo, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'
import {
  buildWeddingCountdownTarget,
  diffCountdownParts,
  formatCountdownRemaining,
} from '@/lib/wedding/wedding-countdown-utils'

type CountdownTx = Dictionary['weddingCardCalendar']

type Props = {
  weddingDateIso: string | null
  weddingTimeText: string
  partyStartTime?: string
  locale: WebLocale
  tx: CountdownTx
  compact?: boolean
  className?: string
  live?: boolean
  /** Nền đỏ hoặc đêm: chữ kem, không dùng xanh ô-liu. */
  onDarkPaper?: boolean
}

export function WeddingCountdownBlock({
  weddingDateIso,
  weddingTimeText,
  partyStartTime = '',
  locale,
  tx,
  compact,
  className,
  live = true,
  onDarkPaper = false,
}: Props) {
  const target = useMemo(
    () => buildWeddingCountdownTarget(weddingDateIso, weddingTimeText, partyStartTime),
    [partyStartTime, weddingDateIso, weddingTimeText],
  )
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    if (!live) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [live])

  const label = useMemo(
    () => (now ? formatCountdownRemaining(now, target, locale, tx) : ''),
    [locale, now, target, tx],
  )

  const past = useMemo(
    () => (now && target ? diffCountdownParts(now, target).past : false),
    [now, target],
  )

  if (!now || !target || past) return null

  const title = tx.countdownTitle ?? 'CÙNG ĐẾM NGƯỢC'

  return (
    <div className={cn('text-center font-serif', onDarkPaper ? 'text-[#fff0cc]' : 'wedding-cal-ink text-[#556b47]', className)} role="timer" aria-live="polite">
      <p
        className={cn(
          'font-semibold uppercase tracking-[0.22em] opacity-90',
          compact ? 'text-[10px]' : 'text-xs',
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          'mt-3 font-semibold tabular-nums leading-snug',
          compact ? 'text-sm' : 'text-base md:text-lg',
          'tracking-wide',
        )}
      >
        {label}
      </p>
    </div>
  )
}
