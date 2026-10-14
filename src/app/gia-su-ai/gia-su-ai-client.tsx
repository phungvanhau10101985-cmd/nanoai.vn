'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useMobileToolChatFrame } from '@/hooks/use-mobile-tool-chat-frame'
import { Check, Loader2 } from 'lucide-react'
import { StudyCacheMark } from '@/components/student-study/study-cache-mark'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { StudyChatThreadBar } from '@/components/student-study/study-chat-thread-bar'
import type { WebLocale } from '@/lib/i18n/config'
import { aiTutorCopy } from '@/lib/ai-tutor/ai-tutor-copy'
import { tutorNextBubbleDelayMs, tutorReplyBubbles, tutorReplyHoldMs } from '@/lib/ai-tutor/ai-tutor-pace'
import type { TutorAnswer, TutorSessionSummary, TutorThreadMessage } from '@/lib/ai-tutor/ai-tutor-types'
import {
  listTutorHistory,
  loadTutorThread,
  openTutorHistoryThread,
  openTutorLabelAction,
  sendTutorQuestion,
  startTutorThread,
} from '@/app/gia-su-ai/actions'
import { StudentStudyPaywall } from '@/components/student-study/student-study-paywall'
import {
  revealStudyComposer,
  scheduleStudyComposerReveal,
  STUDY_CHAT_SHELL_CLASS,
} from '@/lib/study-chat-frame'

type Props = {
  locale: WebLocale
}

type TutorChatLine = TutorThreadMessage & {
  bubbleSection?: 'explain' | 'practice'
  showHeading?: boolean
  showSectionLabel?: boolean
  showLabels?: boolean
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function linesFromStored(messages: TutorThreadMessage[]): TutorChatLine[] {
  const lines: TutorChatLine[] = []
  for (const message of messages) {
    if (message.role !== 'tutor' || !message.answer) {
      lines.push(message)
      continue
    }
    const bubbles = tutorReplyBubbles(message.answer)
    if (bubbles.length === 0) {
      lines.push(message)
      continue
    }
    bubbles.forEach((bubble, index) => {
      lines.push({
        ...message,
        id: bubbles.length === 1 ? message.id : `${message.id}:${index}`,
        body: bubble.text,
        bubbleSection: bubble.section,
        showHeading: index === 0,
        showSectionLabel: bubbles.findIndex((item) => item.section === bubble.section) === index,
        showLabels: index === bubbles.length - 1,
      })
    })
  }
  return lines
}

function bubbleLine(answer: TutorAnswer, index: number, bubbles: ReturnType<typeof tutorReplyBubbles>): TutorChatLine {
  const bubble = bubbles[index]
  return {
    id: localId(),
    role: 'tutor',
    body: bubble.text,
    topicKey: answer.topicKey,
    kind: 'answer',
    answer,
    createdAt: new Date().toISOString(),
    bubbleSection: bubble.section,
    showHeading: index === 0,
    showSectionLabel: bubbles.findIndex((item) => item.section === bubble.section) === index,
    showLabels: index === bubbles.length - 1,
  }
}

function formatTutorWhen(iso: string, locale: WebLocale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

function localId(): string {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function userTurn(body: string, kind: 'question' | 'label'): TutorThreadMessage {
  return {
    id: localId(),
    role: 'user',
    body,
    topicKey: '',
    kind,
    answer: null,
    createdAt: new Date().toISOString(),
  }
}

function tutorTurn(answer: TutorAnswer): TutorThreadMessage {
  return {
    id: localId(),
    role: 'tutor',
    body: answer.explanation,
    topicKey: answer.topicKey,
    kind: 'answer',
    answer,
    createdAt: new Date().toISOString(),
  }
}

function TeacherReplying({ label }: { label: string }) {
  return (
    <article
      className="flex max-w-[92%] items-center gap-1.5 rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-label={`${label}…`}
    >
      <span>{label}</span>
      <span className="inline-flex items-end gap-px pl-0.5 text-base font-semibold leading-none text-foreground" aria-hidden>
        <span className="inline-block animate-bounce [animation-delay:0ms]">.</span>
        <span className="inline-block animate-bounce [animation-delay:150ms]">.</span>
        <span className="inline-block animate-bounce [animation-delay:300ms]">.</span>
      </span>
    </article>
  )
}

export default function GiaSuAiClient({ locale }: Props) {
  const copy = aiTutorCopy(locale)
  const [messages, setMessages] = useState<TutorChatLine[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [needsPlan, setNeedsPlan] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [sessions, setSessions] = useState<TutorSessionSummary[]>([])
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const cancelRevealRef = useRef<(() => void) | null>(null)
  const busyRef = useRef(false)
  const frame = useMobileToolChatFrame()

  useEffect(() => () => cancelRevealRef.current?.(), [])

  function placeComposer() {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollTop = scroller.scrollHeight
    revealStudyComposer(composerRef.current)
  }

  function placeComposerSoon() {
    cancelRevealRef.current?.()
    placeComposer()
    cancelRevealRef.current = scheduleStudyComposerReveal(placeComposer)
  }

  useEffect(() => {
    let cancelled = false
    void loadTutorThread(locale).then((result) => {
      if (cancelled) return
      if (result.ok) {
        if (!busyRef.current) {
          setNeedsPlan(false)
          setSessionId(result.data.sessionId)
          setMessages(linesFromStored(result.data.messages))
        }
      } else if (result.code === 'payment_required') {
        setNeedsPlan(true)
        setError('')
      } else setError(copy.errors[result.code])
      setReady(true)
    }).catch(() => {
      if (cancelled) return
      setError(copy.errors.ai_unavailable)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [copy.errors, locale, reloadKey])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollTo({ top: scroller.scrollHeight })
  }, [messages, busy])

  async function ask(
    pending: TutorThreadMessage,
    run: () => Promise<{ ok: true; data: TutorAnswer } | { ok: false; code: keyof typeof copy.errors }>,
    restore?: () => void
  ) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setMessages((current) => [...current, pending])
    const startedAt = Date.now()
    const result = await run()
    if (!result.ok) {
      setMessages((current) => current.filter((message) => message.id !== pending.id))
      restore?.()
      if (result.code === 'payment_required') {
        setNeedsPlan(true)
        setError('')
      } else setError(copy.errors[result.code])
      busyRef.current = false
      setBusy(false)
      return
    }
    const hold = tutorReplyHoldMs(startedAt, Date.now())
    if (hold > 0) await sleep(hold)
    const bubbles = tutorReplyBubbles(result.data)
    if (bubbles.length === 0) {
      setMessages((current) => [...current, tutorTurn(result.data)])
    } else {
      for (let index = 0; index < bubbles.length; index += 1) {
        if (index > 0) await sleep(tutorNextBubbleDelayMs(bubbles[index - 1].text))
        const line = bubbleLine(result.data, index, bubbles)
        setMessages((current) => [...current, line])
      }
    }
    busyRef.current = false
    setBusy(false)
  }

  async function send() {
    const question = text.trim()
    if (!question || busyRef.current) {
      if (!question) setError(copy.errors.missing_text)
      return
    }
    setText('')
    await ask(userTurn(question, 'question'), () => sendTutorQuestion({ locale, text: question }), () => setText(question))
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const result = await listTutorHistory()
      if (!result.ok) {
        setError(copy.errors[result.code])
        setSessions([])
        return
      }
      setSessions(result.data)
    } catch {
      setError(copy.errors.ai_unavailable)
      setSessions([])
    } finally {
      setHistoryLoading(false)
    }
  }, [copy.errors])

  async function beginNewThread() {
    if (busyRef.current) return
    setError('')
    flushSync(() => setHistoryOpen(false))
    placeComposer()
    let result: Awaited<ReturnType<typeof startTutorThread>>
    try {
      result = await startTutorThread(locale)
    } catch {
      setError(copy.errors.ai_unavailable)
      placeComposerSoon()
      return
    }
    if (!result.ok) {
      if (result.code === 'payment_required') {
        setNeedsPlan(true)
        setError('')
      } else setError(copy.errors[result.code])
      return
    }
    setSessionId(result.data.sessionId)
    setMessages([])
    setText('')
    placeComposerSoon()
  }

  async function openHistory() {
    setHistoryOpen(true)
    await loadHistory()
  }

  async function openSavedThread(id: string) {
    flushSync(() => setHistoryOpen(false))
    placeComposer()
    if (busyRef.current || id === sessionId) return
    setError('')
    let result: Awaited<ReturnType<typeof openTutorHistoryThread>>
    try {
      result = await openTutorHistoryThread(id)
    } catch {
      setError(copy.errors.ai_unavailable)
      placeComposerSoon()
      return
    }
    if (!result.ok) {
      if (result.code === 'payment_required') {
        setNeedsPlan(true)
        setError('')
      } else setError(copy.errors[result.code])
      return
    }
    setSessionId(result.data.sessionId)
    setMessages(linesFromStored(result.data.messages))
    setText('')
    placeComposerSoon()
  }

  async function openLabel(labelKey: string, title: string) {
    if (busyRef.current) return
    await ask(userTurn(title, 'label'), () => openTutorLabelAction({ locale, labelKey, title }))
  }

  const shellClass = STUDY_CHAT_SHELL_CLASS
  const shellStyle = frame
    ? {
        ...(frame.top > 0 ? { top: frame.top } : {}),
        ...(frame.bottom != null ? { bottom: frame.bottom } : {}),
      }
    : undefined

  if (!ready) {
    return <div className={shellClass} style={shellStyle} aria-busy="true" />
  }

  if (needsPlan) {
    return (
      <div className={shellClass} style={shellStyle}>
        <StudentStudyPaywall locale={locale} onPurchased={() => setReloadKey((n) => n + 1)} />
      </div>
    )
  }

  return (
    <div className={shellClass} style={shellStyle} data-study-chat="">
      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <p className="text-sm leading-6 text-muted-foreground">{copy.intro}</p>
          {ready && messages.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">{copy.empty}</p>
          ) : null}
          {messages.map((message) =>
            message.role === 'user' ? (
              <p
                key={message.id}
                className="ml-auto max-w-[85%] rounded-2xl bg-primary/10 px-3 py-2 text-sm leading-6"
              >
                {message.body}
              </p>
            ) : (
              <article key={message.id} className="max-w-[92%] space-y-3 rounded-xl border bg-background p-4">
                {message.showHeading !== false &&
                (message.answer?.title || (message.answer && message.answer.share !== 'private')) ? (
                  <div className="flex items-center gap-1.5">
                    {message.answer?.title ? (
                      <h2 className="text-base font-semibold">{message.answer.title}</h2>
                    ) : null}
                    {message.answer?.share === 'reused' ? (
                      <StudyCacheMark label={copy.share.reused} />
                    ) : message.answer?.share === 'saved' ? (
                      <Check
                        className="h-4 w-4 shrink-0 text-green-600"
                        strokeWidth={3}
                        role="img"
                        aria-label={copy.share.saved}
                      />
                    ) : null}
                  </div>
                ) : null}
                {message.bubbleSection ? (
                  <section
                    className={
                      message.bubbleSection === 'practice' ? 'space-y-1 rounded-lg bg-muted p-3' : 'space-y-1'
                    }
                  >
                    {message.showSectionLabel ? (
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {message.bubbleSection === 'practice' ? copy.practice : copy.explain}
                      </h3>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                  </section>
                ) : (
                  <>
                    <section className="space-y-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {copy.explain}
                      </h3>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {message.answer?.explanation || message.body}
                      </p>
                    </section>
                    {message.answer?.practice ? (
                      <section className="space-y-1 rounded-lg bg-muted p-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {copy.practice}
                        </h3>
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.answer.practice}</p>
                      </section>
                    ) : null}
                  </>
                )}
                {message.showLabels !== false && message.answer && message.answer.labels.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {copy.related}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {message.answer.labels.map((label) => (
                        <Button
                          key={`${message.id}-${label.key}`}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void openLabel(label.key, label.title)}
                        >
                          {label.title}
                        </Button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </article>
            )
          )}
          {busy ? <TeacherReplying label={copy.replying} /> : null}
        </div>
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent
            className="z-[80] flex max-h-[min(32rem,85dvh)] w-[calc(100%-1.5rem)] max-w-md flex-col gap-3 p-4 sm:p-6"
            overlayClassName="z-[70]"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              placeComposerSoon()
            }}
          >
            <DialogHeader className="pr-8 text-left">
              <DialogTitle>{copy.history}</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {historyLoading ? (
                <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.historyLoading}
                </p>
              ) : sessions.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">{copy.historyEmpty}</p>
              ) : (
                <ul className="space-y-1">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void openSavedThread(session.id)}
                        className={`flex min-h-12 w-full flex-col justify-center rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted disabled:opacity-60 ${
                          session.id === sessionId ? 'bg-muted' : ''
                        }`}
                      >
                        <span className="line-clamp-2 font-medium">{session.preview || copy.empty}</span>
                        <span className="mt-0.5 text-xs text-muted-foreground">
                          {formatTutorWhen(session.updatedAt, locale)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {error ? <p className="shrink-0 px-3 pt-2 text-sm text-destructive">{error}</p> : null}
        <StudyChatThreadBar
          newLabel={copy.newThread}
          historyLabel={copy.history}
          historyOpen={historyOpen}
          disabled={!ready || busy}
          onNew={() => void beginNewThread()}
          onHistory={() => void openHistory()}
        />
        <form
          className="flex shrink-0 items-end gap-2 bg-muted/40 px-3 pb-3 pt-2"
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <Textarea
            ref={composerRef}
            id="gia-su-composer"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={copy.placeholder}
            rows={2}
            enterKeyHint="send"
            className="max-h-24 resize-none bg-background"
            disabled={!ready || busy}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <Button type="submit" disabled={!ready || busy}>
            {copy.send}
          </Button>
        </form>
    </div>
  )
}

