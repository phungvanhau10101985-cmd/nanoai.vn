'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { worksheetMarkdownToHtml } from './worksheet-view'
import { parseWorksheetIntoBlocks, replaceBlockInMarkdown, type WorksheetQuestionBlock } from '@/app/tao-giao-trinh/lib/worksheet-parse-questions'
import { saveWorksheetContent } from '@/app/tao-giao-trinh/actions'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { toEditableBlockContent } from '@/app/tao-giao-trinh/lib/worksheet-editable-block-content'
import { getEssayProblem, getEssaySolution, normalizeSolutionToStr } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import {
  WorksheetEditSectionPopup,
  type WorksheetEditTr,
} from '@/app/tao-giao-trinh/components/worksheet-edit-section-popup'
import { CURRICULUM_UI_CREDITS, formatCurriculumCredits } from '@/app/tao-giao-trinh/lib/curriculum-credit-costs'
import type { WebLocale } from '@/lib/i18n/config'

function worksheetTrFromLocale(locale: WebLocale): WorksheetEditTr {
  return (vi, en, zh, ja, ko) => {
    switch (locale) {
      case 'en':
        return en
      case 'zh':
        return zh
      case 'ja':
        return ja
      case 'ko':
        return ko
      default:
        return vi
    }
  }
}

type Part =
  | { kind: 'gap'; text: string; key: string }
  | { kind: 'block'; block: WorksheetQuestionBlock; globalIdx: number; key: string }

function buildParts(markdown: string, blocks: WorksheetQuestionBlock[]): Part[] {
  const parts: Part[] = []
  let pos = 0
  blocks.forEach((block, globalIdx) => {
    if (block.startOffset > pos) {
      const text = markdown.slice(pos, block.startOffset)
      parts.push({ kind: 'gap', text, key: `gap-${pos}-${block.startOffset}` })
    }
    parts.push({ kind: 'block', block, globalIdx, key: `block-${globalIdx}-${block.startOffset}` })
    pos = block.endOffset
  })
  if (pos < markdown.length) {
    parts.push({ kind: 'gap', text: markdown.slice(pos), key: `gap-${pos}-end` })
  }
  return parts
}

export default function WorksheetViewWithEdit({
  worksheetId,
  initialMarkdown,
  questionBadge,
  locale,
}: {
  worksheetId: string
  initialMarkdown: string
  questionBadge: string
  locale: WebLocale
}) {
  const tr = useMemo(() => worksheetTrFromLocale(locale), [locale])
  const worksheetEditCheckCreditSuffix = useMemo(
    () => ` (${formatCurriculumCredits(CURRICULUM_UI_CREDITS.worksheetEditCheck)} ${tr('credits', 'credits', '积分', 'クレジット', '크레딧')})`,
    [tr]
  )
  const worksheetEditSaveCreditSuffix = useMemo(
    () => ` (${formatCurriculumCredits(CURRICULUM_UI_CREDITS.worksheetEditSave)} ${tr('credits', 'credits', '积分', 'クレジット', '크레딧')})`,
    [tr]
  )
  const { toast } = useToast()
  const router = useRouter()
  const [markdown, setMarkdown] = useState(initialMarkdown)
  useEffect(() => {
    setMarkdown(initialMarkdown)
  }, [initialMarkdown])
  const [worksheetEditFilter, setWorksheetEditFilter] = useState<'quiz' | 'essay' | null>(null)
  const [worksheetEditBlockIndex, setWorksheetEditBlockIndex] = useState<number | null>(null)
  const [worksheetEditBlockContent, setWorksheetEditBlockContent] = useState('')
  const [worksheetEditImages, setWorksheetEditImages] = useState<File[]>([])
  const [worksheetEditSaving, setWorksheetEditSaving] = useState(false)
  const [worksheetEditCheckLoading, setWorksheetEditCheckLoading] = useState(false)
  const [worksheetEditCheckResult, setWorksheetEditCheckResult] = useState<{
    issues: Array<{ field: string; location: string; issue: string; suggested: string }>
    correctedContent: string | null
  } | null>(null)

  const worksheetEditBlocks = useMemo(() => parseWorksheetIntoBlocks(markdown), [markdown])
  const parts = useMemo(() => buildParts(markdown, worksheetEditBlocks), [markdown, worksheetEditBlocks])

  const resetEditState = useCallback(() => {
    setWorksheetEditFilter(null)
    setWorksheetEditBlockIndex(null)
    setWorksheetEditBlockContent('')
    setWorksheetEditImages([])
    setWorksheetEditCheckResult(null)
  }, [])

  const loadBlockEditorContent = useCallback(
    async (idx: number) => {
      const block = worksheetEditBlocks[idx]
      if (!block) return
      let nextContent = toEditableBlockContent(block.content, block.type === 'essay' ? 'essay' : 'quiz')
      try {
        const res = await fetch(`/api/worksheet/${encodeURIComponent(worksheetId)}`)
        const data = await res.json().catch(() => ({}))
        const list = Array.isArray(data?.questions) ? (data.questions as Array<{ type?: string; content_json?: unknown }>) : []
        const sameTypeIdx = worksheetEditBlocks.slice(0, idx + 1).filter((b) => b.type === block.type).length - 1
        const row = list.filter((q) => q?.type === block.type)[sameTypeIdx]
        if (row && block.type === 'essay') {
          const heading = (nextContent.match(/^([^\n]*Bài\s+\d+[^\n]*)/i)?.[1] ?? '').trim()
          const problem = latexToReadable(getEssayProblem(row.content_json) || '')
          const solution = normalizeSolutionToStr(getEssaySolution(row.content_json)) || '(Chưa có lời giải)'
          nextContent = [heading, problem, '**Lời giải:**', solution].filter(Boolean).join('\n\n')
        }
      } catch {
        /* fallback markdown hiện tại */
      }
      setWorksheetEditBlockContent(nextContent)
      setWorksheetEditImages([])
      setWorksheetEditCheckResult(null)
    },
    [worksheetEditBlocks, worksheetId]
  )

  const openBlockEditor = useCallback(
    async (globalIdx: number) => {
      const block = worksheetEditBlocks[globalIdx]
      if (!block) return
      setWorksheetEditFilter(block.type)
      setWorksheetEditBlockIndex(globalIdx)
      await loadBlockEditorContent(globalIdx)
    },
    [worksheetEditBlocks, loadBlockEditorContent]
  )

  const handleSaveWorksheetBlockEdit = useCallback(
    async (opts?: { skipAiCheck?: boolean; contentOverride?: string }) => {
      const blockIdx = worksheetEditBlockIndex
      if (blockIdx == null || blockIdx < 0 || blockIdx >= worksheetEditBlocks.length) return
      const block = worksheetEditBlocks[blockIdx]
      const edited = opts?.contentOverride ?? worksheetEditBlockContent
      if (!edited || edited.trim().length < 3) {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: tr('Nội dung câu quá ngắn.', 'Question content is too short.', '题目内容太短。', '問題の内容が短すぎます。', '문제 내용이 너무 짧습니다.'),
          variant: 'destructive',
        })
        return
      }
      const originalContent = markdown.slice(block.startOffset, block.endOffset)
      if (originalContent === edited) {
        setWorksheetEditBlockIndex(null)
        setWorksheetEditBlockContent('')
        return
      }
      const skipAiCheck = opts?.skipAiCheck === true
      const curriculumContext = ''

      setWorksheetEditSaving(true)
      try {
        if (!skipAiCheck) {
          if (worksheetEditImages.length > 0) {
            const blockType = block?.type ?? 'quiz'
            const fdCheck = new FormData()
            fdCheck.append('content', edited)
            fdCheck.append('blockType', blockType)
            fdCheck.append('curriculum', curriculumContext)
            worksheetEditImages.forEach((f) => fdCheck.append('images', f))
            const checkRes = await fetch('/api/worksheet-edit-check', { method: 'POST', body: fdCheck })
            const checkData = await checkRes.json().catch(() => ({}))
            if (checkData.error) {
              toast({
                title: tr('Lỗi kiểm tra', 'Check failed', '检查失败', 'チェック失敗', '검사 실패'),
                description: checkData.error,
                variant: 'destructive',
              })
              return
            }
            setWorksheetEditCheckResult({ issues: checkData.issues ?? [], correctedContent: checkData.correctedContent ?? null })
            if (Array.isArray(checkData.issues) && checkData.issues.length > 0) {
              toast({
                title: tr('Chưa lưu', 'Not saved', '未保存', '未保存', '저장 안 됨'),
                description: tr(
                  'Có lỗi theo ảnh đính kèm. Vui lòng sửa rồi lưu lại.',
                  'There are issues based on attached images. Please fix and save again.',
                  '根据附图检测到问题，请修改后再保存。',
                  '添付画像ベースで問題が見つかりました。修正して再保存してください。',
                  '첨부 이미지 기준 오류가 있습니다. 수정 후 다시 저장하세요.',
                ),
                variant: 'destructive',
              })
              return
            }
          } else {
            const CONTEXT_CHARS = 250
            const contextStart = Math.max(0, block.startOffset - CONTEXT_CHARS)
            const originalRegion = markdown.slice(contextStart, block.endOffset)
            const editedRegion = markdown.slice(contextStart, block.startOffset) + edited

            const res = await fetch('/api/curriculum-edit-check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ originalRegion, editedRegion }),
            })
            const data = await res.json().catch(() => ({}))
            const rc = data.regionCompare
            const canSave = !!(data.ok && data.bothAgree && rc?.correctVersion === 'edited')
            if (!canSave) {
              let restored = toEditableBlockContent(originalContent, block.type)
              try {
                const wres = await fetch(`/api/worksheet/${encodeURIComponent(worksheetId)}`)
                const wdata = await wres.json().catch(() => ({}))
                const list = Array.isArray(wdata?.questions) ? (wdata.questions as Array<{ type?: string; content_json?: unknown }>) : []
                const sameTypeIdx = worksheetEditBlocks.slice(0, blockIdx + 1).filter((b) => b.type === block.type).length - 1
                const row = list.filter((q) => q?.type === block.type)[sameTypeIdx]
                if (row && block.type === 'essay') {
                  const heading = (restored.match(/^([^\n]*Bài\s+\d+[^\n]*)/i)?.[1] ?? '').trim()
                  const problem = latexToReadable(getEssayProblem(row.content_json) || '')
                  const solution = normalizeSolutionToStr(getEssaySolution(row.content_json)) || '(Chưa có lời giải)'
                  restored = [heading, problem, '**Lời giải:**', solution].filter(Boolean).join('\n\n')
                }
              } catch {
                /* fallback */
              }
              setWorksheetEditBlockContent(restored)
              setWorksheetEditCheckResult(null)
              toast({
                title: tr('Chưa lưu', 'Not saved', '未保存', '未保存', '저장 안 됨'),
                description:
                  (data.reasonNotSaved || rc?.explanation || tr('AI chưa đồng ý bản sửa.', 'AI did not approve this edit.', 'AI尚未同意该修改。', 'AIがこの編集を承認していません。', 'AI가 이 수정을 승인하지 않았습니다.')) +
                  ' ' +
                  tr('Đã hoàn nguyên nội dung gốc.', 'Reverted to original content.', '已恢复原内容。', '元の内容に戻しました。', '원본 내용으로 복원했습니다.'),
                variant: 'destructive',
              })
              return
            }
          }
        }

        const newMarkdown = replaceBlockInMarkdown(markdown, block, edited)
        const fd = new FormData()
        fd.append('worksheetId', worksheetId)
        fd.append('contentMarkdown', newMarkdown)
        const saveRes = await saveWorksheetContent(fd)
        if (saveRes?.error) {
          toast({
            title: tr('Lỗi lưu phiếu', 'Save worksheet failed', '保存练习失败', 'ワークシート保存失敗', '워크시트 저장 실패'),
            description: saveRes.error,
            variant: 'destructive',
          })
          return
        }
        setMarkdown(newMarkdown)
        setWorksheetEditBlockIndex(null)
        setWorksheetEditBlockContent('')
        setWorksheetEditImages([])
        setWorksheetEditCheckResult(null)
        toast({
          title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'),
          description: skipAiCheck
            ? tr('Đã áp dụng sửa và lưu.', 'Applied fixes and saved.', '已应用修改并保存。', '修正を適用して保存しました。', '수정 적용 후 저장했습니다.')
            : tr('AI đã kiểm tra và lưu câu đã sửa.', 'AI checked and saved the edited question.', 'AI已检查并保存修改的题目。', 'AIが確認して修正した問題を保存しました。', 'AI가 확인 후 수정한 문제를 저장했습니다.'),
        })
        router.refresh()
      } finally {
        setWorksheetEditSaving(false)
      }
    },
    [
      worksheetEditBlockIndex,
      worksheetEditBlockContent,
      worksheetEditBlocks,
      worksheetEditImages,
      markdown,
      worksheetId,
      toast,
      tr,
      router,
    ]
  )

  const handleCheckWorksheetBlock = useCallback(async () => {
    const content = worksheetEditBlockContent.trim()
    if (!content || content.length < 5) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr('Nội dung câu quá ngắn.', 'Content too short.', '内容太短。', '内容が短すぎます。', '내용이 너무 짧습니다.'),
        variant: 'destructive',
      })
      return
    }
    const blockIdx = worksheetEditBlockIndex
    const block = blockIdx != null ? worksheetEditBlocks[blockIdx] : null
    const blockType = block?.type ?? 'quiz'
    setWorksheetEditCheckLoading(true)
    setWorksheetEditCheckResult(null)
    try {
      let res: Response
      if (worksheetEditImages.length > 0) {
        const fd = new FormData()
        fd.append('content', content)
        fd.append('blockType', blockType)
        fd.append('curriculum', '')
        worksheetEditImages.forEach((f) => fd.append('images', f))
        res = await fetch('/api/worksheet-edit-check', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/worksheet-edit-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            blockType,
            curriculum: '',
          }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (data.error) {
        toast({
          title: tr('Lỗi kiểm tra', 'Check failed', '检查失败', 'チェック失敗', '검사 실패'),
          description: data.error,
          variant: 'destructive',
        })
        return
      }
      setWorksheetEditCheckResult({
        issues: data.issues ?? [],
        correctedContent: data.correctedContent ?? null,
      })
      if (!data.issues?.length) {
        toast({
          title: tr('Không có lỗi', 'No issues', '无问题', '問題なし', '문제 없음'),
          description: tr('Câu đã đúng, có thể lưu.', 'Question is correct, you can save.', '题目正确，可以保存。', '問題は正しいです。保存できます。', '문제가 맞습니다. 저장하세요.'),
          duration: 2000,
        })
      }
    } finally {
      setWorksheetEditCheckLoading(false)
    }
  }, [worksheetEditBlockIndex, worksheetEditBlockContent, worksheetEditBlocks, worksheetEditImages, toast, tr])

  const proseArticleClass =
    'worksheet-prose prose prose-slate max-w-none text-[15px] leading-relaxed text-foreground dark:prose-invert prose-headings:scroll-mt-24 prose-headings:text-[15px] prose-headings:font-semibold prose-headings:leading-snug prose-headings:tracking-tight prose-h1:mb-2 prose-h1:mt-5 prose-h1:border-b prose-h1:border-border/50 prose-h1:pb-1.5 prose-h1:first:mt-0 prose-h2:mb-2 prose-h2:mt-5 prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-1.5 prose-h3:mb-2 prose-h3:mt-5 prose-h3:border-b prose-h3:border-border/50 prose-h3:pb-1.5 prose-p:my-2 prose-p:text-[15px] prose-p:leading-relaxed prose-strong:font-semibold prose-strong:text-foreground'

  if (worksheetEditBlocks.length === 0) {
    return (
      <>
        <article className={proseArticleClass} dangerouslySetInnerHTML={{ __html: worksheetMarkdownToHtml(markdown, questionBadge) }} />
        <Toaster />
      </>
    )
  }

  return (
    <>
      <article className={proseArticleClass}>
        <div className="space-y-0">
          {parts.map((p) =>
            p.kind === 'gap' ? (
              <div key={p.key} dangerouslySetInnerHTML={{ __html: worksheetMarkdownToHtml(p.text, questionBadge) }} />
            ) : (
              <div key={p.key} className="space-y-0">
                <div dangerouslySetInnerHTML={{ __html: worksheetMarkdownToHtml(p.block.content, questionBadge) }} />
                <div className="flex justify-end pb-4 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-amber-400/70 text-amber-800 hover:bg-amber-50 dark:border-amber-600/60 dark:text-amber-200 dark:hover:bg-amber-950/40"
                    onClick={() => void openBlockEditor(p.globalIdx)}
                  >
                    {tr('Sửa', 'Edit', '编辑', '編集', '수정')}
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
      </article>

      {worksheetEditFilter && (
        <WorksheetEditSectionPopup
          open={true}
          onClose={resetEditState}
          filter={worksheetEditFilter}
          blocks={worksheetEditBlocks}
          blockIndex={worksheetEditBlockIndex}
          blockContent={worksheetEditBlockContent}
          onBlockContentChange={setWorksheetEditBlockContent}
          onSelectBlock={(idx) => void openBlockEditor(idx)}
          /* Trang phiếu mở thẳng editor từ nút Sửa dưới câu — Quay lại phải đóng popup, không về danh sách TN/TL */
          onCancelEdit={resetEditState}
          checkResult={worksheetEditCheckResult}
          onApplyFix={() => {
            const corrected = worksheetEditCheckResult?.correctedContent
            if (corrected) {
              setWorksheetEditBlockContent(corrected)
              setWorksheetEditCheckResult(null)
              void handleSaveWorksheetBlockEdit({ skipAiCheck: true, contentOverride: corrected })
            }
          }}
          onCheck={() => void handleCheckWorksheetBlock()}
          onSave={() => void handleSaveWorksheetBlockEdit()}
          editImages={worksheetEditImages}
          onPickImages={(files) => {
            const list = Array.from(files ?? []).filter((f) => f && f.size > 0)
            if (list.length === 0) return
            setWorksheetEditImages((prev) => [...prev, ...list].slice(0, 6))
          }}
          onRemoveImage={(idx) => setWorksheetEditImages((prev) => prev.filter((_, i) => i !== idx))}
          onClearImages={() => setWorksheetEditImages([])}
          checkLoading={worksheetEditCheckLoading}
          saving={worksheetEditSaving}
          checkCreditSuffix={worksheetEditCheckCreditSuffix}
          saveCreditSuffix={worksheetEditSaveCreditSuffix}
          saveDisabled={
            worksheetEditBlockContent.trim() ===
            (worksheetEditBlockIndex != null && worksheetEditBlocks[worksheetEditBlockIndex]
              ? toEditableBlockContent(
                  worksheetEditBlocks[worksheetEditBlockIndex].content,
                  worksheetEditBlocks[worksheetEditBlockIndex].type === 'essay' ? 'essay' : 'quiz',
                )
              : ''
            ).trim()
          }
          tr={tr}
        />
      )}
      <Toaster />
    </>
  )
}
