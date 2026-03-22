'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getSlideEditHistory } from '../actions'

interface SlideEditHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  curriculumId: string | null
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function SlideEditHistorySheet({ open, onOpenChange, curriculumId, tr }: SlideEditHistorySheetProps) {
  const [items, setItems] = useState<Array<{ id: string; user_id: string | null; created_at: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !curriculumId) return
    setLoading(true)
    getSlideEditHistory(curriculumId, 30)
      .then((res) => {
        if (res?.success && res.items) setItems(res.items)
        else setItems([])
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [open, curriculumId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md" highZIndex>
        <SheetHeader>
          <SheetTitle>{tr('Lịch sử chỉnh sửa bản chung', 'Shared version edit history', '共享版本编辑历史', '共有版の編集履歴', '공유 버전 편집 기록')}</SheetTitle>
        </SheetHeader>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr(
            'Chỉ xem lịch sử trong 7 ngày. Khôi phục bản chung đã tắt — dùng bản riêng và mục «Lịch sử» để khôi phục phiên bản cá nhân.',
            'View-only history for 7 days. Restoring the shared version is disabled — use your personal version and History to restore.',
            '7天内仅可查看历史。已关闭恢复共享版——请使用个人版与「历史」进行恢复。',
            '7日間は閲覧のみ。共有版の復元は無効です。個人版と「履歴」で復元してください。',
            '7일간 기록만 조회합니다. 공유 버전 복원은 비활성화되었습니다. 개인 버전과 «기록»에서 복원하세요.'
          )}
        </p>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">{tr('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '로딩 중...')}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr('Chưa có lịch sử', 'No history yet', '暂无历史', '履歴なし', '기록 없음')}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={item.id} className="flex items-center gap-2 text-sm py-2 border-b border-border last:border-0">
                  <span className="text-muted-foreground shrink-0 w-6">{items.length - i}.</span>
                  <span className="truncate flex-1">
                    {item.user_id ? `${item.user_id.slice(0, 8)}...` : tr('Ẩn danh', 'Anonymous', '匿名', '匿名', '익명')}
                  </span>
                  <span className="text-muted-foreground shrink-0">{formatDate(item.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
