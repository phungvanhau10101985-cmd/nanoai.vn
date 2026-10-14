'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useMobileToolChatFrame } from '@/hooks/use-mobile-tool-chat-frame'
import { Check, History, Loader2, MessageSquarePlus, X } from 'lucide-react'
import { StudyCacheMark } from '@/components/student-study/study-cache-mark'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StudyComposerTool, StudyMessengerComposer } from '@/components/student-study/study-messenger-composer'
import type { WebLocale } from '@/lib/i18n/config'
import { aiTutorCopy } from '@/lib/ai-tutor/ai-tutor-copy'
import { compressEssayImageForUpload } from '@/lib/exam-essay-client-image'
import { tutorNextBubbleDelayMs, tutorReplyBubbles, tutorReplyHoldMs } from '@/lib/ai-tutor/ai-tutor-pace'
import type { TutorAnswer, TutorSessionSummary, TutorThreadMessage } from '@/lib/ai-tutor/ai-tutor-types'
import {
  listTutorHistory,
  loadTutorThread,
  openTutorHistoryThread,
  openTutorLabelAction,
  sendTutorPhoto,
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

const MAX_IMAGES = 3

type TutorChatLine = TutorThreadMessage & {
  images?: string[]
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

function userTurn(body: string, kind: 'question' | 'label', images: string[] = []): TutorChatLine {
  return {
    id: localId(),
    role: 'user',
    body,
    topicKey: '',
    kind,
    answer: null,
    createdAt: new Date().toISOString(),
    images,
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
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
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
  const urlsRef = useRef<string[]>([])
  const frame = useMobileToolChatFrame()

  useEffect(
    () => () => {
      cancelRevealRef.current?.()
      for (const url of urlsRef.current) URL.revokeObjectURL(url)
    },
    []
  )

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
  }, [messages, busy, previews.length])

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

  function remember(url: string) {
    urlsRef.current.push(url)
    return url
  }

  function dropPreview(url: string) {
    URL.revokeObjectURL(url)
    urlsRef.current = urlsRef.current.filter((item) => item !== url)
  }

  function clearDraftImages() {
    for (const url of urlsRef.current) URL.revokeObjectURL(url)
    urlsRef.current = []
    setFiles([])
    setPreviews([])
  }

  async function addPhotos(list: readonly File[]) {
    if (busyRef.current || !ready) return
    const incoming = list.filter((file) => file.size > 0 && file.type.startsWith('image/') && file.type !== 'image/svg+xml')
    const room = MAX_IMAGES - files.length
    const picked = incoming.slice(0, room)
    if (!picked.length) {
      setError(incoming.length ? copy.errors.too_many : copy.errors.bad_type)
      return
    }
    setError('')
    const compressed: File[] = []
    for (const file of picked) compressed.push(await compressEssayImageForUpload(file))
    const ready = compressed.filter((file) => file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')
    if (!ready.length) {
      setError(copy.errors.bad_type)
      return
    }
    setFiles((current) => [...current, ...ready].slice(0, MAX_IMAGES))
    setPreviews((current) => [...current, ...ready.map((file) => remember(URL.createObjectURL(file)))].slice(0, MAX_IMAGES))
  }

  function removePhoto(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index))
    setPreviews((current) => {
      const removed = current[index]
      if (removed) dropPreview(removed)
      return current.filter((_, i) => i !== index)
    })
  }

  async function send() {
    const question = text.trim()
    const shot = files
    const shotPreviews = previews
    if (busyRef.current) return
    if (!question && shot.length === 0) {
      setError(copy.errors.missing_text)
      return
    }
    setText('')
    setFiles([])
    setPreviews([])
    const restore = () => {
      setText(question)
      setFiles(shot)
      setPreviews(shotPreviews)
    }
    await ask(
      userTurn(question, 'question', shotPreviews),
      () => {
        if (!shot.length) return sendTutorQuestion({ locale, text: question })
        const formData = new FormData()
        formData.set('locale', locale)
        if (question) formData.set('text', question)
        for (const file of shot) formData.append('images', file)
        return sendTutorPhoto(formData)
      },
      restore
    )
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
    clearDraftImages()
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
    clearDraftImages()
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
              <div key={message.id} className="ml-auto flex max-w-[85%] flex-col items-end gap-2">
                {message.images && message.images.length > 0 ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {message.images.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={url} src={url} alt="" className="h-24 w-24 rounded-xl object-cover" />
                    ))}
                  </div>
                ) : null}
                {message.body ? (
                  <p className="rounded-2xl bg-primary/10 px-3 py-2 text-sm leading-6">{message.body}</p>
                ) : null}
              </div>
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
        {previews.length > 0 ? (
          <div className="flex shrink-0 gap-2 overflow-x-auto border-b bg-background px-3 py-2">
            {previews.map((url, index) => (
              <div key={url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow"
                  aria-label={copy.removeImage}
                  onClick={() => removePhoto(index)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <p className="shrink-0 px-3 pt-2 text-sm text-destructive">{error}</p> : null}
        <StudyMessengerComposer
          id="gia-su-composer"
          inputRef={composerRef}
          value={text}
          onChange={setText}
          onSubmit={() => void send()}
          placeholder={copy.placeholder}
          sendLabel={copy.send}
          showToolsLabel={copy.showTools}
          emojiLabel={copy.emoji}
          disabled={!ready || busy}
          canSend={Boolean(text.trim()) || files.length > 0}
          onPasteImages={(incoming) => void addPhotos(incoming)}
          onPasteImageError={(code) => setError(code === 'too-large' ? copy.errors.too_large : copy.pasteFailed)}
          tools={
            <>
              <StudyComposerTool label={copy.newThread} disabled={!ready || busy} onClick={() => void beginNewThread()}>
                <MessageSquarePlus strokeWidth={1.75} aria-hidden />
              </StudyComposerTool>
              <StudyComposerTool
                label={copy.history}
                disabled={!ready || busy}
                expanded={historyOpen}
                onClick={() => void openHistory()}
              >
                <History strokeWidth={1.75} aria-hidden />
              </StudyComposerTool>
            </>
          }
        />
    </div>
  )
}

