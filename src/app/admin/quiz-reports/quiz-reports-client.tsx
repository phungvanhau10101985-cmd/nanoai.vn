'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useStepUpOtp, fetchWithStepUp } from '@/components/auth/step-up-otp-provider'
import { isStepUpRequiredError } from '@/lib/auth/step-up-otp-shared'
import { Toaster } from '@/components/ui/toaster'
import { Check, X, RefreshCw, Flag } from 'lucide-react'
import { parseQuizData } from '@/lib/parse-quiz-data'

type Report = {
  id: string
  curriculum_id: string
  user_id: string
  slide_index: number
  block_index: number
  quiz_marker: string
  slide_content: string
  slide_title: string
  report_count: number
  status: string
  ai_reasoning: string | null
  ai_model_used: string | null
  created_at: string
  updated_at: string
}

export function QuizReportsClient() {
  const router = useRouter()
  const { toast } = useToast()
  const { ensureStepUp } = useStepUpOtp()
  const [items, setItems] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/quiz-reports')
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setItems(data.items)
        else {
          setItems([])
          if (data.error) toast({ title: 'Lỗi', description: data.error, variant: 'destructive' })
        }
      })
      .catch((e) => {
        setItems([])
        toast({ title: 'Lỗi', description: e?.message ?? 'Không tải được.', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleApprove = async (id: string, approved: boolean) => {
    setActioning(id)
    try {
      const res = await fetchWithStepUp(
        `/api/admin/quiz-reports/${id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved }),
        },
        ensureStepUp
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: 'Lỗi', description: data?.error ?? String(res.status), variant: 'destructive' })
      } else {
        toast({
          title: approved ? 'Đã duyệt giữ nguyên' : 'Đã thay câu mới',
          description: data.message ?? '',
        })
        fetchData()
      }
    } finally {
      setActioning(null)
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('vi-VN')
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Flag className="h-6 w-6 text-rose-500" />
          Báo cáo câu hỏi sai
        </h1>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Chưa có báo cáo nào chờ duyệt.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((r) => {
            const m = r.quiz_marker.match(/\[quiz:\s*(.+[\x1f|][0-3])\]/i)
            const quizData = m ? parseQuizData(m[1].trim()) : null
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Slide {r.slide_index + 1}.{r.block_index + 1} – Báo lần {r.report_count}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {r.slide_title && (
                    <p className="text-sm font-medium">Tiêu đề: {r.slide_title}</p>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Nội dung slide:</p>
                    <p className="text-sm rounded bg-muted p-2 max-h-24 overflow-y-auto">{r.slide_content.slice(0, 400)}{r.slide_content.length > 400 ? '...' : ''}</p>
                  </div>
                  {quizData && (
                    <div className="rounded-lg bg-violet-500/10 border border-violet-400/20 p-3">
                      <p className="text-xs font-medium text-violet-300 mb-1">Câu hỏi bị báo sai:</p>
                      <p className="text-sm font-medium mb-2">{quizData.question}</p>
                      <div className="space-y-1">
                        {quizData.options.map((opt, k) => (
                          <div key={k} className={['text-xs pl-2 border-l-2', k === quizData.correctIndex ? 'border-emerald-400 text-emerald-300' : 'border-slate-600'].join(' ')}>
                            {String.fromCharCode(65 + k)}. {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {r.ai_reasoning && (
                    <p className="text-xs text-muted-foreground">Lập luận AI trước đó: {r.ai_reasoning.slice(0, 200)}{r.ai_reasoning.length > 200 ? '...' : ''}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatDate(r.updated_at)}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="default" onClick={() => handleApprove(r.id, true)} disabled={actioning === r.id}>
                      <Check className="h-4 w-4 mr-1" />
                      Duyệt đúng (giữ nguyên)
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleApprove(r.id, false)} disabled={actioning === r.id}>
                      <X className="h-4 w-4 mr-1" />
                      Duyệt sai (thay câu mới)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Button variant="outline" type="button" onClick={() => router.back()}>
        ← Quay lại Admin
      </Button>
      <Toaster />
    </div>
  )
}
