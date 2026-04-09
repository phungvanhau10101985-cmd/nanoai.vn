/**
 * Merge / hiển thị markdown phiếu — **server-only** (import `pg` qua worksheet-pg).
 * Logic thuần client nằm ở `merge-worksheet-content-pure.ts`.
 */
import {
  fetchWorksheetQuestionsMarkdownRowsOrderedFromPg,
  fetchWorksheetQuestionsTypeContentOrderedFromPg,
} from '@/lib/db/worksheet-pg'
import { questionsToMarkdown } from './questions-to-markdown'
import { parseWorksheetIntoBlocks, replaceBlockInMarkdown } from './worksheet-parse-questions'
import { blockToContentJson } from './markdown-to-questions'
import { getEssaySolution, normalizeSolutionToStr } from './worksheet-content-json'
import { syncVerifyTagsInWorksheetMarkdown } from './merge-worksheet-content-pure'

/** Merge lời giải từ worksheet_questions – khớp essay block với essay question theo thứ tự trong từng loại. */
export async function mergeWorksheetContentIfNeeded(
  contentMarkdown: string,
  questionIds: string[]
): Promise<string> {
  if (!questionIds.length) return contentMarkdown
  const ordered = await fetchWorksheetQuestionsTypeContentOrderedFromPg(questionIds)
  if (!ordered?.length) return contentMarkdown

  const blocks = parseWorksheetIntoBlocks(contentMarkdown)
  const essayBlocks = blocks.filter((b) => b.type === 'essay')
  const essayOrdered = ordered.filter((q) => q.type === 'essay')
  if (!essayBlocks.length || !essayOrdered.length) return contentMarkdown

  const toReplace: Array<{ block: (typeof blocks)[0]; newContent: string }> = []
  for (let i = 0; i < essayBlocks.length && i < essayOrdered.length; i++) {
    const block = essayBlocks[i]!
    const qRow = essayOrdered[i]!
    const parsed = blockToContentJson(block) as { problem?: string; solution?: string } | null
    const solutionRaw = (parsed?.solution ?? '').trim()
    const solutionNormalized = normalizeSolutionToStr(parsed?.solution) || ''
    const isEmpty = !solutionRaw || solutionRaw === '(Chưa có lời giải)'
    const fromDb = normalizeSolutionToStr(getEssaySolution(qRow.content_json)) || ''
    const finalSolution = isEmpty ? fromDb : solutionNormalized
    if (finalSolution && finalSolution !== solutionRaw) {
      const markerMatch =
        block.content.match(/([\s\S]*?\*\*Lời giải\*\*:\s*)/i) || block.content.match(/([\s\S]*?\*\*Đáp án\*\*:\s*)/i)
      const beforeMarker = markerMatch ? markerMatch[1] : block.content + '\n\n**Lời giải:**\n\n'
      const newContent = beforeMarker.endsWith('\n') ? beforeMarker + finalSolution : beforeMarker + '\n\n' + finalSolution
      toReplace.push({ block, newContent })
    }
  }
  let merged = contentMarkdown
  for (let i = toReplace.length - 1; i >= 0; i--) {
    const { block, newContent } = toReplace[i]!
    merged = replaceBlockInMarkdown(merged, block, newContent)
  }
  return merged
}

/** Markdown hiển thị: tag verify đúng theo DB + merge lời giải essay nếu thiếu. */
export async function enrichWorksheetMarkdownForDisplay(
  contentMarkdown: string,
  questionIds: string[] | null | undefined
): Promise<string> {
  const ids = (questionIds ?? []).filter(Boolean)
  if (!ids.length) return contentMarkdown ?? ''
  let md = contentMarkdown ?? ''
  if (md.trim()) {
    const orderedRows = await fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(ids)
    if (orderedRows?.length) {
      const ordered = orderedRows.map((r) => ({ type: r.type, verified_at: r.verified_at }))
      md = syncVerifyTagsInWorksheetMarkdown(md, ordered)
    }
  }
  return mergeWorksheetContentIfNeeded(md, ids)
}

type QuestionRowForDisplay = {
  id: string
  type: string
  content_json: unknown
  difficulty?: string
  source?: string
  verified_at?: string | null
}

/**
 * Hiển thị phiếu (QR / công khai / API): build markdown **chỉ từ worksheet_questions** theo `question_ids`.
 * Tránh trùng lời giải do `mergeWorksheetContentIfNeeded` gắn thêm vào `content_markdown` đã có **Lời giải**.
 */
export async function worksheetDisplayMarkdownFromDb(
  contentMarkdownFallback: string,
  questionIds: string[] | null | undefined
): Promise<string> {
  const ids = (questionIds ?? []).filter(Boolean)
  if (!ids.length) return contentMarkdownFallback ?? ''

  const qRows = await fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(ids)
  if (!qRows?.length) return contentMarkdownFallback ?? ''

  const ordered = qRows.map(
    (r) =>
      ({
        id: r.id,
        type: r.type,
        content_json: r.content_json,
        difficulty: r.difficulty ?? undefined,
        source: r.source ?? undefined,
        verified_at: r.verified_at,
      }) satisfies QuestionRowForDisplay
  )

  if (!ordered.length) return contentMarkdownFallback ?? ''

  return questionsToMarkdown(ordered)
}
