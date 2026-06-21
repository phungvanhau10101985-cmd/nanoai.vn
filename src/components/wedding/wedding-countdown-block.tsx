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
}: Props) {
  const target = useMemo(
    () => buildWeddingCountdownTarget(weddingDateIso, weddingTimeText, partyStartTime),
    [partyStartTime, weddingDateIso, weddingTimeText],
  )
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [live])

  const label = useMemo(
    () => formatCountdownRemaining(now, target, locale, tx),
    [locale, now, target, tx],
  )

  const past = useMemo(
    () => (target ? diffCountdownParts(now, target).past : false),
    [now, target],
  )

  if (!target || past) return null

  const title = tx.countdownTitle ?? 'CÙNG ĐẾM NGƯỢC'

  return (
    <div className={cn('text-center font-serif text-[#556b47]', className)} role="timer" aria-live="polite">
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
