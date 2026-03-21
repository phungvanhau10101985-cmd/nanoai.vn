'use client'

import { useMemo } from 'react'
import { PenLine } from 'lucide-react'
import {
  ContentEmbed,
  parseQuizData,
  type EmbedType,
} from './content-embed'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreVertical, Trash2, Flag, Edit3, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  worksheetAnswerParts,
  worksheetAnswerSegmentCount,
  sliceWorksheetAnswerPartsToSegments,
  sliceWorksheetAnswerPartsAfterSegments,
  type WorksheetAnswerPart,
} from '@/app/tao-giao-trinh/lib/worksheet-answer-segments'

export type WorksheetAnswerTypedBodyProps = {
  content: string
  /** Khi false: toàn bộ một màu (đã hiện hết cho HS) */
  typingEnabled: boolean
  /** true → không tăng segment (đáp án ẩn trên màn HS) */
  typingPaused: boolean
  /** Segment đã đồng bộ sang học sinh (giáo viên tô màu đến đây) */
  revealedSegments: number
  /**
   * Slide nhiều block: chỉ block đang tới lượt gõ mới hiện bút khi `revealedSegments === 0`.
   * `undefined` = giữ hành vi cũ (coi như true).
   */
  isSequentialTypingLeader?: boolean
  /**
   * Đang chỉnh “tiến độ gõ”: tô xanh / xám theo giá trị kéo (preview), kể cả khi tắt chế độ gõ.
   */
  revealPreviewSegments?: number
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  worksheetId: boolean
  curriculumId: string | null
  slideIndex: number
  blockIndex: number
  slideTitle: string
  slideContentForReport: string
  showDirectEdit: boolean
  showProposalUi: boolean
  quizReportLoading: boolean
  onRemoveEmbed: (slideIndex: number, blockIndex: number, rawMarker: string) => void
  onEditBlock: () => void
  onProposeEdit: () => void
  onProposeAdd: () => void
  /** Phiếu bài tập trên slide GV: thay Đề xuất sửa/bổ sung bằng một nút Sửa (popup giống trang phiếu). */
  showWorksheetMarkdownEdit?: boolean
  onEditWorksheetMarkdown?: () => void
  reportQuizWrong: (args: {
    curriculumId: string
    slideIndex: number
    blockIndex: number
    quizMarker: string
    slideTitle: string
    slideContent: string
  }) => void
  worksheetBlocksProposalDisabled: boolean
}

function renderPartNodes(
  partList: WorksheetAnswerPart[],
  keyPrefix: string,
  opts: {
    tr: WorksheetAnswerTypedBodyProps['tr']
    worksheetId: boolean
    curriculumId: string | null
    slideIndex: number
    blockIndex: number
    showDirectEdit: boolean
    showProposalUi: boolean
    onRemoveEmbed: WorksheetAnswerTypedBodyProps['onRemoveEmbed']
    textClassName?: string
  }
) {
  return partList.map((p, j) => {
    const key = `${keyPrefix}-${j}`
    if (p.type === 'text')
      return p.value ? (
        <span key={key} className={opts.textClassName}>
          {p.value}
        </span>
      ) : null
    if (p.type === 'embed' && p.embedType === 'quiz') {
      const q = parseQuizData(p.urlOrId)
      if (!q) return null
      const hideAns = !!opts.worksheetId
      return (
        <div key={key} className="rounded-lg bg-violet-500/15 border border-violet-400/30 p-2.5">
          <div className="text-violet-200 font-medium text-xs mb-1.5">
            {opts.tr('Câu hỏi trắc nghiệm', 'Quiz question', '测验题', 'クイズ', '퀴즈')}
          </div>
          <p className={cn('text-sm mb-2', opts.textClassName ?? 'text-slate-200/95')}>{q.question}</p>
          <div className="space-y-1">
            {q.options.map((opt, k) => (
              <div
                key={k}
                className={[
                  'text-sm md:text-base pl-2 border-l-2',
                  !hideAns && k === q.correctIndex ? 'border-emerald-400 text-emerald-300' : 'border-slate-600 text-slate-300',
                ].join(' ')}
              >
                {String.fromCharCode(65 + k)}.{' '}
                {hideAns ? String(opt).replace(/\s*\(Đáp án đúng\)\s*/gi, '').trim() || opt : opt}
                {!hideAns && k === q.correctIndex && (
                  <span className="ml-1.5 text-emerald-400/80 text-[10px]">
                    ({opts.tr('Đáp án đúng', 'Correct', '正确', '正解', '정답')})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (p.type === 'embed') {
      const ep = p as { type: 'embed'; embedType: EmbedType; urlOrId: string; rawMarker: string }
      return (
        <div key={key} className="rounded-lg overflow-hidden border border-slate-600/60 relative group">
          <ContentEmbed type={ep.embedType} urlOrId={ep.urlOrId} width={280} height={160} tr={opts.tr} />
          {opts.curriculumId && (opts.showDirectEdit || opts.showProposalUi) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-slate-800/95 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/60 z-[100] shadow-lg"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="z-[120]">
                <DropdownMenuItem
                  onSelect={() => opts.onRemoveEmbed(opts.slideIndex, opts.blockIndex, ep.rawMarker)}
                  className="text-rose-600 focus:text-rose-600 dark:text-rose-400 cursor-pointer gap-3"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  {opts.tr('Xóa', 'Delete', '删除', '削除', '삭제')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )
    }
    return null
  })
}

/**
 * Giáo viên: luôn thấy hết lời giải; phần đã “gõ” cho HS — màu nhấn; phần còn lại — mờ hơn.
 */
export function WorksheetAnswerTypedBody({
  content,
  typingEnabled,
  typingPaused,
  revealedSegments,
  isSequentialTypingLeader,
  revealPreviewSegments,
  tr,
  worksheetId,
  curriculumId,
  slideIndex,
  blockIndex,
  slideTitle,
  slideContentForReport,
  showDirectEdit,
  showProposalUi,
  quizReportLoading,
  onRemoveEmbed,
  onEditBlock,
  onProposeEdit,
  onProposeAdd,
  showWorksheetMarkdownEdit,
  onEditWorksheetMarkdown,
  reportQuizWrong,
  worksheetBlocksProposalDisabled,
}: WorksheetAnswerTypedBodyProps) {
  const parts = useMemo(() => worksheetAnswerParts(content ?? ''), [content])
  const total = useMemo(() => worksheetAnswerSegmentCount(content ?? ''), [content])
  const isRevealPreview =
    typeof revealPreviewSegments === 'number' && Number.isFinite(revealPreviewSegments)
  const revealN = isRevealPreview
    ? Math.min(Math.max(0, revealPreviewSegments), total)
    : typingEnabled
      ? Math.min(Math.max(0, revealedSegments), total)
      : total

  const revealedPartList = useMemo(() => sliceWorksheetAnswerPartsToSegments(parts, revealN), [parts, revealN])
  const restPartList = useMemo(() => sliceWorksheetAnswerPartsAfterSegments(parts, revealN), [parts, revealN])

  const showSplit = isRevealPreview || typingEnabled
  const leaderOk = isSequentialTypingLeader !== false
  const showCursor =
    typingEnabled &&
    !isRevealPreview &&
    !typingPaused &&
    total > 0 &&
    revealN < total &&
    (revealN > 0 || leaderOk)

  const renderOpts = {
    tr,
    worksheetId,
    curriculumId,
    slideIndex,
    blockIndex,
    showDirectEdit,
    showProposalUi,
    onRemoveEmbed,
  }

  return (
    <>
      <div className="text-base md:text-lg whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_p]:my-2">
        {!showSplit ? (
          <div className="text-slate-200/95">{renderPartNodes(parts, 'all', { ...renderOpts })}</div>
        ) : (
          <>
            <span className="text-emerald-300/95">{renderPartNodes(revealedPartList, 'rev', { ...renderOpts, textClassName: 'text-emerald-300/95' })}</span>
            <span className="text-slate-500/80">{renderPartNodes(restPartList, 'rest', { ...renderOpts, textClassName: 'text-slate-500/80' })}</span>
            {showCursor ? (
              <span className="inline-flex align-baseline ml-0.5 animate-pulse" aria-hidden>
                <PenLine className="h-4 w-4 text-amber-400/90" strokeWidth={2.5} />
              </span>
            ) : null}
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(curriculumId || worksheetId) &&
          parts.some((x) => x.type === 'embed' && x.embedType === 'quiz') &&
          parts
            .filter((x): x is { type: 'embed'; embedType: 'quiz'; urlOrId: string; rawMarker: string } => x.type === 'embed' && x.embedType === 'quiz')
            .map((p, qIdx) => (
              <button
                key={qIdx}
                type="button"
                disabled={!!quizReportLoading || !!worksheetId}
                title={
                  worksheetId
                    ? tr('Chỉ cho giáo trình đã lưu', 'Only for saved curriculum', '仅限已保存课程', '保存済みカリキュラムのみ', '저장된 교육과정만')
                    : undefined
                }
                onClick={() =>
                  curriculumId &&
                  reportQuizWrong({
                    curriculumId,
                    slideIndex,
                    blockIndex,
                    quizMarker: p.rawMarker,
                    slideTitle,
                    slideContent: slideContentForReport,
                  })
                }
                className={cn(
                  'text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 transition-colors',
                  curriculumId
                    ? 'text-rose-300 hover:text-rose-200 bg-rose-500/20 border border-rose-400/30 disabled:opacity-50'
                    : 'text-rose-400/60 bg-rose-500/10 border border-rose-400/20 cursor-not-allowed opacity-60'
                )}
              >
                <Flag className="h-3.5 w-3.5" />
                {tr('Báo câu hỏi sai', 'Report wrong question', '报告题目错误', '問題が間違っていると報告', '문제 오류 신고')}
              </button>
            ))}
        {showDirectEdit && (
          <button
            type="button"
            onClick={onEditBlock}
            className="text-xs font-medium text-violet-300 hover:text-violet-200 px-2 py-1 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center gap-1 transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" />
            {tr('Sửa', 'Edit', '编辑', '編集', '편집')}
          </button>
        )}
        {showProposalUi && showWorksheetMarkdownEdit && onEditWorksheetMarkdown && (
          <button
            type="button"
            onClick={onEditWorksheetMarkdown}
            className="text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 text-amber-300 hover:text-amber-200 bg-amber-500/20 border border-amber-400/30 transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" />
            {tr('Sửa', 'Edit', '编辑', '編集', '편집')}
          </button>
        )}
        {showProposalUi && !showWorksheetMarkdownEdit && (
          <>
            <button
              type="button"
              disabled={worksheetBlocksProposalDisabled}
              title={
                worksheetBlocksProposalDisabled
                  ? tr('Chỉ cho giáo trình đã lưu', 'Only for saved curriculum', '仅限已保存课程', '保存済みカリキュラムのみ', '저장된 교육과정만')
                  : undefined
              }
              onClick={() => !worksheetBlocksProposalDisabled && onProposeEdit()}
              className={cn(
                'text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1',
                curriculumId
                  ? 'text-amber-300 hover:text-amber-200 bg-amber-500/20 border border-amber-400/30'
                  : 'text-amber-400/60 bg-amber-500/10 border border-amber-400/20 cursor-not-allowed opacity-60'
              )}
            >
              <Edit3 className="h-3.5 w-3.5" />
              {tr('Đề xuất sửa', 'Propose edit', '建议编辑', '編集提案', '편집 제안')}
            </button>
            <button
              type="button"
              disabled={worksheetBlocksProposalDisabled}
              title={
                worksheetBlocksProposalDisabled
                  ? tr('Chỉ cho giáo trình đã lưu', 'Only for saved curriculum', '仅限已保存课程', '保存済みカリキュラムのみ', '저장된 교육과정만')
                  : undefined
              }
              onClick={() => !worksheetBlocksProposalDisabled && onProposeAdd()}
              className={cn(
                'text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1',
                curriculumId
                  ? 'text-emerald-300 hover:text-emerald-200 bg-emerald-500/20 border border-emerald-400/30'
                  : 'text-emerald-400/60 bg-emerald-500/10 border border-emerald-400/20 cursor-not-allowed opacity-60'
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              {tr('Đề xuất bổ sung', 'Propose addition', '建议补充', '追加提案', '추가 제안')}
            </button>
          </>
        )}
      </div>
    </>
  )
}
