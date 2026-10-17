'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useMobileToolChatFrame } from '@/hooks/use-mobile-tool-chat-frame'
import { Camera, History, Image as ImageIcon, Loader2, MessageSquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StudyComposerTool, StudyMessengerComposer } from '@/components/student-study/study-messenger-composer'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WebLocale } from '@/lib/i18n/config'
import { ImageRegionPicker } from '@/components/media/image-region-picker'
import { compressEssayImageForUpload } from '@/lib/exam-essay-client-image'
import { homeworkHelpCopy, type HomeworkHelpCopy } from '@/lib/homework-help/homework-help-copy'
import { HOMEWORK_SOLUTION_CREDIT_COST } from '@/lib/homework-help/homework-help-solution-cost'
import type { TutorAnswer, TutorLabel } from '@/lib/ai-tutor/ai-tutor-types'
import {
  knowledgeLinesAsTags,
  type HomeworkGuide,
  type HomeworkModelMark,
  type HomeworkProblem,
} from '@/lib/homework-help/homework-help-guide'
import { tutorNextBubbleDelayMs, tutorReplyHoldMs } from '@/lib/ai-tutor/ai-tutor-pace'
import type { HomeworkSessionSummary, HomeworkThreadMessage } from '@/lib/homework-help/homework-help-thread'
import {
  confirmHomeworkRead,
  explainTypedHomework,
  readHomeworkPhoto,
  listHomeworkHistory,
  listUnlockedHomeworkSolutions,
  loadHomeworkThread,
  openHomeworkHistoryThread,
  openHomeworkKnowledgeTag,
  openHomeworkSolution,
  startHomeworkThread,
} from '@/app/ho-tro-lam-bai/actions'
import { StudyCacheMark } from '@/components/student-study/study-cache-mark'
import { HomeworkPlotFigure } from '@/components/student-study/homework-plot-figure'
import { StudyFormulaText } from '@/components/student-study/study-formula-text'
import { studyTextHasFormula } from '@/lib/homework-help/homework-formula-text'
import { StudentStudyPaywall } from '@/components/student-study/student-study-paywall'
import {
  revealStudyComposer,
  scheduleStudyComposerReveal,
  STUDY_CHAT_SHELL_CLASS,
} from '@/lib/study-chat-frame'

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

type PhotoReview = {
  turnId: string
  note: string
  statements: string[]
  photoKey: string
  imageCount: number
  caption: string
  files: File[]
}

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

function threadIsClosed(lines: ChatLine[]): boolean {
  return lines.some((line) => line.role === 'user')
}

function ModelMark({ mark }: { mark: HomeworkModelMark }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1 text-[10px] font-bold leading-none text-muted-foreground">
      {mark}
    </span>
  )
}

function PhotoReadReview({
  locale,
  copy,
  note,
  statements,
  onChange,
  onRemove,
  onConfirm,
  onCancel,
}: {
  locale: WebLocale
  copy: HomeworkHelpCopy
  note: string
  statements: string[]
  onChange: (index: number, value: string) => void
  onRemove: (index: number) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <article className="max-w-[92%] space-y-3 rounded-xl border bg-background p-4">
      <h2 className="text-sm font-semibold">{copy.reviewTitle}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{copy.reviewHint}</p>
      {note ? <p className="text-sm leading-6">{note}</p> : null}
      {statements.map((statement, index) => (
        <div key={index} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {copy.problemLabel.replace('{n}', String(index + 1))}
              <ModelMark mark="G" />
            </p>
            {statements.length > 1 ? (
              <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => onRemove(index)}>
                {copy.reviewRemove}
              </button>
            ) : null}
          </div>
          <Textarea
            value={statement}
            rows={4}
            onChange={(event) => onChange(index, event.target.value)}
          />
          {studyTextHasFormula(statement) ? (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-7">
              <StudyFormulaText text={statement} />
            </div>
          ) : null}
          <HomeworkPlotFigure statement={statement} title={copy.figure} locale={locale} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onConfirm}>
          {copy.send}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {copy.reviewCancel}
        </Button>
      </div>
    </article>
  )
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
  const [needsPlan, setNeedsPlan] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cropQueue, setCropQueue] = useState<File[]>([])
  const [cropIndex, setCropIndex] = useState(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [sessions, setSessions] = useState<HomeworkSessionSummary[]>([])
  const [paidSolutions, setPaidSolutions] = useState<Set<string>>(() => new Set())
  const [review, setReview] = useState<PhotoReview | null>(null)
  const [chatClosed, setChatClosed] = useState(false)
  const [waitLabel, setWaitLabel] = useState<'reading' | 'replying'>('replying')
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const cancelRevealRef = useRef<(() => void) | null>(null)
  const busyRef = useRef(false)
  const acceptingCropRef = useRef(false)
  const cropBatchRef = useRef<{ files: File[]; previews: string[] }>({ files: [], previews: [] })
  const submitPhotosRef = useRef<(shot: File[], shotPreviews: string[]) => Promise<void>>(async () => {})
  const urlsRef = useRef<string[]>([])
  const frame = useMobileToolChatFrame()

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      cancelRevealRef.current?.()
    }
  }, [])

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
    void loadHomeworkThread(locale).then((result) => {
      if (cancelled) return
      if (result.ok) {
        if (!busyRef.current) {
          setNeedsPlan(false)
          setSessionId(result.data.sessionId)
          const lines = linesFromStored(result.data.messages)
          setMessages(lines)
          setChatClosed(threadIsClosed(lines))
          setPaidSolutions((current) => {
            const next = new Set(current)
            for (const statement of result.data.unlockedStatements) next.add(statement)
            return next
          })
        }
      } else if (result.code === 'payment_required') {
        setNeedsPlan(true)
        setError('')
      } else setError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
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

  const problemStatements = useMemo(
    () =>
      messages.flatMap((message) =>
        message.role === 'teacher' && message.kind === 'problem' && message.problem.statement
          ? [message.problem.statement]
          : []
      ),
    [messages]
  )
  const problemStatementKey = JSON.stringify(problemStatements)

  useEffect(() => {
    const statements = JSON.parse(problemStatementKey) as string[]
    if (!statements.length) return
    let cancelled = false
    void listUnlockedHomeworkSolutions({ locale, statements }).then((result) => {
      if (cancelled || !result.ok) return
      setPaidSolutions((current) => {
        let changed = false
        const next = new Set(current)
        for (const statement of result.data) {
          if (next.has(statement)) continue
          next.add(statement)
          changed = true
        }
        return changed ? next : current
      })
    })
    return () => {
      cancelled = true
    }
  }, [locale, problemStatementKey])

  const reviewing = review != null
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollTo({ top: scroller.scrollHeight })
  }, [messages, busy, previews.length, reviewing])

  function remember(url: string) {
    urlsRef.current.push(url)
    return url
  }

  function dropPreview(url: string) {
    URL.revokeObjectURL(url)
    urlsRef.current = urlsRef.current.filter((item) => item !== url)
  }

  function queuePhotos(list: FileList | readonly File[] | null) {
    if (!list?.length || busyRef.current || !ready || cropQueue.length > 0 || review || chatClosed) return
    if (text.trim()) {
      setError(copy.errors.photo_blocked)
      return
    }
    const seen = new Set<string>()
    const incoming = [...list].filter((file) => {
      if (file.size <= 0 || !file.type.startsWith('image/') || file.type === 'image/svg+xml') return false
      const key = `${file.name}|${file.size}|${file.lastModified}|${file.type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const picked = incoming.slice(0, MAX_IMAGES)
    if (!picked.length) {
      setError(incoming.length ? copy.errors.too_many : copy.errors.bad_type)
      return
    }
    setError('')
    cropBatchRef.current = { files: [], previews: [] }
    setFiles([])
    setPreviews((current) => {
      for (const url of current) dropPreview(url)
      return []
    })
    setCropIndex(0)
    setCropQueue(picked)
  }

  async function acceptCroppedPhoto(file: File) {
    if (acceptingCropRef.current) return
    acceptingCropRef.current = true
    try {
      const compressed = await compressEssayImageForUpload(file)
      const batch = cropBatchRef.current
      const nextFiles = [...batch.files, compressed].slice(0, MAX_IMAGES)
      const nextPreviews = [...batch.previews, remember(URL.createObjectURL(compressed))].slice(0, MAX_IMAGES)
      batch.files = nextFiles
      batch.previews = nextPreviews
      const next = cropIndex + 1
      const queueDone = next >= cropQueue.length || nextFiles.length >= MAX_IMAGES
      setText('')
      if (!queueDone) {
        setFiles(nextFiles)
        setPreviews(nextPreviews)
        setCropIndex(next)
        return
      }
      cropBatchRef.current = { files: [], previews: [] }
      flushSync(() => {
        setCropQueue([])
        setCropIndex(0)
        setFiles([])
        setPreviews([])
      })
      await submitPhotosRef.current(nextFiles, nextPreviews)
    } finally {
      acceptingCropRef.current = false
    }
  }

  function cancelCrop() {
    setCropQueue([])
    setCropIndex(0)
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
    setReview(null)
    setChatClosed(false)
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const result = await listHomeworkHistory()
      if (!result.ok) {
        setError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
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
    flushSync(() => setHistoryOpen(false))
    placeComposer()
    let result: Awaited<ReturnType<typeof startHomeworkThread>>
    try {
      result = await startHomeworkThread(locale)
    } catch {
      setError(copy.errors.new_thread_failed)
      placeComposerSoon()
      return
    }
    if (!result.ok) {
      if (result.code === 'payment_required') {
        setNeedsPlan(true)
        setError('')
      } else setError(copy.errors[result.code] ?? copy.errors.new_thread_failed)
      return
    }
    setSessionId(result.data.sessionId)
    clearComposer()
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
    let result: Awaited<ReturnType<typeof openHomeworkHistoryThread>>
    try {
      result = await openHomeworkHistoryThread(id, locale)
    } catch {
      setError(copy.errors.ai_unavailable)
      placeComposerSoon()
      return
    }
    if (!result.ok) {
      if (result.code === 'payment_required') {
        setNeedsPlan(true)
        setError('')
      } else setError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
      return
    }
    const lines = linesFromStored(result.data.messages)
    setChatClosed(threadIsClosed(lines))
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
    setReview(null)
    setPaidSolutions((current) => {
      const next = new Set(current)
      for (const statement of result.data.unlockedStatements) next.add(statement)
      return next
    })
    placeComposerSoon()
  }

  async function showGuide(guide: HomeworkGuide, startedAt: number) {
    const hold = tutorReplyHoldMs(startedAt, Date.now())
    if (hold > 0) await sleep(hold)
    const problems = guide.problems
    if (problems.length === 0) {
      setMessages((current) => [
        ...current,
        { id: localId(), role: 'teacher', kind: 'note', text: guide.note || copy.emptyPhoto },
      ])
      return
    }
    for (let index = 0; index < problems.length; index += 1) {
      if (index > 0) await sleep(tutorNextBubbleDelayMs(problems[index - 1].statement))
      const problem = problems[index]
      setMessages((current) => [...current, { id: localId(), role: 'teacher', kind: 'problem', problem }])
    }
  }

  function failHomework(code: string) {
    if (code === 'payment_required') {
      setNeedsPlan(true)
      setError('')
      return
    }
    setError(copy.errors[code] ?? copy.errors.ai_unavailable)
  }

  async function submitPhotos(shot: File[], shotPreviews: string[]) {
    if (busyRef.current || !ready || review || chatClosed || shot.length === 0) {
      setFiles(shot)
      setPreviews(shotPreviews)
      return
    }
    busyRef.current = true
    setBusy(true)
    setWaitLabel('reading')
    setError('')
    setText('')
    setFiles([])
    setPreviews([])
    const pending: UserTurn = {
      id: localId(),
      role: 'user',
      text: '',
      images: shotPreviews,
      imageCount: shot.length,
    }
    setMessages((current) => [...current, pending])
    const restoreDraft = () => {
      setMessages((current) => current.filter((message) => message.id !== pending.id))
      setFiles(shot)
      setPreviews(shotPreviews)
    }

    try {
      const formData = new FormData()
      formData.set('locale', locale)
      for (const file of shot) formData.append('images', file)
      const result = await readHomeworkPhoto(formData)
      if (!result.ok) {
        restoreDraft()
        failHomework(result.code)
        return
      }
      setReview({
        turnId: pending.id,
        note: result.data.note,
        statements: result.data.statements.length ? result.data.statements : [''],
        photoKey: result.data.photoKey,
        imageCount: shot.length,
        caption: '',
        files: shot,
      })
    } catch {
      restoreDraft()
      setError(copy.errors.ai_unavailable)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  submitPhotosRef.current = submitPhotos

  async function send() {
    const shot = files
    const question = shot.length > 0 ? '' : text.trim()
    const shotPreviews = previews
    if (busyRef.current || !ready || review || chatClosed) return
    if (!question && shot.length === 0) {
      setError(copy.errors.missing_text)
      return
    }
    if (shot.length > 0) {
      await submitPhotos(shot, shotPreviews)
      return
    }
    busyRef.current = true
    setBusy(true)
    setWaitLabel('replying')
    setError('')
    setText('')
    setFiles([])
    setPreviews([])
    const pending: UserTurn = {
      id: localId(),
      role: 'user',
      text: question,
      images: shotPreviews,
      imageCount: 0,
    }
    setMessages((current) => [...current, pending])
    const startedAt = Date.now()
    const restoreDraft = () => {
      setMessages((current) => current.filter((message) => message.id !== pending.id))
      setText(question)
      setFiles(shot)
      setPreviews(shotPreviews)
    }

    try {
      const result = await explainTypedHomework({ locale, text: question })
      if (!result.ok) {
        restoreDraft()
        failHomework(result.code)
        return
      }
      await showGuide(result.data, startedAt)
      setChatClosed(true)
    } catch {
      restoreDraft()
      setError(copy.errors.ai_unavailable)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function cancelReview() {
    if (!review || busyRef.current) return
    const draft = review
    const turn = messages.find((message) => message.id === draft.turnId)
    setMessages((current) => current.filter((message) => message.id !== draft.turnId))
    setText(draft.caption)
    setFiles(draft.files)
    setPreviews(turn && turn.role === 'user' ? turn.images : [])
    setReview(null)
    setError('')
  }

  async function confirmReview() {
    if (!review || busyRef.current) return
    const statements = review.statements.map((item) => item.trim()).filter(Boolean)
    if (!statements.length) {
      setError(copy.errors.missing_text)
      return
    }
    const draft = review
    busyRef.current = true
    setBusy(true)
    setWaitLabel('replying')
    setError('')
    const startedAt = Date.now()
    try {
      const formData = new FormData()
      formData.set('locale', locale)
      formData.set('note', draft.note)
      formData.set('statements', JSON.stringify(statements))
      formData.set('photoKey', draft.photoKey)
      formData.set('imageCount', String(draft.imageCount))
      formData.set('caption', draft.caption)
      for (const file of draft.files) formData.append('images', file)
      const result = await confirmHomeworkRead(formData)
      if (!result.ok) {
        failHomework(result.code)
        return
      }
      setReview(null)
      await showGuide(result.data, startedAt)
      setChatClosed(true)
    } catch {
      setError(copy.errors.ai_unavailable)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
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
        {ready && messages.length === 0 ? <p className="text-sm leading-6 text-muted-foreground">{copy.empty}</p> : null}
        {messages.map((message) =>
          message.role === 'user' ? (
            <UserBubble key={message.id} message={message} photoLabel={copy.photoTurn} />
          ) : message.kind === 'note' ? (
            <article key={message.id} className="max-w-[92%] rounded-xl border bg-background p-4">
              <p className="text-sm leading-7">
                <StudyFormulaText text={message.text} />
              </p>
            </article>
          ) : (
            <ProblemBubble
              key={message.id}
              locale={locale}
              copy={copy}
              problem={message.problem}
              solutionPaid={paidSolutions.has(message.problem.statement)}
              onSolutionPaid={(statement) => {
                setPaidSolutions((current) => {
                  if (current.has(statement)) return current
                  const next = new Set(current)
                  next.add(statement)
                  return next
                })
              }}
              onPaymentRequired={() => {
                setNeedsPlan(true)
                setError('')
              }}
            />
          )
        )}
        {review && !busy ? (
          <PhotoReadReview
            locale={locale}
            copy={copy}
            note={review.note}
            statements={review.statements}
            onChange={(index, value) => {
              setReview((current) => {
                if (!current) return current
                const statements = current.statements.slice()
                statements[index] = value
                return { ...current, statements }
              })
            }}
            onRemove={(index) => {
              setReview((current) => {
                if (!current || current.statements.length < 2) return current
                return { ...current, statements: current.statements.filter((_, item) => item !== index) }
              })
            }}
            onConfirm={() => void confirmReview()}
            onCancel={cancelReview}
          />
        ) : null}
        {busy ? <TeacherReplying label={waitLabel === 'reading' ? copy.reading : copy.replying} /> : null}
      </div>

      <input
        id="homework-help-gallery"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={!ready || busy || cropQueue.length > 0 || review != null || chatClosed || text.trim().length > 0}
        onChange={(event) => {
          queuePhotos(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        id="homework-help-camera"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only md:hidden"
        disabled={!ready || busy || cropQueue.length > 0 || review != null || chatClosed || text.trim().length > 0}
        onChange={(event) => {
          queuePhotos(event.target.files)
          event.target.value = ''
        }}
      />

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
                      <span className="line-clamp-2 font-medium">{session.preview || copy.photoTurn}</span>
                      <span className="mt-0.5 text-xs text-muted-foreground">
                        {formatHomeworkWhen(session.updatedAt, locale)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ImageRegionPicker
        file={cropQueue[cropIndex] ?? null}
        title={copy.cropTitle}
        hint={copy.cropHint}
        confirmLabel={copy.cropConfirm}
        cancelLabel={copy.cropCancel}
        wholeLabel={copy.cropWhole}
        failedLabel={copy.cropFailed}
        preview={{
          title: copy.cropPreviewTitle,
          hint: copy.cropPreviewHint,
          confirmLabel: copy.cropPreviewConfirm,
          retryLabel: copy.cropPreviewRetry,
        }}
        stepLabel={
          cropQueue.length > 1
            ? copy.cropProgress.replace('{current}', String(cropIndex + 1)).replace('{total}', String(cropQueue.length))
            : undefined
        }
        onConfirm={acceptCroppedPhoto}
        onCancel={cancelCrop}
      />

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

      {chatClosed && !review ? (
        <p className="shrink-0 px-3 pt-2 text-sm leading-6 text-muted-foreground">{copy.chatClosed}</p>
      ) : null}
      {error ? <p className="shrink-0 px-3 pt-2 text-sm text-destructive">{error}</p> : null}
      <StudyMessengerComposer
        id="ho-tro-lam-bai-composer"
        inputRef={composerRef}
        value={text}
        onChange={(value) => {
          if (files.length > 0) return
          setText(value)
        }}
        onSubmit={() => void send()}
        placeholder={files.length > 0 ? copy.photoPlaceholder : copy.placeholder}
        inputLocked={files.length > 0}
        sendLabel={copy.send}
        showToolsLabel={copy.showTools}
        emojiLabel={copy.emoji}
        disabled={!ready || busy || review != null || chatClosed}
        canSend={(Boolean(text.trim()) || files.length > 0) && review == null && !chatClosed}
        onPasteImages={(incoming) => queuePhotos(incoming)}
        onPasteImageError={(code) => setError(code === 'too-large' ? copy.errors.too_large : copy.errors.paste_failed)}
        tools={
          <>
            <div className="md:hidden">
              <StudyComposerTool
                label={copy.takePhoto}
                htmlFor="homework-help-camera"
                disabled={!ready || busy || cropQueue.length > 0 || review != null || chatClosed || text.trim().length > 0}
              >
                <Camera strokeWidth={1.75} aria-hidden />
              </StudyComposerTool>
            </div>
            <StudyComposerTool
              label={copy.pickPhoto}
              htmlFor="homework-help-gallery"
              disabled={!ready || busy || cropQueue.length > 0 || review != null || chatClosed || text.trim().length > 0}
            >
              <ImageIcon strokeWidth={1.75} aria-hidden />
            </StudyComposerTool>
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
        <p className="rounded-2xl bg-primary/10 px-3 py-2 text-sm leading-7">
          <StudyFormulaText text={message.text} />
        </p>
      ) : null}
    </div>
  )
}

function ProblemBubble({
  locale,
  copy,
  problem,
  solutionPaid,
  onSolutionPaid,
  onPaymentRequired,
}: {
  locale: WebLocale
  copy: HomeworkHelpCopy
  problem: HomeworkProblem
  solutionPaid: boolean
  onSolutionPaid: (statement: string) => void
  onPaymentRequired: () => void
}) {
  const [shownHints, setShownHints] = useState(0)
  const [answerOpen, setAnswerOpen] = useState(false)
  const [solution, setSolution] = useState('')
  const [solutionCached, setSolutionCached] = useState(false)
  const [solutionBusy, setSolutionBusy] = useState(false)
  const [solutionError, setSolutionError] = useState('')
  const [tagOpen, setTagOpen] = useState<TutorLabel | null>(null)
  const [tagAnswer, setTagAnswer] = useState<TutorAnswer | null>(null)
  const [tagBusy, setTagBusy] = useState(false)
  const [tagError, setTagError] = useState('')
  const tagRequestRef = useRef(0)
  const hintsLeft = shownHints < problem.hints.length
  const tags = problem.tags.length > 0 ? problem.tags : knowledgeLinesAsTags(problem.knowledge)
  const guideMark: HomeworkModelMark = problem.guideMark === 'G' || problem.answerMark === 'G' ? 'G' : 'D'
  const canShowAnswer = Boolean(problem.answer) && !hintsLeft && !answerOpen
  const creditText =
    locale === 'vi'
      ? String(HOMEWORK_SOLUTION_CREDIT_COST).replace('.', ',')
      : String(HOMEWORK_SOLUTION_CREDIT_COST)
  const solutionLabel = solutionPaid
    ? copy.showSolutionOwned
    : copy.showSolution.replace('{credits}', creditText)

  async function openSolution() {
    setSolutionBusy(true)
    setSolutionError('')
    try {
      const result = await openHomeworkSolution({
        locale,
        statement: problem.statement,
        answer: problem.answer,
      })
      if (!result.ok) {
        if (result.code === 'payment_required') onPaymentRequired()
        else setSolutionError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
        return
      }
      setSolution(result.data.solution)
      setSolutionCached(result.data.cached)
      onSolutionPaid(problem.statement)
    } catch {
      setSolutionError(copy.errors.ai_unavailable)
    } finally {
      setSolutionBusy(false)
    }
  }

  async function openTag(tag: TutorLabel) {
    const request = tagRequestRef.current + 1
    tagRequestRef.current = request
    setTagOpen(tag)
    setTagAnswer(null)
    setTagError('')
    setTagBusy(true)
    try {
      const result = await openHomeworkKnowledgeTag({
        locale,
        labelKey: tag.key,
        title: tag.title,
      })
      if (request !== tagRequestRef.current) return
      if (!result.ok) {
        if (result.code === 'payment_required') onPaymentRequired()
        else setTagError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
        return
      }
      setTagAnswer(result.data)
    } catch {
      if (request !== tagRequestRef.current) return
      setTagError(copy.errors.ai_unavailable)
    } finally {
      if (request === tagRequestRef.current) setTagBusy(false)
    }
  }

  function closeTag() {
    tagRequestRef.current += 1
    setTagOpen(null)
    setTagBusy(false)
  }

  return (
    <article className="max-w-[92%] space-y-3 rounded-xl border bg-background p-4">
      <section className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.statement}</h3>
          {problem.statementMark ? <ModelMark mark={problem.statementMark} /> : null}
          {problem.cached ? <StudyCacheMark label={copy.cachedFromDb} /> : null}
        </div>
        <h2 className="text-base font-normal leading-7">
          <StudyFormulaText text={problem.statement} />
        </h2>
      </section>

      {problem.knowledge.length > 0 || tags.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.knowledge}</h3>
            <ModelMark mark={guideMark} />
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Button
                  key={`${tag.key}-${tag.title}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={tagBusy}
                  onClick={() => void openTag(tag)}
                >
                  <StudyFormulaText text={tag.title} />
                </Button>
              ))}
            </div>
          ) : null}
          {problem.knowledge.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
              {problem.knowledge.map((item) => (
                <li key={item}>
                  <StudyFormulaText text={item} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : !problem.answer ? (
        <p className="text-sm leading-6 text-muted-foreground">{copy.knowledgeHeld}</p>
      ) : null}

      {problem.thinking.length > 0 ? (
        <section className="space-y-1 rounded-lg bg-muted p-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.thinking}</h3>
            <ModelMark mark={guideMark} />
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-6">
            {problem.thinking.map((item) => (
              <li key={item}>
                <StudyFormulaText text={item} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <HomeworkPlotFigure statement={problem.statement} title={copy.figure} locale={locale} />

      {shownHints > 0 ? (
        <div className="space-y-1">
          <ModelMark mark={guideMark} />
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-6" start={problem.thinking.length + 1}>
            {problem.hints.slice(0, shownHints).map((item) => (
              <li key={item}>
                <StudyFormulaText text={item} />
              </li>
            ))}
          </ol>
        </div>
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
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.answer}</h3>
            {problem.answerMark ? <ModelMark mark={problem.answerMark} /> : null}
          </div>
          <p className="text-sm leading-7">
            <StudyFormulaText text={problem.answer} />
          </p>
        </section>
      ) : null}

      {answerOpen && problem.answer ? (
        <section className="space-y-2">
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm leading-6">
            {copy.solutionWarning}
          </p>
          {solution ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.solutionTitle}
                </h3>
                <ModelMark mark="D" />
                {solutionCached ? <StudyCacheMark label={copy.cachedFromDb} /> : null}
              </div>
              <p className="text-sm leading-7">
                <StudyFormulaText text={solution} />
              </p>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => void openSolution()} disabled={solutionBusy}>
              {solutionBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.solutionOpening}
                </span>
              ) : (
                solutionLabel
              )}
            </Button>
          )}
          {solutionError ? <p className="text-sm text-destructive">{solutionError}</p> : null}
        </section>
      ) : null}

      <Dialog
        open={tagOpen != null}
        onOpenChange={(open) => {
          if (!open) closeTag()
        }}
      >
        <DialogContent
          className="z-[80] flex max-h-[min(32rem,85dvh)] w-[calc(100%-1.5rem)] max-w-md flex-col gap-3 overflow-hidden p-4 sm:p-6 [&>button]:z-20 [&>button]:bg-background"
          overlayClassName="z-[70]"
        >
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle>{tagAnswer?.title || tagOpen?.title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tagBusy ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.tagLoading}
              </p>
            ) : null}
            {tagError ? <p className="text-sm text-destructive">{tagError}</p> : null}
            {tagAnswer ? (
              <div className="space-y-3">
                {tagAnswer.share !== 'private' ? <StudyCacheMark label={copy.cachedFromDb} /> : null}
                <section className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.explain}</h3>
                  <p className="text-sm leading-7">
                    <StudyFormulaText text={tagAnswer.explanation} />
                  </p>
                </section>
                {tagAnswer.practice ? (
                  <section className="space-y-1 rounded-lg bg-muted p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.practice}</h3>
                    <p className="text-sm leading-7">
                      <StudyFormulaText text={tagAnswer.practice} />
                    </p>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  )
}

