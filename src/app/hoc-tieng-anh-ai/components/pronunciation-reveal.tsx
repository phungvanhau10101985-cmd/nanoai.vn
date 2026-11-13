'use client'

import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { pairedReading } from '@/lib/coach-reading'
import { ProcessingIcon } from './processing-status'
import { Switch } from '@/components/ui/switch'
import type { LocalTextFn } from './types'

let showAllPronunciations = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return showAllPronunciations
}

function setShowAllPronunciations(next: boolean) {
  if (showAllPronunciations === next) return
  showAllPronunciations = next
  listeners.forEach((listener) => listener())
}

function useShowAllPronunciations() {
  const showAll = useSyncExternalStore(subscribe, getSnapshot, () => false)
  return [showAll, setShowAllPronunciations] as const
}

/** Công tắc một lần cho mọi dòng phát âm trong buổi học. */
export function PronunciationMasterSwitch({
  localText,
  compact = false,
  labeled = false,
  above = false,
}: {
  localText: LocalTextFn
  compact?: boolean
  labeled?: boolean
  above?: boolean
}) {
  const [showAll, setShowAll] = useShowAllPronunciations()
  return (
    <label
      title={localText('Hiện mọi phiên âm', 'Show all pronunciations')}
      className={above
        ? 'inline-flex h-11 shrink-0 cursor-pointer touch-manipulation items-center gap-1.5'
        : compact
      ? `order-2 flex h-11 shrink-0 cursor-pointer touch-manipulation items-center gap-1 rounded-md ${labeled ? 'ml-auto' : ''}`
      : 'flex min-h-11 min-w-0 flex-1 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-md px-1'}>
      <span className={compact && !labeled ? 'hidden text-xs leading-tight text-slate-600 sm:inline' : 'whitespace-nowrap text-xs font-medium leading-tight text-slate-600'}>
        {above
          ? localText('Phiên âm', 'Pronunciation')
          : labeled ? (
          <>
            <span className="sm:hidden">{localText('Phiên âm', 'Pronunciation')}</span>
            <span className="hidden sm:inline">{localText('Mọi phiên âm', 'All pronunciations')}</span>
          </>
        ) : localText('Mọi phiên âm', 'All pronunciations')}
      </span>
      <Switch
        checked={showAll}
        onCheckedChange={setShowAll}
        aria-label={localText('Hiện mọi phiên âm', 'Show all pronunciations')}
        className="touch-manipulation"
      />
    </label>
  )
}

function pairedPlain(source: string, reading: string): string {
  const parts = pairedReading(source, reading)
  if (!parts.length) return reading
  return parts.map((part) => (
    part.kind === 'gap' ? part.text : `${part.text}${part.reading ? `(${part.reading})` : ''}`
  )).join('')
}

function maskReading(value: string): string {
  return Array.from(value).map((ch) => (/\s/u.test(ch) ? ch : '•')).join('')
}

function PairedReadingText({ source, reading }: { source: string; reading: string }) {
  const parts = pairedReading(source, reading)
  if (!parts.length) return <>{reading}</>
  return (
    <>
      {parts.map((part, index) => (
        part.kind === 'gap' ? (
          <span key={index}>{part.text}</span>
        ) : (
          <span key={index}>
            {part.text}
            {part.reading ? <span className="text-violet-700 dark:text-violet-300">({part.reading})</span> : null}
          </span>
        )
      ))}
    </>
  )
}

/** Hai trạng thái: hiện từ(âm), hoặc che cả dòng bằng chấm như mật khẩu. */
export function PronunciationReveal({
  localText,
  reading,
  source = '',
  busy = false,
  lineKey = '',
  actions = null,
}: {
  localText: LocalTextFn
  reading: string
  source?: string
  busy?: boolean
  lineKey?: string
  actions?: ReactNode
}) {
  const [showAll] = useShowAllPronunciations()
  const value = String(reading || '').trim()
  const [masked, setMasked] = useState(() => !showAll)
  const [seenKey, setSeenKey] = useState(lineKey)
  const [seenShowAll, setSeenShowAll] = useState(showAll)
  if (lineKey !== seenKey) {
    setSeenKey(lineKey)
    setMasked(!showAll)
  }
  if (showAll !== seenShowAll) {
    setSeenShowAll(showAll)
    setMasked(!showAll)
  }
  if (!value && !busy) return null
  const shown = Boolean(value) && !masked
  return (
    <div className="mt-0.5 flex items-start gap-1">
      {value ? (
        <p className="min-w-0 flex-1 break-words leading-relaxed">
          {shown ? (
            <PairedReadingText source={source} reading={value} />
          ) : (
            <span className="select-none break-words tracking-wide text-muted-foreground [-webkit-touch-callout:none]">
              {maskReading(pairedPlain(source, value))}
            </span>
          )}
          {actions ? <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">{actions}</span> : null}
        </p>
      ) : actions}
      {busy && !value ? (
        <span className="inline-flex h-11 items-center gap-1 text-sm text-slate-500">
          <ProcessingIcon />
          {localText('Đang tạo...', 'Generating...')}
        </span>
      ) : null}
      {value ? (
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-pressed={shown}
          aria-label={shown ? localText('Ẩn phát âm', 'Hide pronunciation') : localText('Hiện phát âm', 'Show pronunciation')}
          title={shown ? localText('Ẩn phát âm', 'Hide pronunciation') : localText('Hiện phát âm', 'Show pronunciation')}
          onClick={(event) => {
            event.stopPropagation()
            setMasked((current) => !current)
          }}
        >
          {shown ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  )
}
