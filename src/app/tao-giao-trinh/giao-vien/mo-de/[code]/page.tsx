'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { phoneOpenableUrl } from '@/app/tao-giao-trinh/lib/phone-remote-client'
import { ChieuTheTraLoiClient } from '@/app/lop/[id]/the-tra-loi/chieu/[roundId]/chieu-client'
import { scannerOpensOnThisDevice } from '@/components/lop/answer-scan-launch'
import type { AnswerCardRoundView } from '@/lib/db/answer-card-pg'
import { readPaperDeadline, writePaperDeadline } from '@/lib/lop/scan-wait'
import { playExamEndBell, unlockExamBellAudio } from '@/lib/exam-end-bell'
import { openTeacherHomeworkThinkingGuide } from '@/app/ho-tro-lam-bai/teacher-thinking-action'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import type { WebLocale } from '@/lib/i18n/config'

type PaperQuestion = {
  index: number
  questionText: string
  options: string[]
  canScan?: boolean
  id?: string
}

type HomeworkHint = {
  id: string
  status: 'loading' | 'ready' | 'empty' | 'failed'
  lines: string[]
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function TeacherExamPaperPage() {
  const params = useParams<{ code?: string }>()
  const code = String(params?.code ?? '').trim().toUpperCase()
  const [locale, setLocale] = useState<WebLocale>('vi')
  const tx = getDictionary(locale).createExamPage
  const classes = getDictionary(locale).classes
  const [scanBusy, setScanBusy] = useState(false)
  const [scanQr, setScanQr] = useState('')
  const [scanBoard, setScanBoard] = useState<{ classId: string; roundId: string } | null>(null)
  const [overlayRound, setOverlayRound] = useState<AnswerCardRoundView | null>(null)
  const [gradeError, setGradeError] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorKind, setErrorKind] = useState<'forbidden' | 'failed' | null>(null)
  const [title, setTitle] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(0)
  const [questions, setQuestions] = useState<PaperQuestion[]>([])
  const [practiceHomework, setPracticeHomework] = useState(false)
  const [hint, setHint] = useState<HomeworkHint | null>(null)
  const hintRef = useRef<HomeworkHint | null>(null)
  const hintCacheRef = useRef(new Map<string, string[]>())
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [timeUp, setTimeUp] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const bellPlayedRef = useRef(false)

  useEffect(() => {
    setLocale(readWebLocaleFromDocumentCookie())
  }, [])

  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current || audioRef.current.state === 'closed') {
        audioRef.current = unlockExamBellAudio()
      } else {
        void audioRef.current.resume().catch(() => {})
      }
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    if (!code) {
      setLoading(false)
      setErrorKind('failed')
      return
    }
    let cancelled = false
    setLoading(true)
    setErrorKind(null)
    fetch(`/api/exam-session/${encodeURIComponent(code)}/paper`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.status === 403) {
          setErrorKind('forbidden')
          return
        }
        if (!res.ok) {
          setErrorKind('failed')
          return
        }
        const list = Array.isArray(data.questions) ? (data.questions as PaperQuestion[]) : []
        setPracticeHomework(data.practiceHomework === true)
        hintRef.current = null
        setHint(null)
        setTitle(String(data.title ?? '').trim() || code)
        const minutes = Number(data.durationMinutes)
        setDurationMinutes(Number.isFinite(minutes) && minutes > 0 ? minutes : 15)
        setQuestions(list)
        try {
          const saved = readPaperDeadline(code) ?? NaN
          if (Number.isFinite(saved) && saved > Date.now()) setDeadlineAt(saved)
          else if (Number.isFinite(saved) && saved <= Date.now()) setTimeUp(true)
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (!cancelled) setErrorKind('failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [code])

  useEffect(() => {
    if (deadlineAt == null || timeUp) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [deadlineAt, timeUp])

  useEffect(() => {
    if (deadlineAt == null || timeUp) return
    if (now < deadlineAt) return
    setTimeUp(true)
    if (bellPlayedRef.current) return
    bellPlayedRef.current = true
    playExamEndBell(audioRef.current)
  }, [deadlineAt, now, timeUp])

  const openHint = useCallback(async (questionId: string) => {
    const current = hintRef.current
    if (current?.id === questionId) {
      hintRef.current = null
      setHint(null)
      return
    }
    const cached = hintCacheRef.current.get(questionId)
    if (cached) {
      const next: HomeworkHint = { id: questionId, status: 'ready', lines: cached }
      hintRef.current = next
      setHint(next)
      return
    }
    const loading: HomeworkHint = { id: questionId, status: 'loading', lines: [] }
    hintRef.current = loading
    setHint(loading)
    try {
      const result = await openTeacherHomeworkThinkingGuide({
        locale,
        examCode: code,
        questionId,
      })
      if (hintRef.current?.id !== questionId) return
      if (!result.ok) {
        const next: HomeworkHint = {
          id: questionId,
          status: result.code === 'empty' ? 'empty' : 'failed',
          lines: [],
        }
        hintRef.current = next
        setHint(next)
        return
      }
      hintCacheRef.current.set(questionId, result.lines)
      const next: HomeworkHint = { id: questionId, status: 'ready', lines: result.lines }
      hintRef.current = next
      setHint(next)
    } catch {
      if (hintRef.current?.id !== questionId) return
      const next: HomeworkHint = { id: questionId, status: 'failed', lines: [] }
      hintRef.current = next
      setHint(next)
    }
  }, [code, locale])

  const start = useCallback(() => {
    if (deadlineAt != null || timeUp || durationMinutes <= 0) return
    audioRef.current = unlockExamBellAudio()
    const next = Date.now() + durationMinutes * 60_000
    setDeadlineAt(next)
    setNow(Date.now())
    try {
      writePaperDeadline(code, next)
    } catch {
      /* ignore */
    }
  }, [code, deadlineAt, durationMinutes, timeUp])

  const remaining = deadlineAt == null ? durationMinutes * 60_000 : Math.max(0, deadlineAt - now)
  const started = deadlineAt != null
  const canScan = questions.some((item) => item.canScan === true)

  const scanBaseline = useRef<{ revealedAt: string; summary: boolean } | null>(null)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const roundId = query.get('vong')?.trim() ?? ''
    const classId = query.get('lop')?.trim() ?? ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roundId)) return
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)) return
    setScanBoard({ classId, roundId })
  }, [])

  useEffect(() => {
    if (!scanBoard || overlayRound) return
    let stop = false
    let pending = false
    scanBaseline.current = null
    const tick = async () => {
      if (pending || stop) return
      pending = true
      try {
        const res = await fetch(`/api/lop/answer-cards/rounds/${scanBoard.roundId}`, { cache: 'no-store' })
        if (!res.ok || stop) return
        const data = await res.json().catch(() => null) as AnswerCardRoundView | null
        const revealedAt = data?.revealedAt ? String(data.revealedAt) : ''
        const revealed = Number(data?.revealedQuestionIndex)
        const recorded = Boolean(revealedAt) && Number.isInteger(revealed)
        const summary = Boolean(data?.showSummary)
        const baseline = scanBaseline.current
        if (!baseline) {
          scanBaseline.current = { revealedAt, summary }
          return
        }
        const ghi = recorded && revealedAt !== baseline.revealedAt
        const xong = summary && !baseline.summary
        scanBaseline.current = { revealedAt, summary }
        if (stop || (!ghi && !xong) || !data?.id) return
        setOverlayRound(data)
      } finally {
        pending = false
      }
    }
    void tick()
    const timer = window.setInterval(() => { void tick() }, 1000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [scanBoard, overlayRound])

  const connectScan = useCallback(async () => {
    if (!code || scanBusy) return
    setScanBusy(true)
    setGradeError('')
    try {
      const ctxRes = await fetch(`/api/lop/answer-cards/context?examCode=${encodeURIComponent(code)}`, { cache: 'no-store' })
      const ctx = await ctxRes.json().catch(() => null) as { classId?: string; sourceId?: string } | null
      if (!ctxRes.ok || !ctx?.classId || !ctx.sourceId) {
        setGradeError(classes.answerCardsLoadError)
        return
      }
      const res = await fetch(`/api/lop/${ctx.classId}/answer-cards/rounds`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceKind: 'exam',
          sourceId: ctx.sourceId,
          displayedChoices: questions
            .filter((item) => item.canScan && item.id && item.options.length >= 2)
            .map((item) => ({ id: item.id, choices: item.options })),
        }),
      })
      const data = await res.json().catch(() => null) as {
        id?: string
        phonePath?: string
        error?: string
      } | null
      if (!res.ok || !data?.id || typeof data.phonePath !== 'string') {
        setGradeError(
          data?.error === 'no_mcq'
            ? classes.answerCardsNoMcq
            : data?.error === 'schema'
              ? classes.answerCardsSchema
              : classes.answerCardsLoadError
        )
        return
      }
      if (scannerOpensOnThisDevice()) {
        window.location.assign(data.phonePath)
        return
      }
      const url = await phoneOpenableUrl(data.phonePath)
      let tunnelHost = ''
      try {
        tunnelHost = new URL(url).hostname
      } catch {
        tunnelHost = ''
      }
      if (!url.startsWith('https://') || tunnelHost.endsWith('ngrok-free.dev') || tunnelHost.endsWith('ngrok.io') || tunnelHost.endsWith('ngrok.app')) {
        setGradeError(classes.answerCardsTunnelMissing)
        return
      }
      const QRCode = (await import('qrcode')).default
      const image = await QRCode.toDataURL(url, { margin: 1, width: 320 })
      setScanBoard({ classId: ctx.classId, roundId: data.id })
      setScanQr(image)
    } catch {
      setGradeError(classes.answerCardsLoadError)
    } finally {
      setScanBusy(false)
    }
  }, [
    classes.answerCardsLoadError,
    classes.answerCardsNoMcq,
    classes.answerCardsSchema,
    classes.answerCardsTunnelMissing,
    code,
    questions,
    scanBusy,
  ])

  const requestScan = useCallback(() => {
    void connectScan()
  }, [connectScan])

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-white text-slate-900">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-8">
        {gradeError ? <p className="mb-4 text-sm text-red-600">{gradeError}</p> : null}
        {loading ? (
          <p className="text-sm text-slate-500">{tx.teacherPaperLoading}</p>
        ) : errorKind === 'forbidden' ? (
          <p className="text-sm text-slate-600">{tx.teacherPaperForbidden}</p>
        ) : errorKind === 'failed' ? (
          <p className="text-sm text-slate-600">{tx.teacherPaperLoadFailed}</p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <h1 className="text-xl font-semibold leading-snug">{title}</h1>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canScan && !scanQr && !scanBoard ? (
                  <button
                    type="button"
                    onClick={requestScan}
                    disabled={scanBusy}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {scanBusy ? '…' : classes.answerScanResult}
                  </button>
                ) : null}
                {started || timeUp ? (
                  <p
                    className={`font-mono text-3xl tabular-nums ${timeUp ? 'text-red-600' : 'text-slate-900'}`}
                    aria-live="polite"
                  >
                    {timeUp ? tx.teacherPaperTimeUp : formatClock(remaining)}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={start}
                    className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {tx.teacherPaperStart}
                  </button>
                )}
              </div>
            </div>
            {scanQr ? (
              <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- một mã nối cả bài thi */}
                <img src={scanQr} alt="" className="h-40 w-40 rounded-lg bg-white" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{classes.answerScanDialogTitle}</p>
                  <p className="mt-1 text-sm text-slate-600">{classes.answerCardsConnectLead}</p>
                </div>
              </div>
            ) : null}
            {questions.length === 0 ? (
              <p className="text-sm text-slate-500">{tx.teacherPaperEmpty}</p>
            ) : (
              <ol className="space-y-6 pb-10">
                {questions.map((q) => (
                  <li key={q.index} className="space-y-2">
                    <p className="whitespace-pre-wrap text-base leading-relaxed">
                      <span className="font-semibold">{tx.teacherPaperQuestion} {q.index}. </span>
                      {latexToReadable(q.questionText)}
                    </p>
                    {q.options.length > 0 ? (
                      <ul className="space-y-1 pl-1 text-base leading-relaxed">
                        {q.options.map((opt, i) => (
                          <li key={`${q.index}-${i}`} className="whitespace-pre-wrap">
                            {String.fromCharCode(65 + i)}. {latexToReadable(opt)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {practiceHomework && q.id ? (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => { void openHint(q.id as string) }}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-800 hover:bg-slate-50"
                        >
                          {hint?.id === q.id ? tx.teacherPaperHintClose : tx.teacherPaperHint}
                        </button>
                        {hint?.id === q.id ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {tx.teacherPaperThinking}
                            </p>
                            {hint.status === 'loading' ? (
                              <p className="mt-1 text-sm text-slate-500">{tx.teacherPaperThinkingLoading}</p>
                            ) : null}
                            {hint.status === 'empty' ? (
                              <p className="mt-1 text-sm text-slate-600">{tx.teacherPaperThinkingEmpty}</p>
                            ) : null}
                            {hint.status === 'failed' ? (
                              <p className="mt-1 text-sm text-red-600">{tx.teacherPaperThinkingFailed}</p>
                            ) : null}
                            {hint.status === 'ready' ? (
                              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-6">
                                {hint.lines.map((line, lineIndex) => (
                                  <li key={`${q.index}-${lineIndex}`} className="whitespace-pre-wrap">{latexToReadable(line)}</li>
                                ))}
                              </ol>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
      {overlayRound && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[220]">
              <ChieuTheTraLoiClient
                initial={overlayRound}
                subjectQuery=""
                t={classes}
                onClose={() => setOverlayRound(null)}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
