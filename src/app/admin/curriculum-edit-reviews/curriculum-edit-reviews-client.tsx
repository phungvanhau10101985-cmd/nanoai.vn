'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  listCurriculumEditReviewsForAdmin,
  adminReviewCurriculumEdit,
} from '@/app/tao-giao-trinh/actions'
import { useToast } from '@/hooks/use-toast'
import { Check, X, RefreshCw } from 'lucide-react'
import Link from 'next/link'

type Review = {
  id: string
  user_id: string | null
  curriculum_id: string | null
  topic: string
  subject_id: string
  grade_level_id: string
  textbook_set_id: string
  textbook_volume: string | null
  lesson_number: number | null
  lesson_type_id: string
  num_lessons: number
  lesson_duration_minutes: number
  goals: string | null
  content_markdown: string
  ai_errors: unknown[]
  status: string
  created_at: string
  admin_note: string | null
}

export function CurriculumEditReviewsClient() {
  const { toast } = useToast()
  const [items, setItems] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [actioning, setActioning] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({})

  const fetchData = useCallback(() => {
    setLoading(true)
    listCurriculumEditReviewsForAdmin({ status: statusFilter || undefined, limit: 100 })
      .then((res) => {
        if (res?.success && res.items) setItems(res.items)
        else {
          setItems([])
          if (res && 'error' in res && res.error) {
            toast({ title: 'Lỗi', description: res.error, variant: 'destructive' })
          }
        }
      })
      .finally(() => setLoading(false))
  }, [statusFilter, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    setActioning(id)
    const note = action === 'reject' ? rejectNote[id] : undefined
    const res = await adminReviewCurriculumEdit(id, action, note)
    setActioning(null)
    if (res?.error) {
      toast({ title: 'Lỗi', description: res.error, variant: 'destructive' })
    } else {
      setRejectNote((prev) => ({ ...prev, [id]: '' }))
      fetchData()
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('vi-VN')
    } catch {
      return iso
    }
  }

  const aiErrorsList = (errs: unknown[]) => {
    if (!Array.isArray(errs) || errs.length === 0) return null
    return errs.map((e, i) => (
      <li key={i} className="text-sm text-amber-700 dark:text-amber-400">
        {typeof e === 'string' ? e : JSON.stringify(e)}
      </li>
    ))
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Duyệt giáo trình gửi admin</h1>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Tất cả</option>
            <option value="pending">Đang chờ</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Chưa có yêu cầu nào.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{r.topic}</CardTitle>
                  <Badge
                    variant={
                      r.status === 'approved'
                        ? 'default'
                        : r.status === 'rejected'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.subject_id} • {r.grade_level_id} • {r.textbook_set_id}
                  {r.curriculum_id ? ` • Sửa #${r.curriculum_id.slice(0, 8)}` : ' • Tạo mới'}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {r.ai_errors && Array.isArray(r.ai_errors) && r.ai_errors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Lỗi AI báo:</p>
                    <ul className="list-disc pl-4 space-y-1">{aiErrorsList(r.ai_errors)}</ul>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Nội dung giáo trình:</p>
                  <pre className="text-xs rounded bg-muted p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {r.content_markdown.slice(0, 2000)}
                    {r.content_markdown.length > 2000 ? '\n...' : ''}
                  </pre>
                </div>
                <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}</div>
                {r.status === 'pending' && (
                  <div className="space-y-2 pt-2">
                    <Textarea
                      placeholder="Ghi chú khi từ chối (tùy chọn)"
                      value={rejectNote[r.id] ?? ''}
                      onChange={(e) =>
                        setRejectNote((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      className="min-h-[60px] text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleReview(r.id, 'approve')}
                        disabled={actioning === r.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Duyệt
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReview(r.id, 'reject')}
                        disabled={actioning === r.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Từ chối
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Link href="/admin">
        <Button variant="outline">← Quay lại Admin</Button>
      </Link>
    </div>
  )
}
