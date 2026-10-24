'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, X } from 'lucide-react'
import { getWorksheetBlockReviewCount } from '@/app/tao-giao-trinh/actions'
import { WORKSHEET_REVIEW_AGREES } from '@/app/tao-giao-trinh/lib/worksheet-review-count'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import type { WorksheetQuestionBlock } from '@/app/tao-giao-trinh/lib/worksheet-parse-questions'

export type WorksheetEditTr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

export function WorksheetEditSectionPopup({
  open,
  onClose,
  worksheetId,
  filter,
  blocks,
  blockIndex,
  blockContent,
  onBlockContentChange,
  onSelectBlock,
  onCancelEdit,
  onSave,
  saving,
  saveDisabled,
  tr,
}: {
  open: boolean
  onClose: () => void
  worksheetId?: string
  filter: 'quiz' | 'essay'
  blocks: WorksheetQuestionBlock[]
  blockIndex: number | null
  blockContent: string
  onBlockContentChange: (v: string) => void
  onSelectBlock: (idx: number) => void
  onCancelEdit: () => void
  onSave: () => void
  saving: boolean
  saveDisabled: boolean
  tr: WorksheetEditTr
}) {
  const filteredBlocks = blocks.filter((b) => b.type === filter)
  const block = blockIndex != null ? blocks[blockIndex] : undefined
  const [reviewCount, setReviewCount] = useState({ agreeCount: 0, rejectCount: 0, editCount: 0 })

  useEffect(() => {
    const id = worksheetId?.trim() ?? ''
    if (!open || blockIndex == null || blockIndex < 0 || !id) {
      setReviewCount({ agreeCount: 0, rejectCount: 0, editCount: 0 })
      return
    }
    let cancelled = false
    void getWorksheetBlockReviewCount(id, blockIndex).then((result) => {
      if (cancelled) return
      setReviewCount({
        agreeCount: Number(result?.agreeCount) || 0,
        rejectCount: Number(result?.rejectCount) || 0,
        editCount: Number(result?.editCount) || 0,
      })
    })
    return () => {
      cancelled = true
    }
  }, [open, worksheetId, blockIndex])

  /**
   * Nút X giống luồng “bước lui” trong popup — không dùng router.back (tránh mất cả trang chính).
   * Đang sửa 1 câu → về danh sách câu; đang ở danh sách → đóng popup (vẫn ở trang tạo giáo trình / phiếu / slide GV).
   */
  const handleCloseButton = () => {
    if (blockIndex != null) onCancelEdit()
    else onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="fixed left-0 top-0 right-0 bottom-0 z-50 w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 rounded-none border-2 border-amber-400/60 bg-amber-50/95 dark:bg-amber-950/95 dark:border-amber-500/50 flex flex-col p-0 gap-0"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 p-4 pb-2 border-b border-amber-300/50 dark:border-amber-700/50">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/30"
                onClick={blockIndex != null ? onCancelEdit : onClose}
                aria-label={tr('Quay lại', 'Back', '返回', '戻る', '뒤로')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="truncate text-left text-lg font-semibold text-amber-900 dark:text-amber-100">
                {tr('Sửa phiếu bài tập', 'Edit worksheet', '编辑练习', 'ワークシート編集', '워크시트 수정')}
                {filter === 'quiz' ? ` – ${tr('Trắc nghiệm', 'Quiz', '选择题', 'クイズ', '퀴즈')}` : ` – ${tr('Tự luận', 'Essay', '主观题', '記述式', '서술형')}`}
                {blockIndex != null && block && ` – ${tr('Câu', 'Question', '题目', '問題', '문제')} ${block.index}`}
              </DialogTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/30"
              onClick={handleCloseButton}
              aria-label={
                blockIndex != null
                  ? tr('Quay lại danh sách câu', 'Back to question list', '返回题目列表', '問題一覧に戻る', '문제 목록으로')
                  : tr('Đóng', 'Close', '关闭', '閉じる', '닫기')
              }
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-auto">
          {filteredBlocks.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
              {filter === 'quiz'
                ? tr('Không có câu trắc nghiệm nào để sửa.', 'No quiz questions to edit.', '没有可编辑的选择题。', '編集可能な選択式問題がありません。', '수정할 퀴즈 문제가 없습니다.')
                : tr('Không có bài tự luận nào để sửa.', 'No essay questions to edit.', '没有可编辑的主观题。', '編集可能な記述式問題がありません。', '수정할 서술형 문제가 없습니다.')}
            </p>
          ) : blockIndex != null ? (
            <>
              <Textarea
                value={blockContent}
                onChange={(e) => onBlockContentChange(e.target.value)}
                placeholder={tr('Sửa nội dung câu...', 'Edit question content...', '编辑题目内容...', '問題の内容を編集...', '문제 내용 편집...')}
                className="flex-1 min-h-[40vh] text-sm border-amber-300/60 dark:border-amber-600/50 focus:ring-amber-400/40 resize-none"
              />
              <p className="shrink-0 text-sm font-medium text-amber-900 dark:text-amber-100">
                {tr(
                  `${reviewCount.agreeCount}/${WORKSHEET_REVIEW_AGREES} đúng liên tiếp · ${reviewCount.rejectCount}/${WORKSHEET_REVIEW_AGREES} sai liên tiếp`,
                  `${reviewCount.agreeCount}/${WORKSHEET_REVIEW_AGREES} correct in a row · ${reviewCount.rejectCount}/${WORKSHEET_REVIEW_AGREES} wrong in a row`,
                  `连续判对 ${reviewCount.agreeCount}/${WORKSHEET_REVIEW_AGREES} · 连续判错 ${reviewCount.rejectCount}/${WORKSHEET_REVIEW_AGREES}`,
                  `連続で正しい ${reviewCount.agreeCount}/${WORKSHEET_REVIEW_AGREES} · 連続で誤り ${reviewCount.rejectCount}/${WORKSHEET_REVIEW_AGREES}`,
                  `연속 맞음 ${reviewCount.agreeCount}/${WORKSHEET_REVIEW_AGREES} · 연속 틀림 ${reviewCount.rejectCount}/${WORKSHEET_REVIEW_AGREES}`
                )}
                {' · '}
                {tr(
                  `Sửa ${reviewCount.editCount} lần`,
                  `Edited ${reviewCount.editCount} times`,
                  `修改 ${reviewCount.editCount} 次`,
                  `修正 ${reviewCount.editCount} 回`,
                  `수정 ${reviewCount.editCount}회`
                )}
              </p>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button type="button" variant="outline" size="sm" onClick={onCancelEdit}>
                  {tr('Quay lại', 'Back', '返回', '戻る', '뒤로')}
                </Button>
                <Button
                  type="button"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50"
                  onClick={onSave}
                  disabled={saving || saveDisabled}
                >
                  {saving
                    ? tr('Đang lưu...', 'Saving...', '正在保存...', '保存中...', '저장 중...')
                    : tr('Lưu câu này', 'Save this question', '保存此题', 'この問題を保存', '이 문제 저장')}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {blocks.map((b, idx) => {
                if (b.type !== filter) return null
                return (
                  <div
                    key={b.index}
                    className="flex items-start gap-2 p-3 rounded-lg border border-amber-200/60 dark:border-amber-700/40 bg-white/50 dark:bg-slate-900/30 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          {b.index}. {b.type === 'quiz' ? tr('Trắc nghiệm', 'Quiz', '选择题', 'クイズ', '퀴즈') : tr('Tự luận', 'Essay', '主观题', '記述式', '서술형')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 break-words">
                        {latexToReadable(b.content).slice(0, 120)}{b.content.length > 120 ? '...' : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-amber-400/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                      onClick={() => onSelectBlock(idx)}
                    >
                      {tr('Sửa', 'Edit', '编辑', '編集', '수정')}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
