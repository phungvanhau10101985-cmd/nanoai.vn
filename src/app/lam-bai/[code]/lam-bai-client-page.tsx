'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RefreshCw, CheckCircle, Clock, Share2, Play, Camera } from 'lucide-react'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { StudentBirthDateSelects } from '@/components/student-birth-date-selects'
import { buildDob, formatDobDisplay, isValidStudentDobIso, splitDob } from '@/lib/student-dob'
import { joinClassForActiveExam } from '@/app/lop/actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { computeExamScoresOn100And10 } from '@/lib/exam-feedback'
import { compressEssayImageForUpload } from '@/lib/exam-essay-client-image'
import { EXAM_ESSAY_IMAGE_RETENTION_DAYS, formatExamEssayImageExpireAtForUi } from '@/lib/exam-essay-config'
import { cn } from '@/lib/utils'

const EXAM_ESSAY_MAX_IMAGES = 10
const ALLOWED_ESSAY_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

type Question = {
  id: string
  index: number
  type?: 'quiz' | 'essay'
  question_text: string
  options: string[]
}
const STUDENT_PROFILE_STORAGE_KEY = 'exam-session:student-profile:v1'

function fillExamTemplate(template: string, vars: Record<string, string | number>) {
  let out = template
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(val))
  }
  return out
}

function formatExamScaleNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function resolveScoreOn100FromApi(score: number, maxScore: number, raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const parsed = Number(raw)
  if (Number.isFinite(parsed)) return parsed
  return computeExamScoresOn100And10(score, maxScore).scoreOn100
}

function resolveGrade10FromApi(score: number, maxScore: number, raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const parsed = Number(raw)
  if (Number.isFinite(parsed)) return parsed
  return computeExamScoresOn100And10(score, maxScore).grade10
}

function normalizeName(input: string): string {
  return String(input || '').replace(/\s+/g, ' ').trim()
}

type ExamScoringBreakdown = {
  quizCorrect: number
  quizTotal: number
  quizPoints: number
  quizPointsMax: number
  essayPointsMax: number
  /** ISO: mốc gợi ý hết hạn lưu ảnh TL (khi có ảnh) */
  essayImageUrlsExpireAt?: string | null
}

function parseScoringBreakdown(raw: unknown): ExamScoringBreakdown | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const essayPointsMax = Number(o.essayPointsMax)
  const quizTotal = Number(o.quizTotal)
  /** Cho phép essayPointsMax = 0 (đề chỉ trắc nghiệm) hoặc quizTotal = 0 (đề chỉ tự luận). */
  if (!Number.isFinite(essayPointsMax) || essayPointsMax < 0) return null
  if (!Number.isFinite(quizTotal) || quizTotal < 0) return null
  if (quizTotal <= 0 && essayPointsMax <= 0) return null
  const quizCorrect = Number(o.quizCorrect)
  const quizPoints = Number(o.quizPoints)
  const quizPointsMax = Number(o.quizPointsMax)
  if (!Number.isFinite(quizCorrect) || !Number.isFinite(quizPoints) || !Number.isFinite(quizPointsMax)) {
    return null
  }
  const expRaw = o.essayImageUrlsExpireAt
  const essayImageUrlsExpireAt =
    typeof expRaw === 'string' && expRaw.trim() ? expRaw.trim() : null
  return {
    quizCorrect: Math.max(0, Math.floor(quizCorrect)),
    quizTotal: Math.max(0, Math.floor(quizTotal)),
    quizPoints: Math.max(0, quizPoints),
    quizPointsMax: Math.max(0, quizPointsMax),
    essayPointsMax: Math.max(0, essayPointsMax),
    ...(essayImageUrlsExpireAt ? { essayImageUrlsExpireAt } : {}),
  }
}

function playBell() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      const t = ctx.currentTime + i * 0.3
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25)
      osc.start(t)
      osc.stop(t + 0.25)
    }
  } catch {}
}

export default function LamBaiClientPage({
  code,
  t,
}: {
  code: string
  t: Dictionary['classes']
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enrollmentGate, setEnrollmentGate] = useState<{
    title: string
    durationMinutes: number
    className: string | null
    schoolName: string | null
    practiceHomework: boolean
  } | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [enrollSubmitting, setEnrollSubmitting] = useState(false)
  const { toast } = useToast()
  const [exam, setExam] = useState<{
    title: string
    durationMinutes: number
    questions: Question[]
    practiceHomework: boolean
  } | null>(null)
  /** JWT map đáp án hiển thị → chỉ số gốc — bắt buộc khi nộp bài */
  const [layoutToken, setLayoutToken] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  /** Ảnh bài làm tự luận — URL public sau upload */
  const [essayImageUrls, setEssayImageUrls] = useState<Record<string, string[]>>({})
  const essayImageUrlsRef = useRef<Record<string, string[]>>({})
  const [essayUploadingId, setEssayUploadingId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState('')
  const [studentDob, setStudentDob] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [useSavedProfile, setUseSavedProfile] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [examStarted, setExamStarted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    score: number
    maxScore: number
    grade10: number
    scoreOn100: number
    comment: string
    shareHint: string
    scoringBreakdown: ExamScoringBreakdown | null
    practiceHomework?: boolean
  } | null>(null)
  /** Kết quả tải từ server (đã nộp trước đó, ví dụ thiết bị khác) — hiển thị thông báo kèm kết quả */
  const [priorSubmissionResult, setPriorSubmissionResult] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [shared, setShared] = useState(false)
  const [now, setNow] = useState(Date.now())
  const autoSubmittedRef = useRef(false)
  const bellPlayedRef = useRef(false)
  const fiveMinuteWarnedRef = useRef(false)
  /** Sau khi tham gia lớp từ cổng đề thi — tải lại đề xong thì vào làm bài luôn (không chờ bấm Bắt đầu). */
  const autoStartExamAfterEnrollRef = useRef(false)
  const submitResultRef = useRef<HTMLDivElement>(null)
  const [fiveMinuteWarning, setFiveMinuteWarning] = useState(false)
  /** Đề gắn lớp + đã có member_display_name & birth_date — không bắt nhập lại form trước khi bấm Bắt đầu */
  const [identityFromClassRoster, setIdentityFromClassRoster] = useState(false)
  /** RSC truyền `t` object mới mỗi render — không dùng làm deps useEffect tải phiên (tránh loading nhấp nháy). */
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { name?: unknown; dob?: unknown }
      const savedName = normalizeName(String(parsed?.name ?? ''))
      const savedDob = String(parsed?.dob ?? '')
      if (savedName && isValidStudentDobIso(savedDob)) {
        setStudentName(savedName)
        setStudentDob(savedDob)
        const parts = splitDob(savedDob)
        setDobDay(parts.day)
        setDobMonth(parts.month)
        setDobYear(parts.year)
        setUseSavedProfile(true)
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  useEffect(() => {
    const nextDob = buildDob(dobDay, dobMonth, dobYear)
    setStudentDob(nextDob)
  }, [dobDay, dobMonth, dobYear])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setPriorSubmissionResult(false)
    const sessionUrl = `/api/exam-session/${encodeURIComponent(code)}?_=${Date.now()}`
    fetch(sessionUrl, { cache: 'no-store', headers: { Pragma: 'no-cache' } })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        return { ok: r.ok, data }
      })
      .then(({ ok, data }) => {
        if (cancelled) return
        const tc = tRef.current
        if (!ok) {
          autoStartExamAfterEnrollRef.current = false
          setIdentityFromClassRoster(false)
          setEnrollmentGate(null)
          setExam(null)
          setLayoutToken(null)
          setError(typeof data?.error === 'string' ? data.error : tc.examLoadFailed)
          return
        }
        if (data.alreadySubmitted === true) {
          autoStartExamAfterEnrollRef.current = false
          setIdentityFromClassRoster(false)
          setEnrollmentGate(null)
          setLayoutToken(null)
          const practiceHw = data.practiceHomework === true
          const title =
            (typeof data.title === 'string' && data.title.trim()) ||
            (practiceHw ? tc.homeworkDefaultTitle : tc.examDefaultTitle)
          const durationMinutes =
            typeof data.durationMinutes === 'number' && Number.isFinite(data.durationMinutes)
              ? data.durationMinutes
              : 15
          setExam({ title, durationMinutes, questions: [], practiceHomework: practiceHw })
          const sc = typeof data.score === 'number' ? data.score : Number(data.score ?? 0)
          const mx = typeof data.maxScore === 'number' ? data.maxScore : Number(data.maxScore ?? 0)
          const scN = Number.isFinite(sc) ? sc : 0
          const mxN = Number.isFinite(mx) ? mx : 0
          setResult({
            score: scN,
            maxScore: mxN,
            grade10: resolveGrade10FromApi(scN, mxN, data.grade10),
            scoreOn100: resolveScoreOn100FromApi(scN, mxN, data.scoreOn100),
            comment: typeof data.comment === 'string' ? data.comment : '',
            shareHint: typeof data.shareHint === 'string' ? data.shareHint : '',
            scoringBreakdown: parseScoringBreakdown(data.scoringBreakdown),
            practiceHomework: practiceHw,
          })
          setPriorSubmissionResult(true)
          setExamStarted(false)
          return
        }
        if (data.needsEnrollment) {
          autoStartExamAfterEnrollRef.current = false
          setIdentityFromClassRoster(false)
          setEnrollmentGate({
            title:
              (typeof data.title === 'string' && data.title.trim()) ||
              (data.practiceHomework === true ? tc.homeworkDefaultTitle : tc.examDefaultTitle),
            durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : 15,
            className: typeof data.className === 'string' ? data.className : null,
            schoolName: typeof data.schoolName === 'string' ? data.schoolName : null,
            practiceHomework: data.practiceHomework === true,
          })
          setExam(null)
          setLayoutToken(null)
          return
        }
        const ci = data.classExamIdentity as { displayName?: unknown; birthDate?: unknown } | null | undefined
        let appliedClassIdentity = false
        if (
          ci &&
          typeof ci === 'object' &&
          typeof ci.displayName === 'string' &&
          typeof ci.birthDate === 'string'
        ) {
          const dn = normalizeName(ci.displayName)
          const bd = ci.birthDate.trim()
          if (dn.length >= 2 && isValidStudentDobIso(bd)) {
            setStudentName(dn)
            setStudentDob(bd)
            const parts = splitDob(bd)
            setDobDay(parts.day)
            setDobMonth(parts.month)
            setDobYear(parts.year)
            setUseSavedProfile(true)
            setEditingProfile(false)
            setIdentityFromClassRoster(true)
            appliedClassIdentity = true
            try {
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(
                  STUDENT_PROFILE_STORAGE_KEY,
                  JSON.stringify({ name: dn, dob: bd })
                )
              }
            } catch {
              // ignore
            }
          }
        }
        if (!appliedClassIdentity) {
          setIdentityFromClassRoster(false)
        }
        const layoutTok = typeof data.layoutToken === 'string' ? data.layoutToken : null
        const questions = Array.isArray(data.questions) ? data.questions : []
        const loadedIsHomework = data.practiceHomework === true
        const defaultTitle = loadedIsHomework ? tc.homeworkDefaultTitle : tc.examDefaultTitle
        setEnrollmentGate(null)
        setLayoutToken(layoutTok)
        setPriorSubmissionResult(false)
        setExam({
          title: (typeof data.title === 'string' && data.title.trim()) || defaultTitle,
          durationMinutes: data.durationMinutes || 15,
          questions,
          practiceHomework: loadedIsHomework,
        })
        if (
          autoStartExamAfterEnrollRef.current &&
          questions.length > 0 &&
          layoutTok?.trim()
        ) {
          autoStartExamAfterEnrollRef.current = false
          setExamStarted(true)
          setStartedAt(Date.now())
          setFiveMinuteWarning(false)
          fiveMinuteWarnedRef.current = false
          autoSubmittedRef.current = false
          bellPlayedRef.current = false
        }
      })
      .catch((e) => {
        if (!cancelled) {
          autoStartExamAfterEnrollRef.current = false
          setIdentityFromClassRoster(false)
          setEnrollmentGate(null)
          setExam(null)
          setError(e instanceof Error ? e.message : String(e))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [code, reloadNonce])

  useEffect(() => {
    if (!exam || result || !examStarted) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [exam, result, examStarted])

  useEffect(() => {
    essayImageUrlsRef.current = essayImageUrls
  }, [essayImageUrls])

  const handleAnswer = (questionId: string, answer: number | string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const uploadEssayImage = useCallback(
    async (questionId: string, file: File): Promise<boolean> => {
      if (!ALLOWED_ESSAY_IMAGE_MIME.has(file.type)) {
        toast({ variant: 'destructive', description: t.examEssayUploadFailed })
        return false
      }
      if (!layoutToken?.trim()) {
        toast({ variant: 'destructive', description: t.examEssayUploadFailed })
        return false
      }
      const cur = essayImageUrlsRef.current[questionId] ?? []
      if (cur.length >= EXAM_ESSAY_MAX_IMAGES) {
        toast({ variant: 'destructive', description: t.examEssayTooManyImages })
        return false
      }
      setEssayUploadingId(questionId)
      try {
        const toSend = await compressEssayImageForUpload(file)
        if (!ALLOWED_ESSAY_IMAGE_MIME.has(toSend.type)) {
          toast({ variant: 'destructive', description: t.examEssayUploadFailed })
          return false
        }
        const fd = new FormData()
        fd.append('layoutToken', layoutToken)
        fd.append('file', toSend)
        const res = await fetch(`/api/exam-session/${encodeURIComponent(code)}/essay-image`, {
          method: 'POST',
          body: fd,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.url) {
          toast({ variant: 'destructive', description: data?.error ?? t.examEssayUploadFailed })
          return false
        }
        const url = String(data.url)
        setEssayImageUrls((prev) => {
          const prevCur = prev[questionId] ?? []
          if (prevCur.length >= EXAM_ESSAY_MAX_IMAGES) return prev
          if (prevCur.includes(url)) return prev
          const merged = [...prevCur, url].slice(0, EXAM_ESSAY_MAX_IMAGES)
          const next = { ...prev, [questionId]: merged }
          essayImageUrlsRef.current = next
          return next
        })
        return true
      } finally {
        setEssayUploadingId(null)
      }
    },
    [code, layoutToken, t, toast]
  )

  const handleEssayFilesSelected = useCallback(
    async (questionId: string, fileList: FileList | null) => {
      if (!fileList?.length) return
      const files = Array.from(fileList).filter((f) => ALLOWED_ESSAY_IMAGE_MIME.has(f.type))
      if (files.length === 0) {
        toast({ variant: 'destructive', description: t.examEssayUploadFailed })
        return
      }
      for (const f of files) {
        const ok = await uploadEssayImage(questionId, f)
        if (!ok) break
      }
    },
    [uploadEssayImage, t, toast]
  )

  const handleSubmit = useCallback(async () => {
    if (!exam || submitting) return
    if (!layoutToken?.trim()) {
      setError(t.examLayoutTokenMissingSubmit)
      return
    }
    const essaySubmission: Record<string, { text: string; imageUrls: string[] }> = {}
    for (const q of exam.questions) {
      const isEssay = q.type === 'essay' || !q.options || q.options.length < 2
      if (!isEssay) continue
      const text =
        typeof answers[q.id] === 'string' ? String(answers[q.id] ?? '').trim() : ''
      essaySubmission[q.id] = {
        text,
        imageUrls: essayImageUrls[q.id] ?? [],
      }
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/exam-session/${encodeURIComponent(code)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: normalizeName(studentName),
          studentDob,
          layoutToken,
          answers,
          essaySubmission,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : t.examSubmitFailed)
        return
      }
      setPriorSubmissionResult(false)
      const sc = typeof data.score === 'number' ? data.score : Number(data.score ?? 0)
      const mx = typeof data.maxScore === 'number' ? data.maxScore : Number(data.maxScore ?? 0)
      const scN = Number.isFinite(sc) ? sc : 0
      const mxN = Number.isFinite(mx) ? mx : 0
      setResult({
        score: scN,
        maxScore: mxN,
        grade10: resolveGrade10FromApi(scN, mxN, data.grade10),
        scoreOn100: resolveScoreOn100FromApi(scN, mxN, data.scoreOn100),
        comment: data.comment ?? '',
        shareHint: data.shareHint ?? '',
        scoringBreakdown: parseScoringBreakdown(data.scoringBreakdown),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }, [exam, code, studentName, studentDob, answers, essayImageUrls, submitting, layoutToken, t])

  const handleStartExam = useCallback(() => {
    const normalized = normalizeName(studentName)
    if (normalized.length < 2 || !isValidStudentDobIso(studentDob)) return
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          STUDENT_PROFILE_STORAGE_KEY,
          JSON.stringify({ name: normalized, dob: studentDob })
        )
      } catch {
        // ignore storage errors
      }
    }
    setStudentName(normalized)
    setUseSavedProfile(true)
    setEditingProfile(false)
    setExamStarted(true)
    setStartedAt(Date.now())
    setFiveMinuteWarning(false)
    fiveMinuteWarnedRef.current = false
    autoSubmittedRef.current = false
    bellPlayedRef.current = false
  }, [studentName, studentDob])

  const canStartExam = normalizeName(studentName).length >= 2 && isValidStudentDobIso(studentDob)
  const showCompactClassStart = identityFromClassRoster && !editingProfile

  const elapsedMs = startedAt ? now - startedAt : 0
  const totalMs = exam ? exam.durationMinutes * 60 * 1000 : 0
  const remainingMs = Math.max(0, totalMs - elapsedMs)
  const remainingMin = Math.floor(remainingMs / 60000)
  const remainingSec = Math.floor((remainingMs % 60000) / 1000)
  const isLowTime = remainingMs > 0 && remainingMs <= 5 * 60 * 1000
  const isTimeUp = remainingMs === 0
  const shouldAutoSubmit = isTimeUp

  useEffect(() => {
    if (isTimeUp && !bellPlayedRef.current) {
      bellPlayedRef.current = true
      playBell()
    }
  }, [isTimeUp])

  useEffect(() => {
    if (!examStarted || result || isTimeUp) return
    if (remainingMs <= 5 * 60 * 1000 && !fiveMinuteWarnedRef.current) {
      fiveMinuteWarnedRef.current = true
      setFiveMinuteWarning(true)
      playBell()
    }
  }, [remainingMs, examStarted, result, isTimeUp])

  useEffect(() => {
    if (shouldAutoSubmit && exam && !submitting && !result && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      void handleSubmit()
    }
  }, [shouldAutoSubmit, exam, submitting, result, handleSubmit])

  /** Sau khi nộp bài, đưa viewport tới vùng kết quả (trang đề dài có thể đang scroll xuống dưới). */
  useEffect(() => {
    if (!result) return
    const id = window.requestAnimationFrame(() => {
      submitResultRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [result])

  if (loading) {
    return (
      <div className="w-full min-h-[min(70dvh,28rem)] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-10 w-10 animate-spin" />
          <p>{t.lamBaiLoadingNeutral}</p>
        </div>
      </div>
    )
  }

  if (enrollmentGate && !exam) {
    const birthDate = buildDob(dobDay, dobMonth, dobYear)
    const canEnroll =
      normalizeName(studentName).length >= 2 && isValidStudentDobIso(birthDate)
    const gateHw = enrollmentGate.practiceHomework
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Toaster />
        <Card className="max-w-md w-full border-primary/30 shadow-md">
          <CardHeader>
            <CardTitle>{gateHw ? t.homeworkEnrollGateTitle : t.examEnrollGateTitle}</CardTitle>
            <CardDescription className="space-y-3 pt-1 text-sm leading-relaxed">
              <p>{gateHw ? t.homeworkEnrollGateDescription : t.examEnrollGateDescription}</p>
              <p className="font-semibold text-foreground">{enrollmentGate.title}</p>
              <div className="flex flex-wrap gap-2">
                {enrollmentGate.className ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {enrollmentGate.className}
                  </span>
                ) : null}
                {enrollmentGate.schoolName ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {t.schoolLabel}: {enrollmentGate.schoolName}
                  </span>
                ) : null}
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="exam-gate-name" className="text-sm font-medium">
                {t.joinStudentDisplayName} <span className="text-destructive">*</span>
              </label>
              <Input
                id="exam-gate-name"
                placeholder={t.joinStudentDisplayName}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                autoComplete="name"
                disabled={enrollSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.joinStudentBirthDate} <span className="text-destructive">*</span>
              </label>
              <StudentBirthDateSelects
                idPrefix="exam-gate-dob"
                dobDay={dobDay}
                dobMonth={dobMonth}
                dobYear={dobYear}
                onDayChange={setDobDay}
                onMonthChange={setDobMonth}
                onYearChange={setDobYear}
                disabled={enrollSubmitting}
                labels={{
                  day: t.joinDobDayPlaceholder,
                  month: t.joinDobMonthPlaceholder,
                  year: t.joinDobYearPlaceholder,
                }}
              />
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={!canEnroll || enrollSubmitting}
              onClick={async () => {
                const name = normalizeName(studentName)
                if (name.length < 2) {
                  toast({ variant: 'destructive', description: t.joinNameTooShort })
                  return
                }
                const bd = buildDob(dobDay, dobMonth, dobYear)
                if (!bd || !isValidStudentDobIso(bd)) {
                  toast({ variant: 'destructive', description: t.joinBirthRequired })
                  return
                }
                setEnrollSubmitting(true)
                const res = await joinClassForActiveExam({
                  examCode: code,
                  studentDisplayName: name,
                  birthDate: bd,
                })
                setEnrollSubmitting(false)
                if ('error' in res) {
                  toast({ variant: 'destructive', description: res.error })
                  return
                }
                setStudentName(name)
                try {
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem(
                      STUDENT_PROFILE_STORAGE_KEY,
                      JSON.stringify({ name, dob: bd })
                    )
                  }
                } catch {
                  // ignore
                }
                setUseSavedProfile(true)
                setEditingProfile(false)
                autoStartExamAfterEnrollRef.current = true
                setReloadNonce((n) => n + 1)
              }}
            >
              {enrollSubmitting
                ? t.examEnrollSubmitting
                : gateHw
                  ? t.homeworkEnrollSubmitButton
                  : t.examEnrollSubmitButton}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full min-h-[min(70dvh,28rem)] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">{t.examErrorTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (result) {
    const bd = result.scoringBreakdown
    const pct =
      bd && bd.quizTotal > 0
        ? Math.round((bd.quizCorrect / bd.quizTotal) * 100)
        : result.maxScore > 0
          ? Math.round((result.score / result.maxScore) * 100)
          : 0
    const shareTitle = exam?.title ?? t.examSubmittedTitle
    const score100Str = formatExamScaleNumber(result.scoreOn100)
    const gradeStr = formatExamScaleNumber(result.grade10)
    const shareText = result.practiceHomework
      ? fillExamTemplate(t.homeworkShareLine, { title: shareTitle })
      : fillExamTemplate(t.examShareResultScaleLine, {
          title: shareTitle,
          score100: score100Str,
          grade: gradeStr,
        })
    const handleShare = () => {
      if (navigator.share) {
        navigator.share({
          title: shareTitle,
          text: shareText,
          url: window.location.href,
        }).then(() => { setShared(true); setTimeout(() => setShared(false), 2000) }).catch(() => {})
      } else {
        navigator.clipboard.writeText(shareText).then(() => {
          setShared(true)
          setTimeout(() => setShared(false), 2000)
        })
      }
    }
    if (result.practiceHomework) {
      return (
        <div
          ref={submitResultRef}
          className="w-full min-h-[min(75dvh,36rem)] flex items-center justify-center p-4"
          id="exam-submit-result"
          role="status"
          aria-live="polite"
        >
          <Card className="max-w-md w-full border-sky-200 dark:border-sky-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
                <CheckCircle className="h-6 w-6" />
                {t.homeworkSubmittedTitle}
              </CardTitle>
              {priorSubmissionResult ? (
                <CardDescription className="text-sm leading-relaxed pt-1">
                  {t.homeworkSubmittedSavedEarlier}
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{t.homeworkSubmittedBody}</p>
              {bd && bd.quizTotal > 0 ? (
                <p className="text-sm">
                  {fillExamTemplate(t.homeworkMcCorrectOnlyLine, {
                    correct: String(bd.quizCorrect),
                    total: String(bd.quizTotal),
                  })}
                </p>
              ) : null}
              {bd && bd.essayPointsMax > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {fillExamTemplate(t.examEssayPendingBreakdownLine, {
                    essayMax: formatExamScaleNumber(bd.essayPointsMax),
                  })}
                </p>
              ) : null}
              {bd?.essayImageUrlsExpireAt ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {fillExamTemplate(t.examEssayImageRetentionResult, {
                    expiresAt: formatExamEssayImageExpireAtForUi(bd.essayImageUrlsExpireAt),
                    days: String(EXAM_ESSAY_IMAGE_RETENTION_DAYS),
                  })}
                </p>
              ) : null}
              {result.comment ? (
                <p className="text-sm leading-relaxed">{result.comment}</p>
              ) : null}
              <Button variant="outline" size="sm" onClick={handleShare} className="w-full" disabled={shared}>
                <Share2 className="h-4 w-4 mr-2" />
                {shared ? t.examShareDone : result.shareHint || t.examShareDone}
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
    return (
      <div
        ref={submitResultRef}
        className="w-full min-h-[min(75dvh,36rem)] flex items-center justify-center p-4"
        id="exam-submit-result"
        role="status"
        aria-live="polite"
      >
        <Card className="max-w-md w-full border-emerald-200 dark:border-emerald-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-6 w-6" />
              {t.examSubmittedTitle}
            </CardTitle>
            {priorSubmissionResult ? (
              <CardDescription className="text-sm leading-relaxed pt-1">
                {t.examSubmittedSavedEarlier}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-3xl font-bold tabular-nums">
                {fillExamTemplate(t.examResultScale100Line, {
                  score100: formatExamScaleNumber(result.scoreOn100),
                })}
              </p>
              <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {fillExamTemplate(t.examResultSummaryGrade10Line, {
                  grade: formatExamScaleNumber(result.grade10),
                })}
              </p>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {result.scoringBreakdown ? (
                <>
                  {result.scoringBreakdown.quizTotal > 0 ? (
                    <p>
                      {fillExamTemplate(t.examMcBreakdownLine, {
                        correct: result.scoringBreakdown.quizCorrect,
                        total: result.scoringBreakdown.quizTotal,
                        quizPoints: formatExamScaleNumber(result.scoringBreakdown.quizPoints),
                        quizMax: formatExamScaleNumber(result.scoringBreakdown.quizPointsMax),
                      })}
                    </p>
                  ) : null}
                  {result.scoringBreakdown.essayPointsMax > 0 ? (
                    <p>
                      {fillExamTemplate(t.examEssayPendingBreakdownLine, {
                        essayMax: formatExamScaleNumber(result.scoringBreakdown.essayPointsMax),
                      })}
                    </p>
                  ) : null}
                  {result.scoringBreakdown.essayImageUrlsExpireAt ? (
                    <p className="text-amber-800 dark:text-amber-200">
                      {fillExamTemplate(t.examEssayImageRetentionResult, {
                        expiresAt: formatExamEssayImageExpireAtForUi(
                          result.scoringBreakdown.essayImageUrlsExpireAt
                        ),
                        days: String(EXAM_ESSAY_IMAGE_RETENTION_DAYS),
                      })}
                    </p>
                  ) : null}
                  <p>
                    {fillExamTemplate(
                      result.scoringBreakdown.essayPointsMax > 0
                        ? t.examTotalPendingBreakdownLine
                        : t.examTotalScoreByExamLine,
                      {
                        score: formatExamScaleNumber(Number(result.score)),
                        max: formatExamScaleNumber(Number(result.maxScore)),
                      }
                    )}
                  </p>
                </>
              ) : (
                <p>
                  {fillExamTemplate(t.examCorrectRatioLine, {
                    score: formatExamScaleNumber(Number(result.score)),
                    max: formatExamScaleNumber(Number(result.maxScore)),
                    pct,
                  })}
                </p>
              )}
            </div>
            <p className="text-sm leading-relaxed">{result.comment}</p>
            {result.shareHint && (
              <Button variant="outline" size="sm" onClick={handleShare} className="w-full" disabled={shared}>
                <Share2 className="h-4 w-4 mr-2" />
                {shared ? t.examShareDone : result.shareHint}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!exam) return null

  if (!examStarted) {
    const isHw = exam.practiceHomework
    return (
      <div className="w-full min-h-[min(70dvh,28rem)] flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{exam.title}</CardTitle>
            <CardDescription>
              {showCompactClassStart
                ? isHw
                  ? t.homeworkIdentityFromClassHint
                  : t.examIdentityFromClassHint
                : isHw
                  ? t.homeworkManualIdentityIntro
                  : t.examManualIdentityIntro}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showCompactClassStart ? null : useSavedProfile && !editingProfile ? (
              <div className="space-y-2 rounded border bg-muted/30 p-3">
                <p className="text-sm">
                  {t.memberRoleStudent}: <strong>{studentName}</strong>
                </p>
                <p className="text-sm">
                  {t.joinStudentBirthDate}: <strong>{formatDobDisplay(studentDob)}</strong>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIdentityFromClassRoster(false)
                    setEditingProfile(true)
                  }}
                >
                  {t.examChangeIdentityManual}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.joinStudentDisplayName} <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder={t.joinStudentDisplayName}
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.joinStudentBirthDate} <span className="text-destructive">*</span>
                  </label>
                  <StudentBirthDateSelects
                    idPrefix="exam-dob"
                    dobDay={dobDay}
                    dobMonth={dobMonth}
                    dobYear={dobYear}
                    onDayChange={setDobDay}
                    onMonthChange={setDobMonth}
                    onYearChange={setDobYear}
                    labels={{
                      day: t.joinDobDayPlaceholder,
                      month: t.joinDobMonthPlaceholder,
                      year: t.joinDobYearPlaceholder,
                    }}
                  />
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground">{t.examOneAttemptNote}</p>
            <Button onClick={handleStartExam} disabled={!canStartExam} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              {isHw ? t.examStartHomeworkButton : t.examStartTestButton}
            </Button>
            {showCompactClassStart ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setIdentityFromClassRoster(false)
                  setEditingProfile(true)
                }}
              >
                {t.examChangeIdentityManual}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  const canSelect = !isTimeUp
  const isHw = exam.practiceHomework

  return (
    <div className="w-full min-h-[calc(100dvh-5.5rem)] bg-muted/30 pb-6">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <span className="font-medium truncate">{exam.title}</span>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-xl shrink-0 ${
              isTimeUp ? 'bg-destructive/20 text-destructive' : isLowTime ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse' : 'bg-primary/10 text-primary'
            }`}
          >
            <Clock className="h-5 w-5" />
            {isTimeUp
              ? isHw
                ? t.lamBaiTimerStickySubmittingHomework
                : t.lamBaiTimerStickySubmittingExam
              : `${String(remainingMin).padStart(2, '0')}:${String(remainingSec).padStart(2, '0')}`}
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
        {fiveMinuteWarning && !isTimeUp && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-3 text-center">
              <p className="font-medium text-amber-700 dark:text-amber-400">{t.lamBaiFiveMinWarning}</p>
            </CardContent>
          </Card>
        )}
        {isTimeUp && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-3 text-center">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                {isHw ? t.lamBaiTimerTimeUpAutoSubmittingHomework : t.lamBaiTimerTimeUpAutoSubmittingExam}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {exam.questions.map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-base ${/[┌┐└┘│├┤┬┴┼─]/.test(latexToReadable(q.question_text)) ? 'whitespace-pre-wrap font-sans' : ''}`}>
                  {fillExamTemplate(t.lamBaiQuestionLabel, { index: String(q.index) })}{' '}
                  {latexToReadable(q.question_text)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {q.type === 'quiz' ? (
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt, i) => (
                      <label
                        key={i}
                        htmlFor={`${q.id}-${i}`}
                        className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                          !canSelect ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'
                        } ${answers[q.id] === i ? 'bg-primary/10 border border-primary/30' : ''}`}
                      >
                        <input
                          type="radio"
                          id={`${q.id}-${i}`}
                          name={q.id}
                          checked={answers[q.id] === i}
                          onChange={() => canSelect && handleAnswer(q.id, i)}
                          disabled={!canSelect}
                          className="h-4 w-4"
                        />
                        <span className={`flex-1 ${/[┌┐└┘│├┤┬┴┼─]/.test(latexToReadable(opt)) ? 'whitespace-pre-wrap block' : ''}`}>
                          {String.fromCharCode(65 + i)}. {latexToReadable(opt)}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
                      <p>{t.examEssayPhotoHint}</p>
                      <p>{fillExamTemplate(t.examEssayImageRetentionHint, { days: String(EXAM_ESSAY_IMAGE_RETENTION_DAYS) })}</p>
                    </div>
                    <Textarea
                      value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                      onChange={(e) => canSelect && handleAnswer(q.id, e.target.value)}
                      disabled={!canSelect}
                      placeholder={t.examEssayAnswerPlaceholder}
                      className="min-h-24"
                    />
                    <div className="flex flex-wrap items-end gap-2">
                      {(essayImageUrls[q.id] ?? []).map((url) => (
                        <div
                          key={url}
                          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-muted/30"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                          {canSelect ? (
                            <button
                              type="button"
                              className="absolute right-0.5 top-0.5 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium shadow"
                              onClick={() =>
                                setEssayImageUrls((prev) => {
                                  const nextList = (prev[q.id] ?? []).filter((u) => u !== url)
                                  const next = { ...prev, [q.id]: nextList }
                                  essayImageUrlsRef.current = next
                                  return next
                                })
                              }
                            >
                              {t.examEssayRemoveImage}
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {canSelect ? (
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="file"
                            id={`essay-gallery-${q.id}`}
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(e) => {
                              void handleEssayFilesSelected(q.id, e.target.files)
                              e.target.value = ''
                            }}
                          />
                          <label
                            htmlFor={`essay-gallery-${q.id}`}
                            className={cn(
                              buttonVariants({ variant: 'outline', size: 'sm' }),
                              'h-9 cursor-pointer inline-flex items-center justify-center',
                              (essayUploadingId === q.id ||
                                (essayImageUrls[q.id]?.length ?? 0) >= EXAM_ESSAY_MAX_IMAGES) &&
                                'pointer-events-none opacity-50'
                            )}
                          >
                            {essayUploadingId === q.id ? t.examEssayUploading : t.examEssayUploadPick}
                          </label>
                          {/* Chỉ mobile / màn nhỏ: máy ảnh; desktop chỉ "Chọn ảnh" */}
                          <div className="inline-flex md:hidden">
                            <input
                              type="file"
                              id={`essay-camera-${q.id}`}
                              accept="image/jpeg,image/png,image/webp"
                              capture="environment"
                              className="sr-only"
                              onChange={(e) => {
                                void handleEssayFilesSelected(q.id, e.target.files)
                                e.target.value = ''
                              }}
                            />
                            <label
                              htmlFor={`essay-camera-${q.id}`}
                              className={cn(
                                buttonVariants({ variant: 'outline', size: 'sm' }),
                                'h-9 cursor-pointer inline-flex items-center justify-center gap-1.5',
                                (essayUploadingId === q.id ||
                                  (essayImageUrls[q.id]?.length ?? 0) >= EXAM_ESSAY_MAX_IMAGES) &&
                                  'pointer-events-none opacity-50'
                              )}
                            >
                              {essayUploadingId === q.id ? (
                                t.examEssayUploading
                              ) : (
                                <>
                                  <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  {t.examEssayUploadCamera}
                                </>
                              )}
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {isHw ? t.homeworkSubmitSending : t.examSubmitSending}
                </>
              ) : isHw ? (
                t.homeworkSubmitButton
              ) : (
                t.examSubmitButton
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
