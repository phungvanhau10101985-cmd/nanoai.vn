'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileQuestion, RefreshCw, CheckCircle } from 'lucide-react'

type Question = { id: string; index: number; question_text: string; options: string[] }

export default function LamBaiClientPage({ code }: { code: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exam, setExam] = useState<{ title: string; durationMinutes: number; questions: Question[] } | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [studentName, setStudentName] = useState('')
  const [studentCode, setStudentCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; maxScore: number } | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)

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
        setExam({
          title: data.title || 'Bài thi',
          durationMinutes: data.durationMinutes || 15,
          questions: data.questions || [],
        })
        setStartedAt(Date.now())
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [code])

  const handleAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
  }

  const handleSubmit = async () => {
    if (!exam || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/exam-session/${encodeURIComponent(code)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim() || undefined,
          studentCode: studentCode.trim() || undefined,
          answers,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Nộp bài thất bại.')
        return
      }
      setResult({ score: data.score ?? 0, maxScore: data.maxScore ?? 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 60000) : 0
  const remaining = exam ? Math.max(0, exam.durationMinutes - elapsed) : 0

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
            <p className="text-2xl font-bold">
              {result.score}/{result.maxScore} ({pct}%)
            </p>
            <p className="text-sm text-muted-foreground">Cảm ơn bạn đã hoàn thành bài thi.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!exam) return null

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <FileQuestion className="h-5 w-5" />
                {exam.title}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                Thời gian: {remaining} phút
              </span>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Thông tin thí sinh (tùy chọn)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Họ tên"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Mã số / SBD"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              className="flex-1"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {exam.questions.map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Câu {q.index}. {q.question_text}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {q.options.map((opt, i) => (
                    <label
                      key={i}
                      htmlFor={`${q.id}-${i}`}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        answers[q.id] === i ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        id={`${q.id}-${i}`}
                        name={q.id}
                        checked={answers[q.id] === i}
                        onChange={() => handleAnswer(q.id, i)}
                        className="h-4 w-4"
                      />
                      <span className="flex-1">
                        {String.fromCharCode(65 + i)}. {opt}
                      </span>
                    </label>
                  ))}
                </div>
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
                'Nộp bài'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
