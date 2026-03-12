'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getPersonalSlidesHistory, restorePersonalFromHistory } from '../actions'

interface PersonalHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  curriculumId: string | null
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  onRestored?: () => void
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function PersonalHistorySheet({ open, onOpenChange, curriculumId, tr, onRestored }: PersonalHistorySheetProps) {
  const [items, setItems] = useState<Array<{ id: string; slides_json: unknown; created_at: string }>>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !curriculumId) return
    setLoading(true)
    getPersonalSlidesHistory(curriculumId)
      .then((res) => {
        if (res?.success && res.items) setItems(res.items)
        else setItems([])
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [open, curriculumId])

  const handleRestore = async (historyId: string) => {
    if (!curriculumId) return
    setRestoringId(historyId)
    try {
      const res = await restorePersonalFromHistory(curriculumId, historyId)
      if (res?.success) {
        onRestored?.()
        onOpenChange(false)
      } else {
        alert(res?.error ?? tr('Khôi phục thất bại', 'Restore failed', '恢复失败', '復元失敗', '복원 실패'))
      }
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md" highZIndex>
        <SheetHeader>
          <SheetTitle>{tr('Lịch sử bản riêng', 'Personal version history', '个人版本历史', '個人版の履歴', '개인 버전 기록')}</SheetTitle>
        </SheetHeader>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr('Khôi phục bất cứ khi nào trong 7 ngày. Sau 7 ngày lịch sử thay đổi sẽ bị xóa.', 'Restore anytime within 7 days. After 7 days, change history is deleted.', '7天内可随时恢复。7天后变更历史将被删除。', '7日以内はいつでも復元可能。7日後は変更履歴を削除。', '7일 이내 언제든 복원 가능. 7일 후 변경 기록 삭제됨.')}
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
                  <span className="truncate flex-1">{formatDate(item.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => void handleRestore(item.id)}
                    disabled={restoringId !== null}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-500 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 hover:bg-emerald-500/25 disabled:opacity-50 shrink-0"
                  >
                    {restoringId === item.id ? tr('Đang...', 'Restoring...', '恢复中...', '復元中...', '복원 중...') : tr('Khôi phục', 'Restore', '恢复', '復元', '복원')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
