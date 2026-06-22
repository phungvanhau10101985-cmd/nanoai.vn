import { buildWeddingCountdownTarget } from '@/lib/wedding/wedding-countdown-utils'

export type WeddingCalendarEventInput = {
  title: string
  description: string
  location: string
  weddingDateIso: string
  weddingTimeText: string
  partyStartTime?: string
  url?: string
}

const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000

function resolveEventWindow(input: WeddingCalendarEventInput): { start: Date; end: Date } | null {
  const start = buildWeddingCountdownTarget(
    input.weddingDateIso,
    input.weddingTimeText,
    input.partyStartTime,
  )
  if (!start) return null
  return { start, end: new Date(start.getTime() + DEFAULT_DURATION_MS) }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatIcsLocalDateTime(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}T${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
}

function formatGoogleUtcDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function buildWeddingGoogleCalendarUrl(input: WeddingCalendarEventInput): string | null {
  const window = resolveEventWindow(input)
  if (!window) return null
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${formatGoogleUtcDateTime(window.start)}/${formatGoogleUtcDateTime(window.end)}`,
    details: input.description,
    location: input.location,
  })
  if (input.url?.trim()) params.set('sprop', `website:${input.url.trim()}`)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildWeddingIcsContent(input: WeddingCalendarEventInput): string | null {
  const window = resolveEventWindow(input)
  if (!window) return null
  const uid = `wedding-${input.weddingDateIso}-${window.start.getTime()}@nanoai.vn`
  const descriptionParts = [input.description.trim()]
  if (input.url?.trim()) descriptionParts.push(input.url.trim())
  const description = descriptionParts.filter(Boolean).join('\n\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NanoAI//Wedding Invitation//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatGoogleUtcDateTime(new Date())}`,
    `DTSTART:${formatIcsLocalDateTime(window.start)}`,
    `DTEND:${formatIcsLocalDateTime(window.end)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : null,
    input.location.trim() ? `LOCATION:${escapeIcsText(input.location.trim())}` : null,
    input.url?.trim() ? `URL:${escapeIcsText(input.url.trim())}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

export function downloadWeddingIcsFile(input: WeddingCalendarEventInput, filename = 'wedding.ics'): boolean {
  if (typeof window === 'undefined') return false
  const content = buildWeddingIcsContent(input)
  if (!content) return false
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  return true
}

export function buildZaloShareUrl(pageUrl: string): string {
  return `https://zalo.me/share?url=${encodeURIComponent(pageUrl)}`
}
