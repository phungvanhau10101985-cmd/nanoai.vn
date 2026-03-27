'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogPortal,
  DialogOverlay,
  DialogClose,
} from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { applySlideEditDirect, verifySlideEditProposalDraft } from '../actions'
import { CURRICULUM_UI_CREDITS, formatCurriculumCredits } from '../lib/curriculum-credit-costs'

interface SlideProposalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  curriculumId: string
  slideIndex: number
  blockIndex: number
  segmentType: 'edit' | 'add'
  originalContent?: string
  blockHeader?: string
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  onSuccess?: () => void
}

export function SlideProposalDialog({
  open,
  onOpenChange,
  curriculumId,
  slideIndex,
  blockIndex,
  segmentType,
  originalContent = '',
  blockHeader = '',
  tr,
  onSuccess,
}: SlideProposalDialogProps) {
  const [textToReplace, setTextToReplace] = useState('')
  const [replacementText, setReplacementText] = useState('')
  const [proposedHeader, setProposedHeader] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [aiCheckStatus, setAiCheckStatus] = useState<'idle' | 'passed' | 'failed'>('idle')
  const [aiCheckMessage, setAiCheckMessage] = useState('')

  useEffect(() => {
    if (open) {
      setTextToReplace('')
      setReplacementText('')
      setProposedHeader('')
      setError('')
      setChecking(false)
      setAiCheckStatus('idle')
      setAiCheckMessage('')
    }
  }, [open, segmentType])

  useEffect(() => {
    if (!open) return
    setAiCheckStatus('idle')
    setAiCheckMessage('')
  }, [open, segmentType, textToReplace, replacementText, proposedHeader])

  const toReplaceTrimmed = textToReplace.trim()
  const replacementTrimmed = replacementText.trim()
  const editCanSubmit =
    segmentType === 'edit' &&
    toReplaceTrimmed.length > 0 &&
    replacementTrimmed.length > 0 &&
    (originalContent?.includes(toReplaceTrimmed) ?? false)

  const canCheckAI =
    segmentType === 'edit'
      ? editCanSubmit
      : replacementTrimmed.length > 0

  const handleCheckAI = async () => {
    if (!canCheckAI) return
    setChecking(true)
    setError('')
    setAiCheckStatus('idle')
    setAiCheckMessage('')
    const res = await verifySlideEditProposalDraft({
      curriculumId,
      slideIndex,
      blockIndex,
      segmentType,
      originalText: segmentType === 'edit' ? toReplaceTrimmed : undefined,
      proposedText: replacementTrimmed,
      proposedHeader: segmentType === 'add' ? proposedHeader.trim() : undefined,
      chargeCredits: true,
    })
    setChecking(false)
    if (res?.error) {
      setAiCheckStatus('failed')
      setAiCheckMessage(res.error)
      return
    }
    if (res?.ok) {
      setAiCheckStatus('passed')
      setAiCheckMessage(
        res.reason || tr('AI đồng ý đề xuất. Bạn có thể gửi.', 'AI approved this proposal. You can submit now.', 'AI已同意该建议，可以提交。', 'AIが提案を承認しました。送信できます。', 'AI가 제안을 승인했습니다. 제출할 수 있습니다.')
      )
    } else {
      setAiCheckStatus('failed')
      setAiCheckMessage(
        res?.reason || tr('AI chưa đồng ý đề xuất.', 'AI has not approved this proposal yet.', 'AI尚未同意该建议。', 'AIがこの提案をまだ承認していません。', 'AI가 아직 이 제안을 승인하지 않았습니다.')
      )
    }
  }

  const handleSubmit = async () => {
    const header = proposedHeader.trim()
    if (segmentType === 'edit') {
      const toReplace = toReplaceTrimmed
      const replacement = replacementTrimmed
      if (!toReplace) {
        setError(tr('Vui lòng nhập đoạn/câu/chữ cần sửa', 'Please enter the text to replace', '请输入要替换的文本', '置き換えるテキストを入力', '교체할 텍스트를 입력하세요'))
        return
      }
      if (!replacement) {
        setError(tr('Vui lòng nhập nội dung sẽ sửa thành', 'Please enter the replacement content', '请输入替换后的内容', '置き換え後の内容を入力', '교체할 내용을 입력하세요'))
        return
      }
      if (!originalContent?.includes(toReplace)) {
        setError(tr('Đoạn cần sửa không có trong nội dung hiện tại', 'Text to replace not found in current content', '要替换的文本不在当前内容中', '置き換えるテキストが現在の内容にありません', '교체할 텍스트가 현재 내용에 없습니다'))
        return
      }
      if (aiCheckStatus !== 'passed') {
        setError(tr('Vui lòng bấm "Kiểm tra AI" và chỉ gửi khi AI đồng ý.', 'Please click "Check AI" and submit only when AI approves.', '请先点击“AI检查”，并在AI同意后再提交。', '「AIチェック」を実行し、AI同意後に送信してください。', '"AI 검사"를 먼저 실행하고 AI 승인 후 제출해 주세요.'))
        return
      }
      setLoading(true)
      setError('')
      const res = await applySlideEditDirect({
        curriculumId,
        slideIndex,
        blockIndex,
        segmentType: 'edit',
        originalText: toReplace,
        proposedText: replacement,
      })
      setLoading(false)
      if (res?.error) {
        setError(res.error)
        return
      }
      setTextToReplace('')
      setReplacementText('')
      onOpenChange(false)
      onSuccess?.()
      return
    }
    const text = replacementText.trim()
    if (!text) {
      setError(tr('Vui lòng nhập nội dung đề xuất', 'Please enter proposed content', '请输入建议内容', '提案内容を入力してください', '제안 내용을 입력하세요'))
      return
    }
    if (aiCheckStatus !== 'passed') {
      setError(tr('Vui lòng bấm "Kiểm tra AI" và chỉ gửi khi AI đồng ý.', 'Please click "Check AI" and submit only when AI approves.', '请先点击“AI检查”，并在AI同意后再提交。', '「AIチェック」を実行し、AI同意後に送信してください。', '"AI 검사"를 먼저 실행하고 AI 승인 후 제출해 주세요.'))
      return
    }
    setLoading(true)
    setError('')
    const res = await applySlideEditDirect({
      curriculumId,
      slideIndex,
      blockIndex,
      segmentType: 'add',
      proposedText: text,
      proposedHeader: header || undefined,
    })
    setLoading(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    setReplacementText('')
    setProposedHeader('')
    onOpenChange(false)
    onSuccess?.()
  }

  const zClass = 'z-[110]'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={zClass} />
        <DialogPrimitive.Content className={`fixed left-[50%] top-[50%] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg ${zClass}`}>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </DialogClose>
          <DialogHeader>
            <DialogTitle>
              {segmentType === 'edit'
                ? tr('Sửa nội dung (AI kiểm tra)', 'Edit content (AI checked)', '编辑内容（AI校验）', '内容を編集（AIチェック）', '내용 수정 (AI 검사)')
                : tr('Bổ sung nội dung (AI kiểm tra)', 'Add content (AI checked)', '补充内容（AI校验）', '内容を追加（AIチェック）', '내용 추가 (AI 검사)')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {segmentType === 'edit' && originalContent && (
              <>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label>{tr('Nội dung block hiện tại (tham khảo)', 'Current block content (reference)', '当前块内容（参考）', '現在のブロック内容（参考）', '현재 블록 내용 (참고)')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => setTextToReplace(originalContent)}
                    >
                      <Copy className="h-3 w-3" />
                      {tr('Copy vào ô sửa', 'Copy to edit field', '复制到编辑框', '編集欄にコピー', '편집란에 복사')}
                    </Button>
                  </div>
                  <div className="mt-1 rounded border bg-muted/50 p-3 text-sm max-h-20 overflow-y-auto">{originalContent}</div>
                </div>
                <div>
                  <Label>{tr('Nội dung cần sửa', 'Text to replace', '要替换的文本', '置き換えるテキスト', '교체할 텍스트')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{tr('Nên copy từ ô trên rồi chỉ sửa phần cần thay', 'Copy from above then edit the part to replace', '建议从上方复制后只修改需替换部分', '上からコピーして置き換え部分のみ編集', '위에서 복사 후 교체할 부분만 수정')}</p>
                  {(() => {
                    const toReplace = textToReplace.trim()
                    const isValid = toReplace.length > 0 && originalContent.includes(toReplace)
                    const isInvalid = toReplace.length > 0 && !originalContent.includes(toReplace)
                    return (
                      <div className="mt-1 space-y-1">
                        <Textarea
                          value={textToReplace}
                          onChange={(e) => setTextToReplace(e.target.value)}
                          placeholder={tr('VD: một từ sai chính tả...', 'e.g. a misspelled word...', '例如：拼写错误的词...', '例：誤字...', '예: 오타...')}
                          className={`min-h-[60px] ${isValid ? 'border-green-500 ring-1 ring-green-500/30' : ''} ${isInvalid ? 'border-red-500 ring-1 ring-red-500/30' : ''}`}
                        />
                        {isValid && (
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {tr('✓ Có trong nội dung – có thể gửi', '✓ Found in content – can submit', '✓ 存在于内容中 – 可提交', '✓ 内容に存在 – 送信可', '✓ 내용에 있음 – 제출 가능')}
                          </p>
                        )}
                        {isInvalid && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                            {tr('✗ Không tìm thấy – copy từ ô trên hoặc sửa lại', '✗ Not found – copy from above or fix', '✗ 未找到 – 请从上方复制或修改', '✗ 見つかりません – 上からコピーまたは修正', '✗ 찾을 수 없음 – 위에서 복사하거나 수정')}
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </div>
                <div>
                  <Label>{tr('Nội dung sẽ sửa thành', 'Replace with', '替换为', '置き換え後', '교체 후')}</Label>
                  <Textarea
                    value={replacementText}
                    onChange={(e) => setReplacementText(e.target.value)}
                    placeholder={tr('Nội dung đúng...', 'Correct content...', '正确内容...', '正しい内容...', '올바른 내용...')}
                    className="mt-1 min-h-[60px]"
                  />
                </div>
              </>
            )}
            {segmentType === 'add' && (
              <>
                <div>
                  <Label>{tr('Tiêu đề block mới (tùy chọn)', 'New block header (optional)', '新块标题（可选）', '新規ブロックタイトル（任意）', '새 블록 제목 (선택)')}</Label>
                  <Input
                    value={proposedHeader}
                    onChange={(e) => setProposedHeader(e.target.value)}
                    placeholder={blockHeader ? `${tr('VD', 'e.g.', '例如', '例', '예')}: ${blockHeader}` : tr('VD: Định nghĩa, Ví dụ...', 'e.g. Definition, Example...', '例如：定义、示例', '例：定義、例', '예: 정의, 예시')}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>{tr('Nội dung bổ sung', 'Content to add', '补充内容', '追加する内容', '추가할 내용')}</Label>
                  <Textarea
                    value={replacementText}
                    onChange={(e) => setReplacementText(e.target.value)}
                    placeholder={tr('Nội dung cần bổ sung...', 'Content to add...', '要补充的内容...', '追加する内容...', '추가할 내용...')}
                    className="mt-1 min-h-[120px]"
                  />
                </div>
              </>
            )}
            {aiCheckStatus === 'passed' && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{aiCheckMessage}</p>
            )}
            {aiCheckStatus === 'failed' && (
              <p className="text-sm text-destructive">{aiCheckMessage}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</Button>
            <Button
              variant="outline"
              onClick={() => void handleCheckAI()}
              disabled={checking || loading || !canCheckAI}
            >
              {checking
                ? tr('Đang kiểm tra AI...', 'Checking AI...', 'AI检查中...', 'AI確認中...', 'AI 확인 중...')
                : `${tr('Kiểm tra AI', 'Check AI', 'AI检查', 'AIチェック', 'AI 검사')} (${formatCurriculumCredits(CURRICULUM_UI_CREDITS.slideProposalAICheck)} ${tr('credits', 'credits', '积分', 'クレジット', '크레딧')})`}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || checking || aiCheckStatus !== 'passed' || (segmentType === 'edit' && !editCanSubmit) || (segmentType === 'add' && !replacementTrimmed)}
            >
              {loading ? tr('Đang áp dụng...', 'Applying...', '正在应用...', '適用中...', '적용 중...') : tr('Áp dụng ngay', 'Apply now', '立即应用', 'すぐ適用', '바로 적용')}
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
