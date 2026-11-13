'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { RotateCcw, Volume2 } from 'lucide-react'
import { ProcessingRow } from './processing-status'
import { LessonImeField } from '../ime/lesson-ime-field'
import { Button } from '@/components/ui/button'

type LocalText = (vi: string, en: string) => string

function readPhone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 1023px)').matches
}

function dockTopAboveKeyboard(dockHeight: number) {
  const viewport = window.visualViewport
  const offset = viewport?.offsetTop ?? 0
  const visual = viewport?.height ?? window.innerHeight
  return Math.max(0, Math.round(offset + visual - Math.max(0, dockHeight)))
}

const BOTTOM_BAR = 'nav, footer, [class~="sticky"], [class~="fixed"]'

/** Thanh dính đáy không được nằm giữa ô nghĩa và bàn phím. */
function parkBottomBars(field: HTMLElement, parked: HTMLElement[]) {
  const visualHeight = window.visualViewport?.height ?? window.innerHeight
  document.querySelectorAll<HTMLElement>(BOTTOM_BAR).forEach((node) => {
    if (!node.isConnected || node.contains(field) || field.contains(node)) return
    if (node.closest('[data-keyboard-dock],[data-keyboard-sheet],[data-nanoai-widget-root]')) return
    const position = getComputedStyle(node).position
    if (position !== 'fixed' && position !== 'sticky') return
    const rect = node.getBoundingClientRect()
    if (rect.height < 8 || rect.height > visualHeight * 0.5) return
    const nearBottom = rect.bottom >= visualHeight - 180 || rect.bottom >= window.innerHeight - 180
    if (!nearBottom) return
    if (node.dataset.keyboardParked !== '1') {
      node.dataset.keyboardParked = '1'
      node.dataset.keyboardSavedDisplay = node.style.display
      parked.push(node)
    }
    node.style.display = 'none'
  })
}

function unparkBottomBars(parked: HTMLElement[]) {
  parked.forEach((node) => {
    node.style.display = node.dataset.keyboardSavedDisplay ?? ''
    delete node.dataset.keyboardParked
    delete node.dataset.keyboardSavedDisplay
  })
  parked.length = 0
}

export function SpeechIntentConfirm({
  text,
  meaning,
  meaningBusy,
  continueBusy,
  onContinue,
  onReplay,
  onRecordAgain,
  localText,
  nativeLanguageCode = '',
}: {
  text: string
  meaning: string
  meaningBusy: boolean
  continueBusy: boolean
  onContinue: (learnerMeaning: string) => void
  onReplay?: () => void
  onRecordAgain?: () => void
  localText: LocalText
  nativeLanguageCode?: string
}) {
  const flushRef = useRef<(() => string) | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)
  const [meaningDraft, setMeaningDraft] = useState('')
  const [phone, setPhone] = useState(readPhone)
  const [dockTop, setDockTop] = useState(() => (readPhone() ? dockTopAboveKeyboard(96) : 0))
  const [spacerHeight, setSpacerHeight] = useState(0)
  const label = localText('Có phải em muốn nói', 'Is this what you meant')
  const meaningLabel = localText('Nghĩa tiếng mẹ đẻ, có thể để trống', 'Native meaning, optional')
  const meaningPlaceholder = localText(
    'Để trống nếu nghĩa bên trên đã đúng',
    'Leave blank if the meaning above is right',
  )
  const meaningLanguage = nativeLanguageCode || 'en'

  useLayoutEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const sync = () => setPhone(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useLayoutEffect(() => {
    if (!phone) {
      setSpacerHeight(0)
      return
    }
    const parked: HTMLElement[] = []
    let timers: number[] = []
    const sync = () => {
      const dock = dockRef.current
      const height = Math.round(dock?.getBoundingClientRect().height ?? 0)
      const nextTop = dockTopAboveKeyboard(height)
      setDockTop((prev) => (prev === nextTop ? prev : nextTop))
      setSpacerHeight((prev) => (prev === height ? prev : height))
      const field = inputRef.current
      if (field) parkBottomBars(field, parked)
    }
    const schedule = () => {
      sync()
      timers.forEach((id) => window.clearTimeout(id))
      timers = [80, 200, 400, 700].map((delay) => window.setTimeout(sync, delay))
    }
    schedule()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', sync)
    window.addEventListener('orientationchange', schedule)
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      unparkBottomBars(parked)
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', sync)
      window.removeEventListener('orientationchange', schedule)
    }
  }, [phone])

  const continueWith = () => {
    const flushed = (flushRef.current?.() ?? inputRef.current?.value ?? meaningDraft).trim()
    inputRef.current?.blur()
    onContinue(flushed)
  }

  const meaningLine = meaningBusy ? (
    <ProcessingRow className="text-sm leading-relaxed text-slate-700">
      {localText('Đang dịch...', 'Translating...')}
    </ProcessingRow>
  ) : meaning ? (
    <p className="text-sm leading-relaxed text-slate-700">{meaning}</p>
  ) : null

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-emerald-800">{label}</p>
      <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-base leading-relaxed text-slate-900">
        {text}
      </p>
      {meaningLine}
      {phone ? <div aria-hidden style={{ height: spacerHeight }} /> : null}
      <div
        ref={dockRef}
        data-keyboard-dock=""
        className={
          phone
            ? 'fixed left-0 right-0 z-[90] border-t border-emerald-200 bg-white px-3 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.16)]'
            : ''
        }
        style={phone ? { top: dockTop, paddingBottom: 8 } : undefined}
      >
        <p className="mb-1 text-xs text-slate-600">{meaningLabel}</p>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <LessonImeField
              ref={inputRef}
              value={meaningDraft}
              onChange={setMeaningDraft}
              languageCode={meaningLanguage}
              localText={localText}
              flushRef={flushRef}
              disabled={continueBusy}
              placeholder={meaningPlaceholder}
              className="bg-white text-slate-900"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onMouseDown={(event) => event.preventDefault()}
            onClick={continueWith}
            disabled={continueBusy || !text.trim()}
            className="h-11 min-h-11 shrink-0 whitespace-nowrap px-3.5 text-sm font-semibold"
          >
            {localText('Tiếp', 'Continue')}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onReplay ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onReplay}
            disabled={continueBusy}
            className="min-h-[40px] bg-white px-4"
          >
            <Volume2 className="mr-2 h-4 w-4" />
            {localText('Nghe lại', 'Play back')}
          </Button>
        ) : null}
        {onRecordAgain ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRecordAgain}
            disabled={continueBusy}
            className="min-h-[40px] bg-white px-4"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {localText('Nói lại', 'Record again')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
