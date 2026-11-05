'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { pad2, parseWeddingTimeClockAndWeekday } from '@/lib/wedding/wedding-calendar-utils'
import { cn } from '@/lib/utils'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

type ClockParts = {
  hour: number
  minute: number
}

function parseHourMinute(value: string): ClockParts | null {
  const clock = parseWeddingTimeClockAndWeekday(value).time
  if (!clock) return null
  const [hourText, minuteText] = clock.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null
  return { hour, minute }
}

function formatClock(parts: ClockParts) {
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`
}

function minuteChoices(minute: number | null) {
  const choices = new Set(MINUTE_STEPS)
  if (minute != null && !choices.has(minute)) choices.add(minute)
  return Array.from(choices).sort((left, right) => left - right)
}

/** Ô giờ: bấm mở bảng giờ và phút. Chỉ ghi khi bấm OK. */
export function WeddingTimeField(props: {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  className?: string
  onOpen?: () => void
  textMarker?: string
}) {
  const copy = getDictionary(readWebLocaleFromDocumentCookie()).weddingCardAiImage
  const [open, setOpen] = useState(false)
  const [hour, setHour] = useState<number | null>(null)
  const [minute, setMinute] = useState<number | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const centeredRef = useRef(false)
  const shown = parseHourMinute(props.value)
  const label = shown ? formatClock(shown) : ''

  const openPicker = (next: boolean) => {
    if (next) {
      const parsed = parseHourMinute(props.value)
      setHour(parsed?.hour ?? null)
      setMinute(parsed?.minute ?? null)
      props.onOpen?.()
    }
    setOpen(next)
  }

  const confirm = () => {
    if (hour == null || minute == null) return
    props.onChange(formatClock({ hour, minute }))
    setOpen(false)
  }

  const pickHour = (nextHour: number) => {
    setHour(nextHour)
    setMinute((current) => current ?? 0)
  }

  useEffect(() => {
    if (!open) {
      centeredRef.current = false
      return
    }
    if (centeredRef.current) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const scroller = scrollerRef.current
        const target = scroller?.querySelector(`[data-hour="${hour ?? 16}"]`)
        if (!(scroller instanceof HTMLElement) || !(target instanceof HTMLElement)) return
        centeredRef.current = true
        const delta = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top
        scroller.scrollTop += delta - scroller.clientHeight / 2 + target.clientHeight / 2
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [open, hour])

  return (
    <Dialog open={open} onOpenChange={openPicker}>
      <button
        type="button"
        aria-label={props.ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-wedding-text={props.textMarker}
        onClick={() => openPicker(true)}
        className={cn(
          'flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-stone-300 bg-white px-3 text-left text-lg font-semibold text-stone-950 shadow-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400',
          !label && 'font-medium text-stone-400',
          props.className,
        )}
      >
        <span className="min-w-0 truncate tabular-nums">{label || '--:--'}</span>
        <Clock className="h-5 w-5 shrink-0 text-stone-500" aria-hidden />
      </button>
      <DialogContent
        overlayClassName="z-[240] bg-black/45"
        className="z-[241] flex max-h-[min(40rem,calc(100dvh-1rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-3 overflow-hidden bg-white p-4 text-stone-950"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle className="text-stone-950">{props.ariaLabel || copy.previewTimeHour}</DialogTitle>
          <DialogDescription className="text-stone-600">{copy.previewTimeHint}</DialogDescription>
        </DialogHeader>
        <p className="shrink-0 text-center text-4xl font-semibold tabular-nums text-stone-950" aria-live="polite">
          {`${hour == null ? '--' : pad2(hour)}:${minute == null ? '--' : pad2(minute)}`}
        </p>
        <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">{copy.previewTimeHour}</p>
            <div className="grid grid-cols-6 gap-1.5">
              {HOURS.map((item) => {
                const selected = hour === item
                return (
                  <button
                    key={item}
                    type="button"
                    data-hour={item}
                    aria-label={`${copy.previewTimeHour} ${pad2(item)}`}
                    aria-pressed={selected}
                    onClick={() => pickHour(item)}
                    className={cn(
                      'h-12 rounded-xl text-base font-semibold tabular-nums active:scale-95',
                      selected ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-900',
                    )}
                  >
                    {pad2(item)}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">{copy.previewTimeMinute}</p>
            <div className="grid grid-cols-6 gap-1.5">
              {minuteChoices(minute).map((item) => {
                const selected = minute === item
                return (
                  <button
                    key={item}
                    type="button"
                    aria-label={`${copy.previewTimeMinute} ${pad2(item)}`}
                    aria-pressed={selected}
                    onClick={() => setMinute(item)}
                    className={cn(
                      'h-12 rounded-xl text-base font-semibold tabular-nums active:scale-95',
                      selected ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-900',
                    )}
                  >
                    {pad2(item)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <Button type="button" className="h-12 w-full shrink-0 text-base" disabled={hour == null || minute == null} onClick={confirm}>
          {copy.previewTimeOk}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
