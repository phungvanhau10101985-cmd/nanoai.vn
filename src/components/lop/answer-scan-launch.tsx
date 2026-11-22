'use client'

import { useCallback, useEffect, useState } from 'react'
import { Camera, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TeacherPhoneRemoteDialog } from '@/app/tao-giao-trinh/components/teacher-phone-remote-dialog'
import { extractQuizFromSlide } from '@/app/tao-giao-trinh/components/quiz-popup-dialog'
import { detectAppleSlideDevice } from '@/app/tao-giao-trinh/lib/apple-slide-shell'
import { phoneRemoteLoginOrigin } from '@/app/tao-giao-trinh/lib/phone-remote-client'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { parseQuizData } from '@/lib/parse-quiz-data'
type ScanQuestionInput = { prompt: string; choices: string[]; correctIndex: number }

type ReadySource = {
  classId: string
  sourceKind: 'exam' | 'worksheet'
  sourceId: string
}

type RoundReady = ReadySource & { id: string; phonePath: string; questionCount: number }

export function scannerOpensOnThisDevice(): boolean {
  if (typeof window === 'undefined') return false
  if (detectAppleSlideDevice() === 'ios') return true
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true
  return window.innerWidth < 768
}

type ClassChoice = { id: string; name: string }

export function scanQuestionsFromSlide(slide: {
  title?: string
  blocks?: Array<{ header?: string; content?: string }>
  content?: string
  visualEmbed?: string
  visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>
}): ScanQuestionInput[] {
  return extractQuizFromSlide(slide).flatMap((quiz) => {
    const parsed = parseQuizData(quiz.urlOrId)
    if (!parsed) return []
    return [{
      prompt: parsed.question,
      choices: parsed.options.slice(0, 4),
      correctIndex: parsed.correctIndex,
    }]
  })
}

export function AnswerScanLaunch({
  examCode,
  worksheetId,
  curriculumId,
  questions,
  phoneMode = false,
  tone = 'light',
  onShowStudent,
  className,
  presentation = 'toolbar',
  questionIndex,
}: {
  examCode?: string
  worksheetId?: string
  curriculumId?: string
  questions?: ScanQuestionInput[]
  phoneMode?: boolean
  tone?: 'light' | 'dark'
  onShowStudent?: (href: string) => void | Promise<void>
  className?: string
  /** toolbar: hai nút trên máy giáo viên. board: một nút trên bảng đề học sinh. */
  presentation?: 'toolbar' | 'board'
  questionIndex?: number
}) {
  const [locale, setLocale] = useState<WebLocale>('vi')
  const t = getDictionary(locale).classes
  const [source, setSource] = useState<ReadySource | null>(null)
  const [classes, setClasses] = useState<ClassChoice[]>([])
  const [classId, setClassId] = useState('')
  const [hidden, setHidden] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [loginUrl, setLoginUrl] = useState<string | null>(null)
  const lookup = [examCode ?? '', worksheetId ?? '', curriculumId ?? ''].join('|')

  useEffect(() => {
    setLocale(readWebLocaleFromDocumentCookie())
  }, [])

  useEffect(() => {
    let cancel = false
    const params = new URLSearchParams()
    if (examCode?.trim()) params.set('examCode', examCode.trim())
    else if (worksheetId?.trim()) params.set('worksheetId', worksheetId.trim())
    else if (curriculumId?.trim()) params.set('curriculumId', curriculumId.trim())
    else {
      setHidden(true)
      return
    }
    setHidden(true)
    setSource(null)
    setClasses([])
    void fetch(`/api/lop/answer-cards/context?${params.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (cancel || !res.ok || !data || data.none) return
        if (typeof data.classId === 'string' && typeof data.sourceId === 'string') {
          const kind = data.sourceKind === 'exam' ? 'exam' : 'worksheet'
          setSource({ classId: data.classId, sourceKind: kind, sourceId: data.sourceId })
          setClassId(data.classId)
          setHidden(false)
          return
        }
        const list = Array.isArray(data.classes) ? data.classes as ClassChoice[] : []
        if (list.length === 0 || typeof data.sourceId !== 'string') return
        const kind = data.sourceKind === 'exam' ? 'exam' : 'worksheet'
        setClasses(list.filter((item) => item && typeof item.id === 'string'))
        setClassId(list[0]?.id ?? '')
        setSource({ classId: list[0]?.id ?? '', sourceKind: kind, sourceId: data.sourceId })
        setHidden(false)
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [lookup, examCode, worksheetId, curriculumId])

  const ensureRound = useCallback(async (): Promise<RoundReady | null> => {
    const picked = classes.length > 0 && source ? { ...source, classId } : source
    if (!picked?.classId || !picked.sourceId) return null
    const sourceKind = picked.sourceKind === 'exam' ? 'exam' : picked.sourceKind === 'worksheet' ? 'worksheet' : null
    if (!sourceKind) return null
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/lop/${picked.classId}/answer-cards/rounds`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceKind,
          sourceId: picked.sourceId,
          questions: questions && questions.length > 0 ? questions : undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      const questionCount = Array.isArray(data?.questions) ? data.questions.length : Number(data?.questionCount)
      if (!res.ok || !data?.id || typeof data.phonePath !== 'string' || !Number.isInteger(questionCount) || questionCount < 1) {
        setError(data?.error === 'no_mcq'
          ? t.answerCardsNoMcq
          : data?.error === 'schema'
            ? t.answerCardsSchema
            : t.answerCardsLoadError)
        return null
      }
      return {
        classId: picked.classId,
        sourceKind,
        sourceId: picked.sourceId,
        id: String(data.id),
        phonePath: String(data.phonePath),
        questionCount,
      }
    } catch {
      setError(t.answerCardsLoadError)
      return null
    } finally {
      setBusy(false)
    }
  }, [classes.length, classId, source, questions, t.answerCardsLoadError, t.answerCardsNoMcq, t.answerCardsSchema])

  const showStudent = useCallback(async (round: RoundReady) => {
    const href = `/lop/${round.classId}/the-tra-loi/chieu/${round.id}`
    if (onShowStudent) {
      await onShowStudent(href)
      return
    }
    const sw = typeof screen !== 'undefined' ? screen.availWidth || 1920 : 1920
    const sh = typeof screen !== 'undefined' ? screen.availHeight || 1080 : 1080
    const opened = window.open(href, 'chieu-tra-loi', `width=${sw},height=${sh},left=0,top=0,scrollbars=yes`)
    try { opened?.focus() } catch { /* ignore */ }
  }, [onShowStudent])

  const scanHere = useCallback(async () => {
    const round = await ensureRound()
    if (!round) return
    await showStudent(round)
    if (phoneMode) {
      window.location.assign(round.phonePath)
      return
    }
    window.open(round.phonePath, 'quet-the-giao-vien', 'width=420,height=780,scrollbars=yes')
  }, [ensureRound, phoneMode, showStudent])

  const connectQuestion = useCallback(async (index: number | undefined): Promise<RoundReady | null> => {
    const round = await ensureRound()
    if (!round) return null
    if (index == null) return round
    if (index < 0 || index >= round.questionCount) {
      setError(t.answerCardsNoMcq)
      return null
    }
    const res = await fetch(`/api/lop/answer-cards/rounds/${round.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'focus', questionIndex: index }),
    })
    if (!res.ok) {
      setError(t.answerCardsLoadError)
      return null
    }
    return round
  }, [ensureRound, t.answerCardsLoadError, t.answerCardsNoMcq])

  const openOnBoard = useCallback(async () => {
    const round = await connectQuestion(questionIndex)
    if (!round) return
    if (scannerOpensOnThisDevice()) {
      window.location.assign(round.phonePath)
      return
    }
    const origin = await phoneRemoteLoginOrigin()
    setLoginUrl(`${origin}${round.phonePath}`)
    setQrOpen(true)
  }, [connectQuestion, questionIndex])

  const openPhone = useCallback(async () => {
    const round = await ensureRound()
    if (!round) return
    await showStudent(round)
    const origin = await phoneRemoteLoginOrigin()
    setLoginUrl(`${origin}${round.phonePath}`)
    setQrOpen(true)
  }, [ensureRound, showStudent])

  if (hidden || !source) return null

  const dark = tone === 'dark'
  const buttonTone = dark
    ? 'border-slate-500 bg-slate-800 text-slate-100 hover:bg-slate-700'
    : ''
  const dialog = (
    <TeacherPhoneRemoteDialog
      open={qrOpen}
      loginUrl={loginUrl}
      error={error}
      busy={busy}
      onClose={() => setQrOpen(false)}
      title={t.answerScanDialogTitle}
      lead={t.answerScanDialogLead}
      layerClassName="z-[140]"
      tr={(vi, en, zh, ja, ko) => {
        const locale = readWebLocaleFromDocumentCookie()
        if (locale === 'en') return en
        if (locale === 'zh') return zh
        if (locale === 'ja') return ja
        if (locale === 'ko') return ko
        return vi
      }}
    />
  )

  if (presentation === 'board') {
    return (
      <div className={className ? `${className} flex flex-wrap items-center gap-2` : 'mt-3 flex flex-wrap items-center gap-2'}>
        {classes.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t.answerScanPickClass}</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <Button type="button" size="sm" disabled={busy} onClick={() => { void openOnBoard() }}>
          <Camera className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {busy ? '…' : t.answerScanResult}
        </Button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {dialog}
      </div>
    )
  }

  return (
    <div className={className ? `${className} flex flex-wrap items-center gap-2` : 'flex flex-wrap items-center gap-2'}>
      {classes.length > 1 ? (
        <label className={`flex items-center gap-2 text-xs ${dark ? 'text-slate-300' : 'text-muted-foreground'}`}>
          <span>{t.answerScanPickClass}</span>
          <select
            className={`h-8 rounded-md border px-2 text-sm ${dark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-input bg-background'}`}
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant={dark ? 'outline' : 'default'}
        className={buttonTone}
        disabled={busy}
        onClick={() => { void scanHere() }}
      >
        <Camera className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {busy ? '…' : t.answerScanNow}
      </Button>
      {phoneMode ? null : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={buttonTone}
          disabled={busy}
          onClick={() => { void openPhone() }}
        >
          <Smartphone className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {t.answerScanPhone}
        </Button>
      )}
      {error ? <p className={`text-xs ${dark ? 'text-rose-300' : 'text-destructive'}`}>{error}</p> : null}
      {dialog}
    </div>
  )
}
