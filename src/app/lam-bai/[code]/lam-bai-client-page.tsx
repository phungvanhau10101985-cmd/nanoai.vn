'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RefreshCw, CheckCircle, Clock, Share2, Play } from 'lucide-react'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { StudentBirthDateSelects } from '@/components/student-birth-date-selects'
import { buildDob, formatDobDisplay, isValidStudentDobIso, splitDob } from '@/lib/student-dob'
import { joinClassForActiveExam } from '@/app/lop/actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Question = { id: string; index: number; type?: 'quiz' | 'essay'; question_text: string; options: string[] }
const STUDENT_PROFILE_STORAGE_KEY = 'exam-session:student-profile:v1'

function fillExamTemplate(template: string, vars: Record<string, string | number>) {
  let out = template
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(val))
  }
  return out
}

function normalizeName(input: string): string {
  return String(input || '').replace(/\s+/g, ' ').trim()
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
  } | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [enrollSubmitting, setEnrollSubmitting] = useState(false)
  const { toast } = useToast()
  const [exam, setExam] = useState<{ title: string; durationMinutes: number; questions: Question[] } | null>(null)
  /** JWT map đáp án hiển thị → chỉ số gốc — bắt buộc khi nộp bài */
  const [layoutToken, setLayoutToken] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [studentName, setStudentName] = useState('')
  const [studentDob, setStudentDob] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [useSavedProfile, setUseSavedProfile] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [examStarted, setExamStarted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; maxScore: number; grade10: number; comment: string; shareHint: string } | null>(null)
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
        if (!ok) {
          autoStartExamAfterEnrollRef.current = false
          setIdentityFromClassRoster(false)
          setEnrollmentGate(null)
          setExam(null)
          setLayoutToken(null)
          setError(typeof data?.error === 'string' ? data.error : 'Không tải được đề thi.')
          return
        }
        if (data.alreadySubmitted === true) {
          autoStartExamAfterEnrollRef.current = false
          setIdentityFromClassRoster(false)
          setEnrollmentGate(null)
          setLayoutToken(null)
          const title = typeof data.title === 'string' ? data.title : 'Bài thi'
          const durationMinutes =
            typeof data.durationMinutes === 'number' && Number.isFinite(data.durationMinutes)
              ? data.durationMinutes
              : 15
          setExam({ title, durationMinutes, questions: [] })
          setResult({
            score: typeof data.score === 'number' ? data.score : 0,
            maxScore: typeof data.maxScore === 'number' ? data.maxScore : 0,
            grade10: typeof data.grade10 === 'number' ? data.grade10 : 0,
            comment: typeof data.comment === 'string' ? data.comment : '',
            shareHint: typeof data.shareHint === 'string' ? data.shareHint : '',
          })
          setPriorSubmissionResult(true)
          setExamStarted(false)
          return
        }
        if (data.needsEnrollment) {
          autoStartExamAfterEnrollRef.current = false
          setIdentityFromClassRoster(false)
          setEnrollmentGate({
            title: typeof data.title === 'string' ? data.title : 'Bài thi',
            durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : 15,
            className: typeof data.className === 'string' ? data.className : null,
            schoolName: typeof data.schoolName === 'string' ? data.schoolName : null,
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
        setEnrollmentGate(null)
        setLayoutToken(layoutTok)
        setPriorSubmissionResult(false)
        setExam({
          title: data.title || 'Bài thi',
          durationMinutes: data.durationMinutes || 15,
          questions,
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

  const handleAnswer = (questionId: string, answer: number | string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const handleSubmit = useCallback(async () => {
    if (!exam || submitting) return
    if (!layoutToken?.trim()) {
      setError('Thiếu phiên đề thi. Vui lòng tải lại trang.')
      return
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
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Nộp bài thất bại.')
        return
      }
      setPriorSubmissionResult(false)
      setResult({
        score: data.score ?? 0,
        maxScore: data.maxScore ?? 0,
        grade10: data.grade10 ?? 0,
        comment: data.comment ?? '',
        shareHint: data.shareHint ?? '',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }, [exam, code, studentName, studentDob, answers, submitting, layoutToken])

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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-10 w-10 animate-spin" />
          <p>Đang tải bài thi...</p>
        </div>
      </div>
    )
  }

  if (enrollmentGate && !exam) {
    const birthDate = buildDob(dobDay, dobMonth, dobYear)
    const canEnroll =
      normalizeName(studentName).length >= 2 && isValidStudentDobIso(birthDate)
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Toaster />
        <Card className="max-w-md w-full border-primary/30 shadow-md">
          <CardHeader>
            <CardTitle>{t.examEnrollGateTitle}</CardTitle>
            <CardDescription className="space-y-3 pt-1 text-sm leading-relaxed">
              <p>{t.examEnrollGateDescription}</p>
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
              {enrollSubmitting ? t.examEnrollSubmitting : t.examEnrollSubmitButton}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Lỗi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (result) {
    const pct = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0
    const shareTitle = exam?.title ?? t.examSubmittedTitle
    const shareText = fillExamTemplate(t.examShareResultLine, {
      title: shareTitle,
      grade: result.grade10,
      score: result.score,
      max: result.maxScore,
      pct,
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
    return (
      <div
        ref={submitResultRef}
        className="min-h-screen flex items-center justify-center p-4"
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
            <p className="text-3xl font-bold">
              {fillExamTemplate(t.examScoreOutOf10, { grade: result.grade10 })}
            </p>
            <p className="text-sm text-muted-foreground">
              {fillExamTemplate(t.examCorrectRatioLine, {
                score: result.score,
                max: result.maxScore,
                pct,
              })}
            </p>
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
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{exam.title}</CardTitle>
            <CardDescription>
              {showCompactClassStart ? t.examIdentityFromClassHint : t.examManualIdentityIntro}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showCompactClassStart ? null : useSavedProfile && !editingProfile ? (
              <div className="space-y-2 rounded border bg-muted/30 p-3">
                <p className="text-sm">
                  Học sinh: <strong>{studentName}</strong>
                </p>
                <p className="text-sm">
                  Ngày sinh: <strong>{formatDobDisplay(studentDob)}</strong>
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
                  <label className="text-sm font-medium">Họ tên *</label>
                  <Input
                    placeholder="Nguyễn Văn A"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ngày tháng năm sinh *</label>
                  <StudentBirthDateSelects
                    idPrefix="exam-dob"
                    dobDay={dobDay}
                    dobMonth={dobMonth}
                    dobYear={dobYear}
                    onDayChange={setDobDay}
                    onMonthChange={setDobMonth}
                    onYearChange={setDobYear}
                    labels={{ day: 'Ngày', month: 'Tháng', year: 'Năm' }}
                  />
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground">{t.examOneAttemptNote}</p>
            <Button onClick={handleStartExam} disabled={!canStartExam} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              {t.examStartTestButton}
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

  return (
    <div className="min-h-screen bg-muted/30 pb-6">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <span className="font-medium truncate">{exam.title}</span>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-xl shrink-0 ${
              isTimeUp ? 'bg-destructive/20 text-destructive' : isLowTime ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse' : 'bg-primary/10 text-primary'
            }`}
          >
            <Clock className="h-5 w-5" />
            {isTimeUp ? 'Hết giờ - đang nộp bài...' : `${String(remainingMin).padStart(2, '0')}:${String(remainingSec).padStart(2, '0')}`}
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
        {fiveMinuteWarning && !isTimeUp && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-3 text-center">
              <p className="font-medium text-amber-700 dark:text-amber-400">Còn 5 phút! Em rà soát đáp án trước khi hết giờ.</p>
            </CardContent>
          </Card>
        )}
        {isTimeUp && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-3 text-center">
              <p className="font-medium text-amber-700 dark:text-amber-400">Đã hết giờ! Bài làm đang được tự động nộp.</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {exam.questions.map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-base ${/[┌┐└┘│├┤┬┴┼─]/.test(latexToReadable(q.question_text)) ? 'whitespace-pre-wrap font-sans' : ''}`}>
                  Câu {q.index}. {latexToReadable(q.question_text)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(q.options) && q.options.length > 0 ? (
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
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Câu tự luận - nhập câu trả lời ngắn gọn.</p>
                    <Textarea
                      value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                      onChange={(e) => canSelect && handleAnswer(q.id, e.target.value)}
                      disabled={!canSelect}
                      placeholder="Nhập câu trả lời..."
                      className="min-h-24"
                    />
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
                  Đang nộp...
                </>
              ) : (
                'Gửi bài'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
