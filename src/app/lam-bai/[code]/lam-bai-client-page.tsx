'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RefreshCw, CheckCircle, Clock, Share2, Play } from 'lucide-react'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'

type Question = { id: string; index: number; type?: 'quiz' | 'essay'; question_text: string; options: string[] }
const STUDENT_PROFILE_STORAGE_KEY = 'exam-session:student-profile:v1'

function normalizeName(input: string): string {
  return String(input || '').replace(/\s+/g, ' ').trim()
}

function isValidDob(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false
  const d = new Date(`${input}T00:00:00`)
  if (Number.isNaN(d.getTime())) return false
  return d.getUTCFullYear() >= 1900 && d <= new Date()
}

function formatDob(input: string): string {
  if (!isValidDob(input)) return input
  const [y, m, d] = input.split('-')
  return `${d}/${m}/${y}`
}

function buildDob(day: string, month: string, year: string): string {
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return ''
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function splitDob(input: string): { day: string; month: string; year: string } {
  if (!isValidDob(input)) return { day: '', month: '', year: '' }
  const [year, month, day] = input.split('-')
  return {
    day: String(Number(day)),
    month: String(Number(month)),
    year,
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
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

export default function LamBaiClientPage({ code }: { code: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [shared, setShared] = useState(false)
  const [now, setNow] = useState(Date.now())
  const autoSubmittedRef = useRef(false)
  const bellPlayedRef = useRef(false)
  const fiveMinuteWarnedRef = useRef(false)
  const [fiveMinuteWarning, setFiveMinuteWarning] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { name?: unknown; dob?: unknown }
      const savedName = normalizeName(String(parsed?.name ?? ''))
      const savedDob = String(parsed?.dob ?? '')
      if (savedName && isValidDob(savedDob)) {
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
    if (!dobDay || !dobMonth || !dobYear) return
    const max = daysInMonth(Number(dobYear), Number(dobMonth))
    if (Number(dobDay) > max) setDobDay(String(max))
  }, [dobDay, dobMonth, dobYear])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/exam-session/${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
          return
        }
        setLayoutToken(typeof data.layoutToken === 'string' ? data.layoutToken : null)
        setExam({
          title: data.title || 'Bài thi',
          durationMinutes: data.durationMinutes || 15,
          questions: data.questions || [],
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [code])

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
    const shareText = `${exam?.title ?? 'Bài thi'}: Điểm ${result.grade10}/10 (${result.score}/${result.maxScore} đúng - ${pct}%)`
    const handleShare = () => {
      if (navigator.share) {
        navigator.share({
          title: exam?.title ?? 'Kết quả bài thi',
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-emerald-200 dark:border-emerald-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-6 w-6" />
              Đã nộp bài
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3xl font-bold">
              Điểm {result.grade10}/10
            </p>
            <p className="text-sm text-muted-foreground">
              {result.score}/{result.maxScore} câu đúng ({pct}%)
            </p>
            <p className="text-sm leading-relaxed">{result.comment}</p>
            {result.shareHint && (
              <Button variant="outline" size="sm" onClick={handleShare} className="w-full" disabled={shared}>
                <Share2 className="h-4 w-4 mr-2" />
                {shared ? 'Đã chia sẻ!' : result.shareHint}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!exam) return null

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 100 }, (_, i) => String(currentYear - i))
  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const selectedYear = Number(dobYear || String(currentYear))
  const selectedMonth = Number(dobMonth || '1')
  const maxDay = daysInMonth(selectedYear, selectedMonth)
  const dayOptions = Array.from({ length: maxDay }, (_, i) => String(i + 1))
  const canStartExam = normalizeName(studentName).length >= 2 && isValidDob(studentDob)

  if (!examStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{exam.title}</CardTitle>
            <CardDescription>
              Nhập thông tin và bấm Bắt đầu để làm bài. Đồng hồ chỉ chạy sau khi bấm Bắt đầu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {useSavedProfile && !editingProfile ? (
              <div className="space-y-2 rounded border bg-muted/30 p-3">
                <p className="text-sm">
                  Học sinh: <strong>{studentName}</strong>
                </p>
                <p className="text-sm">
                  Ngày sinh: <strong>{formatDob(studentDob)}</strong>
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
                  Nhập thông tin khác
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
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={dobDay}
                      onChange={(e) => setDobDay(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">Ngày</option>
                      {dayOptions.map((d) => (
                        <option key={`d-${d}`} value={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      value={dobMonth}
                      onChange={(e) => setDobMonth(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">Tháng</option>
                      {monthOptions.map((m) => (
                        <option key={`m-${m}`} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={dobYear}
                      onChange={(e) => setDobYear(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">Năm</option>
                      {yearOptions.map((y) => (
                        <option key={`y-${y}`} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground">Mỗi tài khoản chỉ được làm bài một lần.</p>
            <Button
              onClick={() => {
                if (!canStartExam) return
                const normalized = normalizeName(studentName)
                if (typeof window !== 'undefined') {
                  try {
                    window.localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify({ name: normalized, dob: studentDob }))
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
              }}
              disabled={!canStartExam}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              Bắt đầu bài kiểm tra
            </Button>
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
