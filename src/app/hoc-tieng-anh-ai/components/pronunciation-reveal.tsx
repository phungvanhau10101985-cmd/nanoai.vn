'use client'

import { useState, useSyncExternalStore } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { ProcessingIcon } from './processing-status'
import { Switch } from '@/components/ui/switch'
import type { LocalTextFn } from './types'

function maskReading(value: string): string {
  return Array.from(value).map((ch) => (/\s/u.test(ch) ? ch : '•')).join('')
}

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
export function PronunciationMasterSwitch({ localText, compact = false, labeled = false }: { localText: LocalTextFn; compact?: boolean; labeled?: boolean }) {
  const [showAll, setShowAll] = useShowAllPronunciations()
  return (
    <label
      title={localText('Hiện mọi phiên âm', 'Show all pronunciations')}
      className={compact
      ? `order-2 flex h-11 shrink-0 cursor-pointer touch-manipulation items-center gap-1 rounded-md ${labeled ? 'ml-auto' : ''}`
      : 'flex min-h-11 min-w-0 flex-1 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-md px-1'}>
      <span className={compact && !labeled ? 'hidden text-xs leading-tight text-slate-600 sm:inline' : 'whitespace-nowrap text-xs font-medium leading-tight text-slate-600'}>
        {labeled ? (
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

/** Dòng phát âm luôn hiện. Lúc ẩn thì che bằng chấm như mật khẩu. Icon mắt chỉ mở đúng dòng này. */
export function PronunciationReveal({
  localText,
  reading,
  busy = false,
  lineKey = '',
}: {
  localText: LocalTextFn
  reading: string
  busy?: boolean
  lineKey?: string
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
      <p className="min-w-0 flex-1 break-words text-muted-foreground leading-relaxed">
        <span className="font-semibold text-slate-800">{localText('Phát âm:', 'Pronunciation:')}</span>{' '}
        {busy && !value ? (
          localText('Đang tạo...', 'Generating...')
        ) : (
          <span className={shown ? 'break-words' : 'select-none break-words tracking-wide [-webkit-touch-callout:none]'}>{shown ? value : maskReading(value)}</span>
        )}
      </p>
      {busy && !value ? (
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-slate-500">
          <ProcessingIcon />
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
