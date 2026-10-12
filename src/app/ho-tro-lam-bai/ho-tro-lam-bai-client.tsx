'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, History, ImagePlus, Loader2, MessageSquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import { compressEssayImageForUpload } from '@/lib/exam-essay-client-image'
import { homeworkHelpCopy, type HomeworkHelpCopy } from '@/lib/homework-help/homework-help-copy'
import type { HomeworkProblem, HomeworkReview } from '@/lib/homework-help/homework-help-guide'
import { tutorNextBubbleDelayMs, tutorReplyHoldMs } from '@/lib/ai-tutor/ai-tutor-pace'
import type { HomeworkSessionSummary, HomeworkThreadMessage } from '@/lib/homework-help/homework-help-thread'
import {
  explainHomeworkPhoto,
  explainTypedHomework,
  listHomeworkHistory,
  loadHomeworkThread,
  openHomeworkHistoryThread,
  reviewHomeworkWork,
  startHomeworkThread,
} from '@/app/ho-tro-lam-bai/actions'

const MAX_IMAGES = 3

type Props = {
  locale: WebLocale
}

type UserTurn = {
  id: string
  role: 'user'
  text: string
  images: string[]
  imageCount: number
}

type TeacherTurn =
  | { id: string; role: 'teacher'; kind: 'problem'; problem: HomeworkProblem }
  | { id: string; role: 'teacher'; kind: 'note'; text: string }

type ChatLine = UserTurn | TeacherTurn

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function localId(): string {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatHomeworkWhen(iso: string, locale: WebLocale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

function linesFromStored(messages: HomeworkThreadMessage[]): ChatLine[] {
  const lines: ChatLine[] = []
  for (const message of messages) {
    if (message.role === 'user') {
      lines.push({
        id: message.id,
        role: 'user',
        text: message.body,
        images: [],
        imageCount: message.imageCount,
      })
      continue
    }
    if (message.kind === 'problem' && message.problem) {
      lines.push({ id: message.id, role: 'teacher', kind: 'problem', problem: message.problem })
      continue
    }
    if (message.kind === 'note' && message.body) {
      lines.push({ id: message.id, role: 'teacher', kind: 'note', text: message.body })
    }
  }
  return lines
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

export default function HoTroLamBaiClient({ locale }: Props) {
  const copy = homeworkHelpCopy(locale)
  const [messages, setMessages] = useState<ChatLine[]>([])
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [sessions, setSessions] = useState<HomeworkSessionSummary[]>([])
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const busyRef = useRef(false)
  const urlsRef = useRef<string[]>([])
  const frame = useMobileChatFrame()

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadHomeworkThread(locale).then((result) => {
      if (cancelled) return
      if (result.ok) {
        if (!busyRef.current) {
          setSessionId(result.data.sessionId)
          setMessages(linesFromStored(result.data.messages))
        }
      } else setError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [copy.errors, locale])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollTo({ top: scroller.scrollHeight })
  }, [messages, busy, previews.length])

  function remember(url: string) {
    urlsRef.current.push(url)
    return url
  }

  function dropPreview(url: string) {
    URL.revokeObjectURL(url)
    urlsRef.current = urlsRef.current.filter((item) => item !== url)
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length || busyRef.current || !ready) return
    const picked = [...list].slice(0, MAX_IMAGES - files.length)
    if (!picked.length) {
      setError(copy.errors.too_many)
      return
    }
    const compressed = await Promise.all(picked.map((file) => compressEssayImageForUpload(file)))
    const nextFiles = [...files, ...compressed].slice(0, MAX_IMAGES)
    setFiles(nextFiles)
    setPreviews((current) => {
      for (const url of current) dropPreview(url)
      return nextFiles.map((file) => remember(URL.createObjectURL(file)))
    })
    setError('')
  }

  function removeAt(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index))
    setPreviews((current) => {
      const removed = current[index]
      if (removed) dropPreview(removed)
      return current.filter((_, i) => i !== index)
    })
  }

  function clearComposer() {
    setMessages((current) => {
      for (const message of current) {
        if (message.role === 'user') {
          for (const url of message.images) dropPreview(url)
        }
      }
      return []
    })
    setText('')
    setFiles([])
    setPreviews((current) => {
      for (const url of current) dropPreview(url)
      return []
    })
    setError('')
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const result = await listHomeworkHistory()
    setHistoryLoading(false)
    if (!result.ok) {
      setError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
      setSessions([])
      return
    }
    setSessions(result.data)
  }, [copy.errors])

  async function beginNewThread() {
    if (busyRef.current) return
    const result = await startHomeworkThread(locale)
    if (!result.ok) {
      setError(copy.errors[result.code] ?? copy.errors.new_thread_failed)
      return
    }
    setSessionId(result.data.sessionId)
    clearComposer()
    setHistoryOpen(false)
  }

  async function openHistory() {
    if (historyOpen) {
      setHistoryOpen(false)
      return
    }
    setHistoryOpen(true)
    await loadHistory()
  }

  async function openSavedThread(id: string) {
    if (busyRef.current || id === sessionId) {
      setHistoryOpen(false)
      return
    }
    setError('')
    const result = await openHomeworkHistoryThread(id)
    if (!result.ok) {
      setError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
      return
    }
    const lines = linesFromStored(result.data.messages)
    setMessages((current) => {
      for (const message of current) {
        if (message.role === 'user') {
          for (const url of message.images) dropPreview(url)
        }
      }
      return lines
    })
    setText('')
    setFiles([])
    setPreviews((current) => {
      for (const url of current) dropPreview(url)
      return []
    })
    setSessionId(result.data.sessionId)
    setHistoryOpen(false)
  }

  async function send() {
    const question = text.trim()
    const shot = files
    const shotPreviews = previews
    if (busyRef.current || !ready) return
    if (!question && shot.length === 0) {
      setError(copy.errors.missing_text)
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    setText('')
    setFiles([])
    setPreviews([])
    const pending: UserTurn = {
      id: localId(),
      role: 'user',
      text: question,
      images: shotPreviews,
      imageCount: shot.length,
    }
    setMessages((current) => [...current, pending])
    const startedAt = Date.now()

    const result = shot.length
      ? await (async () => {
          const formData = new FormData()
          formData.set('locale', locale)
          if (question) formData.set('text', question)
          for (const file of shot) formData.append('images', file)
          return explainHomeworkPhoto(formData)
        })()
      : await explainTypedHomework({ locale, text: question })

    if (!result.ok) {
      setMessages((current) => current.filter((message) => message.id !== pending.id))
      setText(question)
      setFiles(shot)
      setPreviews(shotPreviews)
      setError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
      busyRef.current = false
      setBusy(false)
      return
    }

    const hold = tutorReplyHoldMs(startedAt, Date.now())
    if (hold > 0) await sleep(hold)
    const problems = result.data.problems
    if (problems.length === 0) {
      setMessages((current) => [
        ...current,
        { id: localId(), role: 'teacher', kind: 'note', text: result.data.note || copy.emptyPhoto },
      ])
    } else {
      for (let index = 0; index < problems.length; index += 1) {
        if (index > 0) await sleep(tutorNextBubbleDelayMs(problems[index - 1].statement))
        const problem = problems[index]
        setMessages((current) => [
          ...current,
          { id: localId(), role: 'teacher', kind: 'problem', problem },
        ])
      }
    }
    busyRef.current = false
    setBusy(false)
  }

  return (
    <div
      className="flex min-h-0 flex-col max-md:fixed max-md:inset-x-0 max-md:z-30 max-md:bg-background max-md:top-[calc(var(--site-header-height,3rem)+4.75rem)] max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:min-h-[32rem] md:rounded-xl md:border md:bg-card md:shadow-sm"
      style={
        frame
          ? {
              ...(frame.top > 0 ? { top: frame.top } : {}),
              bottom: frame.bottom,
            }
          : undefined
      }
    >
      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        <p className="text-sm leading-6 text-muted-foreground">{copy.intro}</p>
        {ready && messages.length === 0 ? <p className="text-sm leading-6 text-muted-foreground">{copy.empty}</p> : null}
        {messages.map((message) =>
          message.role === 'user' ? (
            <UserBubble key={message.id} message={message} photoLabel={copy.photoTurn} />
          ) : message.kind === 'note' ? (
            <article key={message.id} className="max-w-[92%] rounded-xl border bg-background p-4">
              <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
            </article>
          ) : (
            <ProblemBubble key={message.id} locale={locale} copy={copy} problem={message.problem} />
          )
        )}
        {busy ? <TeacherReplying label={copy.replying} /> : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-background px-3 pt-2 max-md:pr-16 md:bg-card">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          disabled={!ready || busy}
          aria-label={copy.newThread}
          title={copy.newThread}
          onClick={() => void beginNewThread()}
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          disabled={!ready || busy}
          aria-expanded={historyOpen}
          aria-label={copy.history}
          title={copy.history}
          onClick={() => void openHistory()}
        >
          <History className="h-4 w-4" aria-hidden />
        </Button>
        <input
          id="homework-help-gallery"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          disabled={!ready || busy}
          onChange={(event) => {
            void addFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={`h-9 w-9 ${!ready || busy ? 'pointer-events-none opacity-60' : ''}`}
          disabled={!ready || busy}
          asChild
        >
          <label
            htmlFor="homework-help-gallery"
            className="cursor-pointer"
            aria-label={copy.pickPhoto}
            title={copy.pickPhoto}
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
          </label>
        </Button>
        <div className="inline-flex md:hidden">
          <input
            id="homework-help-camera"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            disabled={!ready || busy}
            onChange={(event) => {
              void addFiles(event.target.files)
              event.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`h-9 w-9 ${!ready || busy ? 'pointer-events-none opacity-60' : ''}`}
            disabled={!ready || busy}
            asChild
          >
            <label
              htmlFor="homework-help-camera"
              className="cursor-pointer"
              aria-label={copy.takePhoto}
              title={copy.takePhoto}
            >
              <Camera className="h-4 w-4" aria-hidden />
            </label>
          </Button>
        </div>
      </div>

      {historyOpen ? (
        <div className="max-h-48 shrink-0 overflow-y-auto border-b bg-background px-3 py-2 md:bg-card">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium">{copy.history}</p>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label={copy.historyClose}
              onClick={() => setHistoryOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {historyLoading ? (
            <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {copy.historyLoading}
            </p>
          ) : sessions.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">{copy.historyEmpty}</p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openSavedThread(session.id)}
                    className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-60 ${
                      session.id === sessionId ? 'bg-muted' : ''
                    }`}
                  >
                    <span className="line-clamp-1 font-medium">{session.preview || copy.photoTurn}</span>
                    <span className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatHomeworkWhen(session.updatedAt, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {previews.length > 0 ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b bg-background px-3 py-2 md:bg-card">
          {previews.map((url, index) => (
            <div key={url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow"
                aria-label={copy.removeImage}
                onClick={() => removeAt(index)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="shrink-0 px-3 pt-2 text-sm text-destructive">{error}</p> : null}
      <form
        className="flex shrink-0 items-end gap-2 bg-background p-3 md:bg-card"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={copy.placeholder}
          rows={2}
          className="max-h-24 resize-none"
          disabled={!ready || busy}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
        />
        <Button type="submit" disabled={!ready || busy || (!text.trim() && files.length === 0)}>
          {copy.send}
        </Button>
      </form>
    </div>
  )
}

function UserBubble({ message, photoLabel }: { message: UserTurn; photoLabel: string }) {
  return (
    <div className="ml-auto flex max-w-[85%] flex-col items-end gap-2">
      {message.images.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-2">
          {message.images.map((url) => (
            <div key={url} className="h-24 w-24 overflow-hidden rounded-2xl border bg-primary/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : message.imageCount > 0 ? (
        <p className="rounded-2xl bg-primary/10 px-3 py-2 text-sm leading-6">{photoLabel}</p>
      ) : null}
      {message.text ? (
        <p className="rounded-2xl bg-primary/10 px-3 py-2 text-sm leading-6">{message.text}</p>
      ) : null}
    </div>
  )
}

function ProblemBubble({
  locale,
  copy,
  problem,
}: {
  locale: WebLocale
  copy: HomeworkHelpCopy
  problem: HomeworkProblem
}) {
  const [shownHints, setShownHints] = useState(0)
  const [answerOpen, setAnswerOpen] = useState(false)
  const [attempt, setAttempt] = useState('')
  const [review, setReview] = useState<HomeworkReview | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')
  const hintsLeft = shownHints < problem.hints.length
  const canShowAnswer = Boolean(problem.answer) && !hintsLeft && !answerOpen

  async function checkWork() {
    setReviewing(true)
    setError('')
    const result = await reviewHomeworkWork({
      locale,
      statement: problem.statement,
      attempt,
    })
    setReviewing(false)
    if (!result.ok) {
      setError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
      return
    }
    setReview(result.data)
  }

  return (
    <article className="max-w-[92%] space-y-3 rounded-xl border bg-background p-4">
      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.statement}</h3>
        <h2 className="text-base font-semibold">{problem.statement}</h2>
      </section>

      {problem.knowledge.length > 0 ? (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.knowledge}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
            {problem.knowledge.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">{copy.knowledgeHeld}</p>
      )}

      {problem.thinking.length > 0 ? (
        <section className="space-y-1 rounded-lg bg-muted p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.thinking}</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-6">
            {problem.thinking.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {shownHints > 0 ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-6" start={problem.thinking.length + 1}>
          {problem.hints.slice(0, shownHints).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : null}

      {hintsLeft || canShowAnswer ? (
        <div className="flex flex-wrap gap-2">
          {hintsLeft ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setShownHints((count) => count + 1)}>
              {copy.nextHint}
            </Button>
          ) : null}
          {canShowAnswer ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setAnswerOpen(true)}>
              {copy.showAnswer}
            </Button>
          ) : null}
        </div>
      ) : null}

      {!problem.answer && !hintsLeft ? (
        <p className="text-sm leading-6 text-muted-foreground">{copy.answerHeld}</p>
      ) : null}

      {answerOpen && problem.answer ? (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.answer}</h3>
          <p className="whitespace-pre-wrap text-sm leading-6">{problem.answer}</p>
        </section>
      ) : null}

      <section className="space-y-2 border-t pt-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.attemptLabel}
        </label>
        <Textarea
          value={attempt}
          placeholder={copy.attemptPlaceholder}
          onChange={(event) => setAttempt(event.target.value)}
          rows={2}
          className="max-h-24 resize-none"
          disabled={reviewing}
        />
        <Button type="button" size="sm" onClick={() => void checkWork()} disabled={reviewing || !attempt.trim()}>
          {reviewing ? copy.reviewing : copy.reviewButton}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {review ? (
          <div className="space-y-2 text-sm leading-6">
            <ul className="space-y-2">
              {review.checks.map((check) => (
                <li key={`${check.label}-${check.note}`}>
                  <span className="font-medium">{check.ok ? copy.checkOk : copy.checkBad}.</span> {check.label}
                  {check.note ? ` — ${check.note}` : ''}
                </li>
              ))}
            </ul>
            {review.gap ? (
              <p className="rounded-lg bg-muted p-3">
                <span className="font-medium">{copy.gap}.</span> {review.gap}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </article>
  )
}

/** Mobile: khóa trang, khung gõ nằm trên thanh đáy, chỉ hội thoại được vuốt. */
function useMobileChatFrame(): { top: number; bottom: number } | null {
  const [frame, setFrame] = useState<{ top: number; bottom: number } | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => {
      if (!mq.matches) {
        setFrame(null)
        document.documentElement.style.overflow = ''
        document.body.style.overflow = ''
        return
      }
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
      const back = document.querySelector('[data-creation-tool-back]')
      const nav = document.querySelector('nav.safe-area-pb')
      const backBottom = back ? Math.round(back.getBoundingClientRect().bottom) : 0
      const navTop = nav ? Math.round(nav.getBoundingClientRect().top) : window.innerHeight
      setFrame({
        top: backBottom,
        bottom: Math.max(0, window.innerHeight - navTop),
      })
    }
    if (mq.matches) window.scrollTo(0, 0)
    sync()
    const ro = new ResizeObserver(sync)
    for (const selector of ['header', '[data-creation-tool-back]', 'nav.safe-area-pb']) {
      const node = document.querySelector(selector)
      if (node) ro.observe(node)
    }
    mq.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      mq.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  return frame
}
