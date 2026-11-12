'use client'

import { forwardRef, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { committedFieldText, composeAtCaret, planImeEdit, spliceImeStep } from './field-text'
import { usesSystemKeyboard } from './system-keyboard'
import {
  emptyImeSession,
  imeBackspace,
  imeCandidates,
  imeCommitCandidate,
  imeComposition,
  imeFeed,
  imeFlush,
  imeIsEmpty,
  primeKanaLexicon,
  primePinyinLexicon,
  type ImeSession,
  type ImeStep,
} from './engine'

type LocalText = (vi: string, en: string) => string

const SCRIPT_MARK: Record<string, string> = {
  zh: '中',
  ja: 'あ',
  ko: '한',
  th: 'ก',
  hi: 'अ',
  vi: 'VI',
  en: 'EN',
}

const INPUT_LANG: Record<string, string> = {
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
  th: 'th',
  hi: 'hi',
  vi: 'vi',
  en: 'en',
}

const scriptModeByLanguage = new Map<string, boolean>()
const modeListeners = new Set<() => void>()

function scriptModeFor(languageCode: string): boolean {
  return scriptModeByLanguage.get(languageCode) !== false
}

function setScriptModeFor(languageCode: string, next: boolean) {
  scriptModeByLanguage.set(languageCode, next)
  modeListeners.forEach((listener) => listener())
}

function readSystemKeyboard(): boolean {
  if (typeof window === 'undefined') return false
  return usesSystemKeyboard({
    pointerCoarse: window.matchMedia('(pointer: coarse)').matches,
    hoverNone: window.matchMedia('(hover: none)').matches,
    maxTouchPoints: navigator.maxTouchPoints,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  })
}

function useSystemKeyboard() {
  const [systemKeyboard, setSystemKeyboard] = useState(readSystemKeyboard)
  useEffect(() => {
    const pointer = window.matchMedia('(pointer: coarse)')
    const hover = window.matchMedia('(hover: none)')
    const update = () => setSystemKeyboard(readSystemKeyboard())
    update()
    pointer.addEventListener('change', update)
    hover.addEventListener('change', update)
    return () => {
      pointer.removeEventListener('change', update)
      hover.removeEventListener('change', update)
    }
  }, [])
  return systemKeyboard
}

function useScriptMode(languageCode: string) {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const listener = () => setVersion((current) => current + 1)
    modeListeners.add(listener)
    return () => {
      modeListeners.delete(listener)
    }
  }, [])
  void version
  return [scriptModeFor(languageCode), (next: boolean) => setScriptModeFor(languageCode, next)] as const
}

export type LessonImeFieldProps = {
  value: string
  onChange: (value: string) => void
  languageCode: string
  localText: LocalText
  disabled?: boolean
  placeholder?: string
  className?: string
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void
  onPendingChange?: (pending: boolean) => void
  onShownChange?: (shown: string) => void
  flushRef?: { current: (() => string) | null }
  resetKey?: string
  autoFocus?: boolean
}

export const LessonImeField = forwardRef<HTMLInputElement, LessonImeFieldProps>(function LessonImeField(
  {
    value,
    onChange,
    languageCode,
    localText,
    disabled,
    placeholder,
    className,
    enterKeyHint,
    onKeyDown,
    onFocus,
    onPendingChange,
    onShownChange,
    flushRef,
    resetKey,
    autoFocus,
  },
  ref
) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [scriptMode, setScriptMode] = useScriptMode(languageCode)
  const systemKeyboard = useSystemKeyboard()
  const [pinyinTick, setPinyinTick] = useState(0)
  const script = scriptMode && languageCode !== 'en' && !systemKeyboard
  const [session, setSession] = useState<ImeSession>(emptyImeSession)
  const [optimistic, setOptimistic] = useState<string | null>(null)
  const sessionRef = useRef(session)
  const baseRef = useRef(value)
  const caretRef = useRef(0)
  const pinCaretRef = useRef(false)
  const pinningRef = useRef(false)
  const editingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const onShownChangeRef = useRef(onShownChange)
  const previousValueRef = useRef(value)
  sessionRef.current = session
  onChangeRef.current = onChange
  onShownChangeRef.current = onShownChange
  const base = optimistic != null ? optimistic : value
  baseRef.current = base
  const composition = script ? imeComposition(languageCode, session) : ''
  const caretIndex = Math.max(0, Math.min(caretRef.current, base.length))
  const shown = composeAtCaret(base, composition, caretIndex)
  const candidates = script && (languageCode !== 'zh' || pinyinTick > 0) ? imeCandidates(languageCode, session) : []

  useEffect(() => {
    setOptimistic((current) => (current != null && current === value ? null : current))
    if (!value && previousValueRef.current && imeIsEmpty(sessionRef.current)) {
      setSession(emptyImeSession())
      sessionRef.current = emptyImeSession()
      caretRef.current = 0
    }
    previousValueRef.current = value
  }, [value])

  useEffect(() => {
    setSession(emptyImeSession())
    sessionRef.current = emptyImeSession()
    caretRef.current = 0
    setOptimistic(null)
  }, [resetKey])

  useEffect(() => {
    if (systemKeyboard) return
    if (languageCode !== 'zh' && languageCode !== 'ja') return
    let alive = true
    const prime = languageCode === 'zh' ? primePinyinLexicon() : primeKanaLexicon()
    void prime.then(() => {
      if (alive) setPinyinTick((tick) => tick + 1)
    })
    return () => {
      alive = false
    }
  }, [languageCode, systemKeyboard])

  useEffect(() => {
    onPendingChange?.(script && !imeIsEmpty(session))
  }, [onPendingChange, script, session])

  useEffect(() => {
    onShownChangeRef.current?.(languageCode === 'zh' ? base : shown)
  }, [languageCode, base, shown])

  useEffect(() => {
    if (systemKeyboard) {
      editingRef.current = false
      pinCaretRef.current = false
      return
    }
    const node = inputRef.current
    if (!node || document.activeElement !== node) {
      editingRef.current = false
      return
    }
    const compositionText = script ? imeComposition(languageCode, sessionRef.current) : ''
    const pending = Boolean(compositionText) || (script && !imeIsEmpty(sessionRef.current))
    const pin = pinCaretRef.current
    if (pending || pin) {
      const pos = Math.max(0, Math.min(node.value.length, caretRef.current + compositionText.length))
      if (node.selectionStart !== pos || node.selectionEnd !== pos) {
        pinningRef.current = true
        node.setSelectionRange(pos, pos)
        pinningRef.current = false
      }
    }
    pinCaretRef.current = false
    editingRef.current = false
  }, [shown, script, languageCode, systemKeyboard])

  const anchorNow = () => Math.max(0, Math.min(caretRef.current, baseRef.current.length))

  const reportShown = (baseText: string, nextSession: ImeSession, nextCaret: number) => {
    const compositionText = script ? imeComposition(languageCode, nextSession) : ''
    const visible = composeAtCaret(baseText, compositionText, nextCaret)
    onShownChangeRef.current?.(languageCode === 'zh' ? baseText : visible)
  }

  const publish = (nextBase: string, nextSession: ImeSession, nextCaret: number) => {
    const previous = baseRef.current
    const caret = Math.max(0, Math.min(nextBase.length, nextCaret))
    sessionRef.current = nextSession
    caretRef.current = caret
    pinCaretRef.current = true
    setSession(nextSession)
    baseRef.current = nextBase
    if (nextBase !== previous) {
      setOptimistic(nextBase)
      onChangeRef.current(nextBase)
    }
    reportShown(nextBase, nextSession, caret)
  }

  const applyStep = (step: ImeStep) => {
    const spliced = spliceImeStep(baseRef.current, caretRef.current, step)
    publish(spliced.base, step.session, spliced.caret)
    return spliced.base
  }

  const flush = () => {
    const domValue = inputRef.current?.value ?? ''
    const anchor = anchorNow()
    const compositionText = script ? imeComposition(languageCode, sessionRef.current) : ''
    const composed = composeAtCaret(baseRef.current, compositionText, anchor)
    const visible = committedFieldText(domValue, composed)
    if (visible.replacedByKeyboard) {
      const next = visible.text
      const nextCaret = inputRef.current?.selectionStart ?? next.length
      publish(next, emptyImeSession(), nextCaret)
      return next
    }
    if (!script) {
      reportShown(baseRef.current, emptyImeSession(), anchor)
      return baseRef.current
    }
    const step = imeFlush(languageCode, sessionRef.current)
    const next = baseRef.current.slice(0, anchor) + step.commit + baseRef.current.slice(anchor)
    publish(next, step.session, anchor + step.commit.length)
    return next
  }

  if (flushRef) flushRef.current = flush

  useEffect(() => {
    if (!systemKeyboard || imeIsEmpty(sessionRef.current)) return
    const anchor = Math.max(0, Math.min(caretRef.current, baseRef.current.length))
    const step = imeFlush(languageCode, sessionRef.current)
    const next = baseRef.current.slice(0, anchor) + step.commit + baseRef.current.slice(anchor)
    publish(next, emptyImeSession(), anchor + step.commit.length)
  }, [systemKeyboard, languageCode])

  const applyPlan = (next: string) => {
    const compositionText = imeComposition(languageCode, sessionRef.current)
    const plan = planImeEdit({
      base: baseRef.current,
      composition: compositionText,
      caret: anchorNow(),
      next,
    })
    if (plan.kind === 'noop') return
    if (plan.kind === 'clear') {
      publish('', emptyImeSession(), 0)
      return
    }
    if (plan.kind === 'feed-at') {
      caretRef.current = plan.caret
      if (plan.text) applyStep(imeFeed(languageCode, emptyImeSession(), plan.text))
      return
    }
    if (plan.kind === 'feed') {
      if (plan.text) applyStep(imeFeed(languageCode, sessionRef.current, plan.text))
      return
    }
    if (plan.kind === 'backspace') {
      let current = sessionRef.current
      for (let i = 0; i < plan.times; i += 1) {
        const step = imeBackspace(languageCode, current)
        applyStep(step)
        current = step.session
      }
      return
    }
    if (plan.kind === 'rebuild-composition') {
      if (!plan.text) {
        publish(baseRef.current, emptyImeSession(), anchorNow())
        return
      }
      applyStep(imeFeed(languageCode, emptyImeSession(), plan.text))
      return
    }
    if (plan.kind === 'delete-range' || plan.kind === 'delete-committed') {
      const nextBase = baseRef.current.slice(0, plan.start) + baseRef.current.slice(plan.end)
      const nextCaret = plan.kind === 'delete-committed' ? plan.caret : plan.start
      const nextSession = plan.kind === 'delete-committed' ? sessionRef.current : emptyImeSession()
      publish(nextBase, nextSession, nextCaret)
      return
    }
    if (plan.kind === 'replace-range') {
      const cleared = baseRef.current.slice(0, plan.start) + baseRef.current.slice(plan.end)
      if (!plan.inserted) {
        publish(cleared, emptyImeSession(), plan.start)
        return
      }
      const step = imeFeed(languageCode, emptyImeSession(), plan.inserted)
      const spliced = spliceImeStep(cleared, plan.start, step)
      publish(spliced.base, step.session, spliced.caret)
      return
    }
    if (plan.kind === 'commit-then-insert') {
      const anchor = anchorNow()
      const step = imeFlush(languageCode, sessionRef.current)
      const committed = baseRef.current.slice(0, anchor) + step.commit + baseRef.current.slice(anchor)
      const insertAt = plan.afterAnchor ? plan.insertAt + step.commit.length : plan.insertAt
      publish(committed, step.session, insertAt)
      if (plan.text) applyStep(imeFeed(languageCode, step.session, plan.text))
      return
    }
    const pos = inputRef.current?.selectionStart ?? plan.caret
    publish(plan.text, emptyImeSession(), pos)
  }

  const handleChange = (next: string) => {
    editingRef.current = true
    if (!script) {
      sessionRef.current = emptyImeSession()
      setSession(emptyImeSession())
      caretRef.current = inputRef.current?.selectionStart ?? next.length
      setOptimistic(next)
      onChangeRef.current(next)
      return
    }
    applyPlan(next)
  }

  const moveCaret = (node: HTMLInputElement) => {
    const pos = node.selectionStart ?? 0
    const end = node.selectionEnd ?? pos
    if (pos !== end) return
    const compositionText = script ? imeComposition(languageCode, sessionRef.current) : ''
    if (!compositionText) {
      caretRef.current = pos
      return
    }
    const anchor = anchorNow()
    const compEnd = anchor + compositionText.length
    if (pos >= anchor && pos <= compEnd) return
    if (node.selectionStart === compEnd && node.selectionEnd === compEnd) return
    pinningRef.current = true
    node.setSelectionRange(compEnd, compEnd)
    pinningRef.current = false
  }

  const usingLabel = localText('Đang dùng bộ gõ. Bấm để gõ Latin', 'Using the language keyboard. Tap to type Latin')
  const latinLabel = localText('Đang gõ Latin. Bấm để dùng bộ gõ', 'Typing Latin. Tap to use the language keyboard')

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      {candidates.length ? (
        <div className="absolute bottom-full left-0 z-20 mb-1 flex max-w-full gap-1 overflow-x-auto rounded-md border border-slate-200 bg-white p-1 shadow-md">
          {candidates.map((candidate, index) => (
            <button
              key={`${candidate}-${index}`}
              type="button"
              className={cn(
                'inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-md px-2.5 text-base',
                index === 0 ? 'bg-violet-600 font-semibold text-white' : 'bg-slate-50 text-slate-800'
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyStep(imeCommitCandidate(languageCode, sessionRef.current, index))}
            >
              <span className="mr-1 text-xs opacity-70">{index + 1}</span>
              {candidate}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          ref={(node) => {
            inputRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          value={shown}
          onChange={(event) => handleChange(event.target.value)}
          onSelect={(event) => {
            if (editingRef.current || pinningRef.current) return
            moveCaret(event.currentTarget)
          }}
          onKeyDown={(event) => {
            if (script && event.key === 'Enter' && !imeIsEmpty(sessionRef.current)) {
              event.preventDefault()
              flush()
            }
            onKeyDown?.(event)
          }}
          onFocus={onFocus}
          disabled={disabled}
          placeholder={placeholder}
          enterKeyHint={enterKeyHint}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          lang={script || systemKeyboard ? INPUT_LANG[languageCode] || 'en' : 'en'}
          autoFocus={autoFocus}
          className={cn('h-11 min-h-11 min-w-0 flex-1 touch-manipulation text-base md:text-base', className)}
        />
        {systemKeyboard ? null : (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={scriptMode}
            aria-label={scriptMode ? usingLabel : latinLabel}
            title={scriptMode ? usingLabel : latinLabel}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (scriptMode) flush()
              setScriptMode(!scriptMode)
            }}
            className={cn(
              'inline-flex h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-md border px-2 text-sm font-semibold',
              scriptMode ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-300 bg-white text-slate-700'
            )}
          >
            {scriptMode ? SCRIPT_MARK[languageCode] || 'A' : 'A'}
          </button>
        )}
      </div>
    </div>
  )
})
