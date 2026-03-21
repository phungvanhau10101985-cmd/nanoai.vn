'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

type CurriculumEditSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  curriculumMarkdown: string
  onApplyEdit: (originalText: string, editedText: string) => void
  onEscalate: (errors: string[]) => void
  onOriginalTextChange?: (text: string) => void
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  escalateLoading?: boolean
}

export function CurriculumEditSheet({
  open,
  onOpenChange,
  curriculumMarkdown,
  onApplyEdit,
  onEscalate,
  onOriginalTextChange,
  tr,
  escalateLoading = false,
}: CurriculumEditSheetProps) {
  const [originalText, setOriginalText] = useState('')
  const [editedText, setEditedText] = useState('')
  const [matchIndex, setMatchIndex] = useState<number | null>(null)
  const [matchStatus, setMatchStatus] = useState<'idle' | 'found' | 'not_found'>('idle')
  const [checkLoading, setCheckLoading] = useState(false)
  const [compareResult, setCompareResult] = useState<{
    correctVersion: string
    originalReason: string | null
    editedReason: string | null
    explanation: string
    bothAgree: boolean
    model1Version?: string
    model2Version?: string
  } | null>(null)
  const [compareErrors, setCompareErrors] = useState<string[]>([])
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) {
      setOriginalText('')
      setEditedText('')
      setMatchIndex(null)
      setMatchStatus('idle')
      setCompareResult(null)
      setCompareErrors([])
    }
  }, [open])

  const searchInCurriculum = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed || !curriculumMarkdown) {
      setMatchIndex(null)
      setMatchStatus('idle')
      return
    }
    const idx = curriculumMarkdown.indexOf(trimmed)
    if (idx >= 0) {
      setMatchIndex(idx)
      setMatchStatus('found')
    } else {
      setMatchIndex(null)
      setMatchStatus('not_found')
    }
  }, [curriculumMarkdown])

  useEffect(() => {
    if (originalText.trim().length >= 3) {
      searchInCurriculum(originalText)
    } else {
      setMatchIndex(null)
      setMatchStatus('idle')
    }
  }, [originalText, searchInCurriculum])

  const runCompare = useCallback(async () => {
    const orig = originalText.trim()
    const edited = editedText.trim()
    if (!orig || orig.length < 5) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Dữ liệu cần sửa quá ngắn.', 'Data to edit is too short.', '要编辑的数据太短。', '編集するデータが短すぎます。', '편집할 데이터가 너무 짧습니다.'), variant: 'destructive' })
      return
    }
    if (matchStatus !== 'found') {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không tìm thấy dữ liệu cần sửa trong giáo trình.', 'Data to edit not found in curriculum.', '在课程中未找到要编辑的数据。', '教材内に編集するデータが見つかりません。', '교육과정에서 편집할 데이터를 찾을 수 없습니다.'), variant: 'destructive' })
      return
    }
    if (!edited) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Nhập nội dung sẽ sửa thành.', 'Enter the replacement content.', '请输入替换内容。', '置換後の内容を入力してください。', '대체할 내용을 입력하세요.'), variant: 'destructive' })
      return
    }

    setCheckLoading(true)
    setCompareResult(null)
    setCompareErrors([])
    const CONTEXT_CHARS = 250
    const idx = matchIndex ?? curriculumMarkdown.indexOf(orig)
    const start = idx >= 0 ? Math.max(0, idx - CONTEXT_CHARS) : 0
    const originalRegion = idx >= 0 ? curriculumMarkdown.slice(start, idx + orig.length) : orig
    const editedRegion = idx >= 0 ? curriculumMarkdown.slice(start, idx) + edited : edited
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)
    try {
      const res = await fetch('/api/curriculum-edit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalRegion, editedRegion }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json().catch(() => ({}))
      const rc = data.regionCompare
      const bothAgree = !!data.bothAgree

      if (rc) {
        setCompareResult({
          correctVersion: rc.correctVersion || 'edited',
          originalReason: rc.originalReason || null,
          editedReason: rc.editedReason || null,
          explanation: rc.explanation || '',
          bothAgree,
          model1Version: data.model1Version,
          model2Version: data.model2Version,
        })
        setCompareErrors(Array.isArray(data.errors) ? data.errors : [])

        if (bothAgree) {
          if (rc.correctVersion === 'edited') {
            onApplyEdit(orig, edited)
            toast({
              title: tr('Đã áp dụng sửa', 'Edit applied', '已应用修改', '編集を適用しました', '편집 적용됨'),
              description: rc.explanation || tr('2 AI đồng ý bản sửa đúng.', '2 AIs agree the edit is correct.', '2个AI同意修改正确。', '2つのAIが編集が正しいと同意。', '2개 AI가 편집이 맞다고 동의.'),
              duration: 4000,
            })
            onOpenChange(false)
          } else if (rc.correctVersion === 'original') {
            toast({
              title: tr('Giữ bản gốc', 'Keep original', '保留原文', '元のまま', '원본 유지'),
              description: (rc.explanation || tr('2 AI đồng ý bản gốc đúng.', '2 AIs agree the original is correct.', '2个AI同意原文正确。', '2つのAIが元が正しいと同意。', '2개 AI가 원본이 맞다고 동의.')) + ' ' + tr('Sửa lại và thử tiếp.', 'Edit and try again.', '请修改后重试。', '編集して再試行してください。', '수정 후 다시 시도하세요.'),
              variant: 'destructive',
              duration: 4000,
            })
          }
        }
      } else if (!bothAgree && rc) {
        toast({
          title: tr('2 AI không đồng ý', '2 AIs disagree', '2个AI意见不一致', '2つのAIが不一致', '2개 AI 의견 불일치'),
          description: tr('Bấm "Gửi admin" để nhờ xem xét.', 'Click "Send to admin" for review.', '点击"发送给管理员"请求审核。', '「管理者に送信」をクリックして確認。', '"관리자에게 전송" 클릭하여 검토 요청.'),
          variant: 'destructive',
        })
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast({
          title: tr('Hết thời gian', 'Timeout', '超时', 'タイムアウト', '타임아웃'),
          description: tr('AI phản hồi chậm. Thử lại.', 'AI response slow. Try again.', 'AI响应慢。请重试。', 'AI応答が遅い。再試行。', 'AI 응답 지연. 다시 시도.'),
          variant: 'destructive',
        })
      }
    } finally {
      clearTimeout(timeoutId)
      setCheckLoading(false)
    }
  }, [originalText, editedText, matchStatus, onApplyEdit, onOpenChange, tr, toast])

  useEffect(() => {
    if (!open || !editedText.trim() || matchStatus !== 'found') return
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current)
    checkTimeoutRef.current = setTimeout(() => {
      checkTimeoutRef.current = null
      void runCompare()
    }, 600)
    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current)
    }
  }, [open, editedText, matchStatus, runCompare])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{tr('Sửa giáo trình', 'Edit curriculum', '编辑课程', '教材を編集', '교육과정 편집')}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">
              {tr('Dữ liệu cần sửa', 'Data to edit', '要编辑的数据', '編集するデータ', '편집할 데이터')}
            </label>
            <Textarea
              value={originalText}
              onChange={(e) => {
                const v = e.target.value
                setOriginalText(v)
                onOriginalTextChange?.(v)
              }}
              placeholder={tr('Dán hoặc gõ đoạn cần tìm trong giáo trình...', 'Paste or type the segment to find in curriculum...', '粘贴或输入要在课程中查找的段落...', '教材内で検索する段落を貼り付けまたは入力...', '교육과정에서 찾을 단락 붙여넣기 또는 입력...')}
              className="min-h-[100px] text-sm"
              spellCheck={false}
            />
            {matchStatus === 'found' && (
              <p className="mt-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ {tr('Đã tìm thấy trong giáo trình (bôi màu)', 'Found in curriculum (highlighted)', '已在课程中找到（已高亮）', '教材内で見つかりました（ハイライト）', '교육과정에서 찾음 (강조됨)')}
              </p>
            )}
            {matchStatus === 'not_found' && (
              <p className="mt-1.5 text-sm text-destructive font-medium">
                ✗ {tr('Không tìm thấy dữ liệu cần sửa trong giáo trình', 'Data to edit not found in curriculum', '在课程中未找到要编辑的数据', '教材内に編集するデータが見つかりません', '교육과정에서 편집할 데이터를 찾을 수 없습니다')}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              {tr('Dữ liệu sẽ sửa thành', 'Data to replace with', '将替换为', '置換後のデータ', '다음으로 수정')}
            </label>
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder={tr('Gõ nội dung mới thay thế...', 'Type the new content to replace...', '输入要替换的新内容...', '置換する新しい内容を入力...', '대체할 새 내용 입력...')}
              className="min-h-[100px] text-sm"
              spellCheck={false}
              disabled={matchStatus !== 'found'}
            />
            {matchStatus !== 'found' && (
              <p className="mt-1 text-xs text-muted-foreground">
                {tr('Tìm thấy dữ liệu cần sửa trước.', 'Find the data to edit first.', '请先找到要编辑的数据。', 'まず編集するデータを見つけてください。', '먼저 편집할 데이터를 찾으세요.')}
              </p>
            )}
          </div>

          {checkLoading && (
            <p className="text-sm text-amber-600 dark:text-amber-400 animate-pulse">
              {tr('Đang hỏi 2 AI so sánh...', 'Asking 2 AIs to compare...', '正在请2个AI比较...', '2つのAIに比較を依頼中...', '2개 AI에게 비교 요청 중...')}
            </p>
          )}

          {compareResult && (
            <div className="rounded-lg border-2 border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                {tr('Kết quả so sánh AI:', 'AI comparison result:', 'AI比较结果：', 'AI比較結果：', 'AI 비교 결과:')}
              </p>
              {compareResult.originalReason && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <span className="font-medium">{tr('Bản gốc sai:', 'Original wrong:', '原文错误：', '元が誤り：', '원본 오류:')}</span> {compareResult.originalReason}
                </p>
              )}
              {compareResult.editedReason && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <span className="font-medium">{tr('Bản sửa sai:', 'Edited wrong:', '修改错误：', '編集が誤り：', '수정 오류:')}</span> {compareResult.editedReason}
                </p>
              )}
              {compareResult.explanation && (
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{compareResult.explanation}</p>
              )}
              {!compareResult.bothAgree && (
                <p className="text-sm text-destructive font-medium">
                  {tr('2 AI không đồng ý. Bấm "Gửi admin" để nhờ xem xét.', '2 AIs disagree. Click "Send to admin" for review.', '2个AI意见不一致。点击"发送给管理员"请求审核。', '2つのAIが不一致。管理者に送信して確認を依頼。', '2개 AI 의견 불일치. 관리자에게 전송하여 검토 요청.')}
                </p>
              )}
            </div>
          )}

          {compareErrors.length > 0 && compareResult?.bothAgree === false && (
            <div className="rounded-lg border border-amber-400 dark:border-amber-500 p-3 bg-amber-50/80 dark:bg-amber-950/30">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                {tr('Mỗi AI đưa ra ý kiến khác nhau – cần admin xem xét', 'Each AI gave different opinion – admin review needed', '每个AI意见不同–需管理员审核', '各AIが異なる意見–管理者確認必要', '각 AI가 다른 의견–관리자 검토 필요')}
              </p>
              {(compareResult.model1Version || compareResult.model2Version) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  Gemini: {compareResult.model1Version === 'original' ? tr('bản gốc', 'original', '原文', '元', '원본') : compareResult.model1Version === 'edited' ? tr('bản sửa', 'edited', '修改', '編集', '수정') : compareResult.model1Version || '–'} · DeepSeek: {compareResult.model2Version === 'original' ? tr('bản gốc', 'original', '原文', '元', '원본') : compareResult.model2Version === 'edited' ? tr('bản sửa', 'edited', '修改', '編集', '수정') : compareResult.model2Version || '–'}
                </p>
              )}
              <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1 mb-3">
                {compareErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEscalate(compareErrors)}
                disabled={escalateLoading}
                className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-300"
              >
                {escalateLoading ? tr('Đang gửi...', 'Sending...', '发送中...', '送信中...', '전송 중...') : tr('Gửi admin xem xét', 'Send to admin for review', '发送给管理员审核', '管理者に送信して確認', '관리자에게 검토 요청')}
              </Button>
            </div>
          )}

          <Button
            onClick={() => void runCompare()}
            disabled={checkLoading || matchStatus !== 'found' || !editedText.trim()}
            className="w-full"
          >
            {checkLoading ? tr('Đang kiểm tra...', 'Checking...', '正在检查...', '確認中...', '확인 중...') : tr('Áp dụng sửa', 'Apply edit', '应用修改', '編集を適用', '편집 적용')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function findAllMatchIndices(text: string, search: string): number[] {
  const indices: number[] = []
  let pos = 0
  while ((pos = text.indexOf(search, pos)) >= 0) {
    indices.push(pos)
    pos += 1
  }
  return indices
}

export function highlightMatchInCurriculum(markdown: string, searchText: string): { parts: Array<{ text: string; highlight: boolean }>; found: boolean; matchCount: number } {
  const trimmed = searchText.trim()
  if (!trimmed || !markdown) return { parts: [{ text: markdown, highlight: false }], found: false, matchCount: 0 }
  const indices = findAllMatchIndices(markdown, trimmed)
  if (indices.length === 0) return { parts: [{ text: markdown, highlight: false }], found: false, matchCount: 0 }
  const parts: Array<{ text: string; highlight: boolean }> = []
  let lastEnd = 0
  for (const idx of indices) {
    if (idx > lastEnd) parts.push({ text: markdown.slice(lastEnd, idx), highlight: false })
    parts.push({ text: trimmed, highlight: true })
    lastEnd = idx + trimmed.length
  }
  if (lastEnd < markdown.length) parts.push({ text: markdown.slice(lastEnd), highlight: false })
  return { parts, found: indices.length === 1, matchCount: indices.length }
}
