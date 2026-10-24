'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { worksheetMarkdownToHtml } from './worksheet-view'
import { parseWorksheetIntoBlocks, replaceBlockInMarkdown, type WorksheetQuestionBlock } from '@/app/tao-giao-trinh/lib/worksheet-parse-questions'
import { saveWorksheetContent } from '@/app/tao-giao-trinh/actions'
import {
  useWorksheetQuestionProposals,
  WorksheetQuestionCompare,
} from '@/app/tao-giao-trinh/components/worksheet-question-proposals'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { toEditableBlockContent } from '@/app/tao-giao-trinh/lib/worksheet-editable-block-content'
import { coalesceEssayParts, getEssayProblem, getEssaySolution, normalizeSolutionToStr } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import {
  WorksheetEditSectionPopup,
  type WorksheetEditTr,
} from '@/app/tao-giao-trinh/components/worksheet-edit-section-popup'
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
  questionIds = [],
  questionBadge,
  locale,
}: {
  worksheetId: string
  initialMarkdown: string
  questionIds?: string[]
  questionBadge: string
  locale: WebLocale
}) {
  const tr = useMemo(() => worksheetTrFromLocale(locale), [locale])
  const { toast } = useToast()
  const router = useRouter()
  const [markdown, setMarkdown] = useState(initialMarkdown)
  useEffect(() => {
    setMarkdown(initialMarkdown)
  }, [initialMarkdown])
  const [worksheetEditFilter, setWorksheetEditFilter] = useState<'quiz' | 'essay' | null>(null)
  const [worksheetEditBlockIndex, setWorksheetEditBlockIndex] = useState<number | null>(null)
  const [worksheetEditBlockContent, setWorksheetEditBlockContent] = useState('')
  const [worksheetEditSaving, setWorksheetEditSaving] = useState(false)

  const worksheetEditBlocks = useMemo(() => parseWorksheetIntoBlocks(markdown), [markdown])
  const parts = useMemo(() => buildParts(markdown, worksheetEditBlocks), [markdown, worksheetEditBlocks])
  const { items: proposals, vote, busyId } = useWorksheetQuestionProposals(worksheetId, () => router.refresh())
  const proposalById = useMemo(() => new Map(proposals.map((item) => [item.questionId, item])), [proposals])

  const resetEditState = useCallback(() => {
    setWorksheetEditFilter(null)
    setWorksheetEditBlockIndex(null)
    setWorksheetEditBlockContent('')
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
          const parts = coalesceEssayParts(
            latexToReadable(getEssayProblem(row.content_json) || ''),
            normalizeSolutionToStr(getEssaySolution(row.content_json))
          )
          nextContent = [heading, parts.problem, '**Lời giải:**', parts.solution || '(Chưa có lời giải)'].filter(Boolean).join('\n\n')
        }
      } catch {
        /* fallback markdown hiện tại */
      }
      setWorksheetEditBlockContent(nextContent)
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
    async () => {
      const blockIdx = worksheetEditBlockIndex
      if (blockIdx == null || blockIdx < 0 || blockIdx >= worksheetEditBlocks.length) return
      const block = worksheetEditBlocks[blockIdx]
      const edited = worksheetEditBlockContent
      if (!edited || edited.trim().length < 3) {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: tr('Nội dung câu quá ngắn.', 'Question content is too short.', '题目内容太短。', '問題の内容が短すぎます。', '문제 내용이 너무 짧습니다.'),
          variant: 'destructive',
        })
        return
      }
      if (markdown.slice(block.startOffset, block.endOffset) === edited) {
        setWorksheetEditBlockIndex(null)
        setWorksheetEditBlockContent('')
        return
      }

      setWorksheetEditSaving(true)
      try {
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
        toast({
          title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'),
          description: saveRes.personal
            ? tr(
                'Đã lưu bản sửa của bạn. Bạn dùng ngay bản này. Người sau xem cả bản gốc và bản sửa. 7 lần đúng liên tiếp thì thay bản gốc bằng bản sửa. 7 lần sai liên tiếp thì giữ bản gốc và bỏ bản sửa.',
                'Saved your edit. You use it now. Later people can read both versions. 7 correct votes in a row replace the original with the edit. 7 wrong votes in a row keep the original and drop the edit.',
                '已保存你的修改。你现在就用这一版。后面的人可以看原版和修改版。连续 7 次判对则用修改版替换原版。连续 7 次判错则保留原版并丢掉修改。',
                '修正版を保存しました。今すぐこの版を使います。後の人は元の版と修正版を読めます。正しい票が7回続くと修正版が原本になります。誤りの票が7回続くと原本を残し修正版を捨てます。',
                '수정본을 저장했습니다. 지금 이 버전을 씁니다. 다음 사람은 원본과 수정본을 함께 봅니다. 맞음이 7번 연속이면 수정본이 원본이 됩니다. 틀림이 7번 연속이면 원본을 유지하고 수정본을 버립니다.'
              )
            : tr('Đã lưu câu mới vào phiếu chung.', 'Saved the new question to the shared sheet.', '新题目已保存到共用练习。', '新しい問題を共有シートに保存しました。', '새 문제를 공유 시트에 저장했습니다.'),
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
      markdown,
      worksheetId,
      toast,
      tr,
      router,
    ]
  )

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
          {parts.map((p) => {
            if (p.kind === 'gap') {
              return <div key={p.key} dangerouslySetInnerHTML={{ __html: worksheetMarkdownToHtml(p.text, questionBadge) }} />
            }
            const proposal = proposalById.get(questionIds[p.globalIdx] ?? '')
            return (
              <div key={p.key} className="space-y-0">
                {proposal ? (
                  <WorksheetQuestionCompare
                    item={proposal}
                    locale={locale}
                    busy={busyId === proposal.questionId}
                    onVote={(choice) => void vote(proposal.questionId, choice)}
                  />
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: worksheetMarkdownToHtml(p.block.content, questionBadge) }} />
                )}
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
            )
          })}
        </div>
      </article>

      {worksheetEditFilter && (
        <WorksheetEditSectionPopup
          open={true}
          onClose={resetEditState}
          worksheetId={worksheetId}
          filter={worksheetEditFilter}
          blocks={worksheetEditBlocks}
          blockIndex={worksheetEditBlockIndex}
          blockContent={worksheetEditBlockContent}
          onBlockContentChange={setWorksheetEditBlockContent}
          onSelectBlock={(idx) => void openBlockEditor(idx)}
          /* Trang phiếu mở thẳng editor từ nút Sửa dưới câu — Quay lại phải đóng popup, không về danh sách TN/TL */
          onCancelEdit={resetEditState}
          onSave={() => void handleSaveWorksheetBlockEdit()}
          saving={worksheetEditSaving}
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
