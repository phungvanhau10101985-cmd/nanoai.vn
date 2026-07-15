'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useStepUpOtp, fetchWithStepUp } from '@/components/auth/step-up-otp-provider'

export function FixWordExamplesButton() {
  const { ensureStepUp } = useStepUpOtp()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    ok?: boolean
    message?: string
    updatedDaily?: number
    updatedReview?: number
    updatedCache?: number
    error?: string
  } | null>(null)

  async function handleFix() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetchWithStepUp('/api/english-coach/fix-word-examples', { method: 'POST' }, ensureStepUp)
      const data = await res.json()
      if (!res.ok) {
        setResult({ ok: false, error: data.error || 'Lỗi không xác định.' })
        return
      }
      setResult({
        ok: true,
        message: data.message,
        updatedDaily: data.updatedDaily,
        updatedReview: data.updatedReview,
        updatedCache: data.updatedCache,
      })
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Lỗi kết nối.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chuẩn hóa ví dụ từ vựng</CardTitle>
        <CardDescription>
          Sửa các bản ghi có targetText sai định dạng (pinyin thay vì chữ gốc) trong daily words, review queue và cache.
          Tương đương chạy <code className="rounded bg-muted px-1">npm run fix-word-examples</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleFix} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang xử lý...
            </>
          ) : (
            'Chạy chuẩn hóa'
          )}
        </Button>
        {result && (
          <div
            className={`rounded-lg border p-4 text-sm ${
              result.ok ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
            }`}
          >
            {result.ok ? (
              <p className="font-medium text-green-800 dark:text-green-200">{result.message}</p>
            ) : (
              <p className="font-medium text-red-800 dark:text-red-200">{result.error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
