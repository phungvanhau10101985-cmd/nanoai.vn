'use client'

import { useState, useEffect, useCallback } from 'react'

const DEVICE_ID_KEY = 'quiz_device_id'

function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = `d${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export default function QuizJoinClient({ code }: { code: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [status, setStatus] = useState<'active' | 'revealed'>('active')
  const [correctIndex, setCorrectIndex] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/slide-quiz/${code}`)
    if (!res.ok) {
      setError('Không tìm thấy phiên.')
      setLoading(false)
      return
    }
    const data = await res.json()
    setQuestion(data.question)
    setOptions(data.options || [])
    setStatus(data.status)
    setCorrectIndex(data.correctIndex ?? null)
    setLoading(false)
  }, [code])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  useEffect(() => {
    if (status === 'revealed') return
    const interval = setInterval(fetchSession, 2000)
    return () => clearInterval(interval)
  }, [status, fetchSession])

  const handleSubmit = async (index: number) => {
    if (submitted !== null) return
    setSubmitting(true)
    const res = await fetch(`/api/slide-quiz/${code}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerIndex: index, deviceId: getDeviceId() }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (data.success) {
      setSubmitted(index)
    } else {
      setError(data.error || 'Gửi thất bại.')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    )
  }

  if (error || !question) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error || 'Không có câu hỏi.'}</p>
      </div>
    )
  }

  const revealed = status === 'revealed'
  const showCorrect = revealed && correctIndex !== null

  return (
    <div className="space-y-6">
      <header className="text-center">
        <p className="text-sm text-muted-foreground">Mã: {code}</p>
        <h1 className="text-xl font-bold text-foreground mt-1">Trắc nghiệm tại chỗ</h1>
      </header>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-6 shadow-sm">
        <p className="font-medium text-lg mb-4">{question}</p>
        <div className="space-y-2">
          {options.map((opt, i) => {
            const isSelected = submitted === i
            const isCorrect = showCorrect && i === correctIndex
            const isWrong = showCorrect && isSelected && i !== correctIndex
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSubmit(i)}
                disabled={submitted !== null || submitting}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                  isWrong ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                  isSelected ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' :
                  'border-slate-200 dark:border-slate-700 hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-900/10'
                } ${submitted !== null ? 'cursor-default' : ''}`}
              >
                <span className="font-medium">{String.fromCharCode(65 + i)}.</span> {opt}
              </button>
            )
          })}
        </div>

        {submitted !== null && !revealed && (
          <p className="mt-0.5 text-sm text-muted-foreground">Đã gửi. Chờ cô giáo hiện đáp án.</p>
        )}
        {showCorrect && (
          <p className="mt-0.5 text-sm font-medium text-green-600 dark:text-green-400">
            Đáp án đúng: {String.fromCharCode(65 + (correctIndex ?? 0))}
          </p>
        )}
      </div>
    </div>
  )
}
