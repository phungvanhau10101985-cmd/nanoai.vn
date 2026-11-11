'use client'

import { forwardRef, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
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
  const [pinyinTick, setPinyinTick] = useState(0)
  const script = scriptMode && languageCode !== 'en'
  const [session, setSession] = useState<ImeSession>(emptyImeSession)
  const [optimistic, setOptimistic] = useState<string | null>(null)
  const sessionRef = useRef(session)
  const baseRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onShownChangeRef = useRef(onShownChange)
  const previousValueRef = useRef(value)
  sessionRef.current = session
  onChangeRef.current = onChange
  onShownChangeRef.current = onShownChange
  const base = optimistic != null ? optimistic : value
  baseRef.current = base
  const composition = script ? imeComposition(languageCode, session) : ''
  const shown = `${base}${composition}`
  const candidates = script && (languageCode !== 'zh' || pinyinTick > 0) ? imeCandidates(languageCode, session) : []

  useEffect(() => {
    setOptimistic((current) => (current != null && current === value ? null : current))
    if (!value && previousValueRef.current) {
      setSession(emptyImeSession())
      sessionRef.current = emptyImeSession()
    }
    previousValueRef.current = value
  }, [value])

  useEffect(() => {
    setSession(emptyImeSession())
    sessionRef.current = emptyImeSession()
    setOptimistic(null)
  }, [resetKey])

  useEffect(() => {
    if (languageCode !== 'zh' && languageCode !== 'ja') return
    let alive = true
    const prime = languageCode === 'zh' ? primePinyinLexicon() : primeKanaLexicon()
    void prime.then(() => {
      if (alive) setPinyinTick((tick) => tick + 1)
    })
    return () => {
      alive = false
    }
  }, [languageCode])

  useEffect(() => {
    onPendingChange?.(script && !imeIsEmpty(session))
  }, [onPendingChange, script, session])

  useEffect(() => {
    onShownChangeRef.current?.(languageCode === 'zh' ? base : shown)
  }, [languageCode, base, shown])

  useEffect(() => {
    const node = inputRef.current
    if (!node || document.activeElement !== node || imeIsEmpty(sessionRef.current)) return
    const end = node.value.length
    node.setSelectionRange(end, end)
  }, [shown])

  const reportShown = (baseText: string, nextSession: ImeSession) => {
    const compositionText = script ? imeComposition(languageCode, nextSession) : ''
    onShownChangeRef.current?.(languageCode === 'zh' ? baseText : `${baseText}${compositionText}`)
  }

  const publish = (nextBase: string, nextSession: ImeSession) => {
    const previous = baseRef.current
    sessionRef.current = nextSession
    setSession(nextSession)
    baseRef.current = nextBase
    if (nextBase !== previous) {
      setOptimistic(nextBase)
      onChangeRef.current(nextBase)
    }
    reportShown(nextBase, nextSession)
  }

  const applyStep = (step: ImeStep) => {
    const current = baseRef.current
    const nextBase = current.slice(0, Math.max(0, current.length - step.replace)) + step.commit
    publish(nextBase, step.session)
    return nextBase
  }

  const flush = () => {
    if (!script) {
      reportShown(baseRef.current, emptyImeSession())
      return baseRef.current
    }
    const step = imeFlush(languageCode, sessionRef.current)
    const next = baseRef.current + step.commit
    sessionRef.current = step.session
    setSession(step.session)
    baseRef.current = next
    setOptimistic(next)
    onChangeRef.current(next)
    reportShown(next, step.session)
    return next
  }

  if (flushRef) flushRef.current = flush

  const handleChange = (next: string) => {
    if (!script) {
      sessionRef.current = emptyImeSession()
      setSession(emptyImeSession())
      setOptimistic(next)
      onChangeRef.current(next)
      return
    }
    const currentShown = `${baseRef.current}${imeComposition(languageCode, sessionRef.current)}`
    if (next === currentShown) return
    if (!next) {
      publish('', emptyImeSession())
      return
    }
    if (imeIsEmpty(sessionRef.current) && next.startsWith(baseRef.current)) {
      applyStep(imeFeed(languageCode, sessionRef.current, next.slice(baseRef.current.length)))
      return
    }
    if (next.startsWith(currentShown)) {
      applyStep(imeFeed(languageCode, sessionRef.current, next.slice(currentShown.length)))
      return
    }
    if (currentShown.startsWith(next)) {
      let times = currentShown.length - next.length
      let currentSession = sessionRef.current
      while (times > 0) {
        const step = imeBackspace(languageCode, currentSession)
        const current = baseRef.current
        const nextBase = current.slice(0, Math.max(0, current.length - step.replace)) + step.commit
        baseRef.current = nextBase
        currentSession = step.session
        sessionRef.current = currentSession
        if (nextBase !== current) onChangeRef.current(nextBase)
        times -= 1
      }
      setSession(currentSession)
      setOptimistic(baseRef.current)
      reportShown(baseRef.current, currentSession)
      return
    }
    let shared = 0
    const limit = Math.min(currentShown.length, next.length)
    while (shared < limit && currentShown[shared] === next[shared]) shared += 1
    if (shared === 0) {
      sessionRef.current = emptyImeSession()
      baseRef.current = ''
      setSession(emptyImeSession())
      setOptimistic('')
      onChangeRef.current('')
      if (next) applyStep(imeFeed(languageCode, emptyImeSession(), next))
      else reportShown('', emptyImeSession())
      return
    }
    let shownEnd = currentShown.length
    let nextEnd = next.length
    while (shownEnd > shared && nextEnd > shared && currentShown[shownEnd - 1] === next[nextEnd - 1]) {
      shownEnd -= 1
      nextEnd -= 1
    }
    if (next.slice(nextEnd)) {
      publish(next, emptyImeSession())
      return
    }
    const inserted = next.slice(shared, nextEnd)
    const keep = shared <= baseRef.current.length ? next.slice(0, shared) : baseRef.current
    const extra = (shared > baseRef.current.length ? next.slice(baseRef.current.length, shared) : '') + inserted
    baseRef.current = keep
    sessionRef.current = emptyImeSession()
    setSession(emptyImeSession())
    setOptimistic(keep)
    onChangeRef.current(keep)
    if (extra) applyStep(imeFeed(languageCode, emptyImeSession(), extra))
    else reportShown(keep, emptyImeSession())
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
          lang={script ? INPUT_LANG[languageCode] || 'en' : 'en'}
          autoFocus={autoFocus}
          className={cn('h-11 min-h-11 min-w-0 flex-1 touch-manipulation text-base md:text-base', className)}
        />
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
      </div>
    </div>
  )
})
