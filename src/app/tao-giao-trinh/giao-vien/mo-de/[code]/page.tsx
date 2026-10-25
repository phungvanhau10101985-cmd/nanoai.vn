'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { playExamEndBell, unlockExamBellAudio } from '@/lib/exam-end-bell'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import type { WebLocale } from '@/lib/i18n/config'

type PaperQuestion = {
  index: number
  questionText: string
  options: string[]
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function deadlineKey(code: string): string {
  return `nanoai-exam-paper-deadline:${code}`
}

export default function TeacherExamPaperPage() {
  const params = useParams<{ code?: string }>()
  const code = String(params?.code ?? '').trim().toUpperCase()
  const [locale, setLocale] = useState<WebLocale>('vi')
  const tx = getDictionary(locale).createExamPage
  const [loading, setLoading] = useState(true)
  const [errorKind, setErrorKind] = useState<'forbidden' | 'failed' | null>(null)
  const [title, setTitle] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(0)
  const [questions, setQuestions] = useState<PaperQuestion[]>([])
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
        setTitle(String(data.title ?? '').trim() || code)
        const minutes = Number(data.durationMinutes)
        setDurationMinutes(Number.isFinite(minutes) && minutes > 0 ? minutes : 15)
        setQuestions(list)
        try {
          const raw = window.sessionStorage.getItem(deadlineKey(code))
          const saved = raw ? Number(raw) : NaN
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

  const start = useCallback(() => {
    if (deadlineAt != null || timeUp || durationMinutes <= 0) return
    audioRef.current = unlockExamBellAudio()
    const next = Date.now() + durationMinutes * 60_000
    setDeadlineAt(next)
    setNow(Date.now())
    try {
      window.sessionStorage.setItem(deadlineKey(code), String(next))
    } catch {
      /* ignore */
    }
  }, [code, deadlineAt, durationMinutes, timeUp])

  const remaining = deadlineAt == null ? durationMinutes * 60_000 : Math.max(0, deadlineAt - now)
  const started = deadlineAt != null

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-white text-slate-900">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-8">
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
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  )
}
