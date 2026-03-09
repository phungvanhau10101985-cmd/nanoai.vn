'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { listSlideProposalsForAdmin, adminReviewSlideProposal } from '@/app/tao-giao-trinh/actions'
import { useToast } from '@/hooks/use-toast'
import { Check, X, RefreshCw } from 'lucide-react'
import Link from 'next/link'

type Proposal = {
  id: string
  curriculum_id: string
  slide_index: number
  block_index: number
  segment_type: string
  original_text: string | null
  proposed_text: string
  proposed_header: string | null
  status: string
  agree_count: number
  disagree_count: number
  proposed_by: string | null
  created_at: string
}

export function SlideProposalsClient() {
  const { toast } = useToast()
  const [items, setItems] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [actioning, setActioning] = useState<string | null>(null)

  const fetchData = () => {
    setLoading(true)
    listSlideProposalsForAdmin({ status: statusFilter || undefined, limit: 100 })
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
  }

  useEffect(() => {
    fetchData()
  }, [statusFilter])

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    setActioning(id)
    const res = await adminReviewSlideProposal(id, action)
    setActioning(null)
    if (res?.error) {
      toast({ title: 'Lỗi', description: res.error, variant: 'destructive' })
    } else {
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Đề xuất sửa slide</h1>
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
            Chưa có đề xuất nào.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Slide {p.slide_index + 1}.{p.block_index + 1} – {p.segment_type === 'edit' ? 'Sửa' : 'Bổ sung'}
                  </CardTitle>
                  <Badge variant={p.status === 'approved' ? 'default' : p.status === 'rejected' ? 'destructive' : 'secondary'}>
                    {p.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {p.original_text && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Nội dung gốc:</p>
                    <p className="text-sm rounded bg-muted p-2 max-h-20 overflow-y-auto">{p.original_text.slice(0, 300)}{p.original_text.length > 300 ? '...' : ''}</p>
                  </div>
                )}
                {p.proposed_header && (
                  <p className="text-sm"><strong>Tiêu đề:</strong> {p.proposed_header}</p>
                )}
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Nội dung đề xuất:</p>
                  <p className="text-sm rounded bg-amber-50 dark:bg-amber-950/30 p-2">{p.proposed_text}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>👍 {p.agree_count} đồng ý</span>
                  <span>👎 {p.disagree_count} không</span>
                  <span>{formatDate(p.created_at)}</span>
                </div>
                {p.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => handleReview(p.id, 'approve')} disabled={actioning === p.id}>
                      <Check className="h-4 w-4 mr-1" />
                      Duyệt
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleReview(p.id, 'reject')} disabled={actioning === p.id}>
                      <X className="h-4 w-4 mr-1" />
                      Từ chối
                    </Button>
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
