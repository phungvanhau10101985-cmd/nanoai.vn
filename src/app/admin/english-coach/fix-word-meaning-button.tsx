'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useStepUpOtp, fetchWithStepUp } from '@/components/auth/step-up-otp-provider'

type FailedItem = {
  id: string
  word: string
  target_language: string | null
  native_language: string | null
  source_table: string
  error_message: string | null
  created_at: string
}

export function FixWordMeaningButton() {
  const { ensureStepUp } = useStepUpOtp()
  const [loading, setLoading] = useState(false)
  const [failedItems, setFailedItems] = useState<FailedItem[]>([])
  const [result, setResult] = useState<{
    ok?: boolean
    message?: string
    updatedDaily?: number
    updatedReview?: number
    updatedCache?: number
    failedCount?: number
    error?: string
  } | null>(null)

  async function fetchFailed() {
    try {
      const res = await fetch('/api/english-coach/fix-word-meaning')
      const data = await res.json()
      if (res.ok && Array.isArray(data.items)) setFailedItems(data.items)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void fetchFailed()
  }, [])

  async function handleFix() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetchWithStepUp('/api/english-coach/fix-word-meaning', { method: 'POST' }, ensureStepUp)
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
        failedCount: data.failedCount,
      })
      void fetchFailed()
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Lỗi kết nối.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chuẩn hóa nghĩa mẹ đẻ</CardTitle>
        <CardDescription>
          Sửa các bản ghi có nghĩa sai ngôn ngữ (chữ CJK thay vì tiếng mẹ đẻ) trong daily words, review queue và cache.
          Từ chuẩn hóa thất bại sẽ được lưu vào danh sách để admin fix lại hoặc sửa thủ công.
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
        {failedItems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Từ chuẩn hóa thất bại (cần fix thủ công hoặc chạy lại)</h4>
            <ul className="max-h-48 overflow-y-auto rounded border bg-muted/30 p-2 text-sm">
              {failedItems.map((item) => (
                <li key={item.id} className="flex flex-wrap gap-x-2 gap-y-1 py-1">
                  <span className="font-mono font-medium">{item.word}</span>
                  <span className="text-muted-foreground">
                    {item.target_language || '-'} → {item.native_language || '-'}
                  </span>
                  {item.error_message && (
                    <span className="text-destructive">{item.error_message}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
