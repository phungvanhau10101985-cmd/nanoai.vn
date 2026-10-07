'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type ClockParts = {
  hour12: number
  minute: number
  pm: boolean
}

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1)
const MINUTES = Array.from({ length: 60 }, (_, index) => index)

function pad2(value: number) {
  return value < 10 ? `0${value}` : String(value)
}

function parseClock(value: string): ClockParts | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23) return null
  return {
    hour12: hour % 12 === 0 ? 12 : hour % 12,
    minute,
    pm: hour >= 12,
  }
}

function to24Hour(parts: ClockParts) {
  const hour = (parts.hour12 % 12) + (parts.pm ? 12 : 0)
  return `${pad2(hour)}:${pad2(parts.minute)}`
}

function formatClockLabel(value: string) {
  const parts = parseClock(value)
  if (!parts) return ''
  return `${pad2(parts.hour12)}:${pad2(parts.minute)} ${parts.pm ? 'CH' : 'SA'}`
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/** Ô giờ có nút OK. Bản nháp chỉ ghi khi bấm OK. */
export function WeddingTimeField(props: {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ClockParts>({ hour12: 4, minute: 30, pm: true })
  const label = formatClockLabel(props.value)

  const openPicker = (next: boolean) => {
    if (next) setDraft(parseClock(props.value) ?? { hour12: 4, minute: 30, pm: true })
    setOpen(next)
  }

  const confirm = () => {
    props.onChange(to24Hour(draft))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={openPicker}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={props.ariaLabel}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-sm',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            !label && 'text-muted-foreground',
            props.className,
          )}
        >
          <span className="tabular-nums">{label || '--:--'}</span>
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Giờ
            <select
              aria-label="Giờ"
              className={selectClass}
              value={draft.hour12}
              onChange={(event) => setDraft((prev) => ({ ...prev, hour12: Number(event.target.value) }))}
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {pad2(hour)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Phút
            <select
              aria-label="Phút"
              className={selectClass}
              value={draft.minute}
              onChange={(event) => setDraft((prev) => ({ ...prev, minute: Number(event.target.value) }))}
            >
              {MINUTES.map((minute) => (
                <option key={minute} value={minute}>
                  {pad2(minute)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Buổi
            <select
              aria-label="Buổi"
              className={selectClass}
              value={draft.pm ? 'pm' : 'am'}
              onChange={(event) => setDraft((prev) => ({ ...prev, pm: event.target.value === 'pm' }))}
            >
              <option value="am">SA</option>
              <option value="pm">CH</option>
            </select>
          </label>
        </div>
        <p className="text-center text-sm font-medium tabular-nums">
          {pad2(draft.hour12)}:{pad2(draft.minute)} {draft.pm ? 'CH' : 'SA'}
        </p>
        <Button type="button" className="w-full" onClick={confirm}>
          OK
        </Button>
      </PopoverContent>
    </Popover>
  )
}
