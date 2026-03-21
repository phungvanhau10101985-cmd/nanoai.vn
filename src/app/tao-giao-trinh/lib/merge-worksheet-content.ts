/**
 * Merge lời giải từ worksheet_questions vào content_markdown khi thiếu.
 * Dùng cho popup sửa tự luận – hiển thị đủ lời giải.
 * Khớp essay block với essay question theo thứ tự trong từng loại.
 */
import { questionsToMarkdown } from './questions-to-markdown'
import { parseWorksheetIntoBlocks } from './worksheet-parse-questions'
import { replaceBlockInMarkdown } from './worksheet-parse-questions'
import { blockToContentJson } from './markdown-to-questions'
import { getEssaySolution, normalizeSolutionToStr } from './worksheet-content-json'

/** Merge trên client khi đã có questions – dùng khi API trả về questions.
 * Khớp essay block với essay question theo thứ tự trong từng loại (không phụ thuộc thứ tự quiz/essay chung). */
export function mergeContentWithQuestions(
  contentMarkdown: string,
  questions: Array<{ type: string; content_json: unknown }>
): string {
  if (!questions.length) return contentMarkdown
  const blocks = parseWorksheetIntoBlocks(contentMarkdown)
  const essayBlocks = blocks.filter((b) => b.type === 'essay')
  const essayQuestions = questions.filter((q) => q.type === 'essay')
  if (!essayBlocks.length || !essayQuestions.length) return contentMarkdown

  const toReplace: Array<{ block: (typeof blocks)[0]; newContent: string }> = []
  for (let i = 0; i < essayBlocks.length && i < essayQuestions.length; i++) {
    const block = essayBlocks[i]!
    const q = essayQuestions[i]!
    const parsed = blockToContentJson(block) as { problem?: string; solution?: string } | null
    const solutionRaw = (parsed?.solution ?? '').trim()
    const solutionNormalized = normalizeSolutionToStr(parsed?.solution) || ''
    const isEmpty = !solutionRaw || solutionRaw === '(Chưa có lời giải)'
    const fromQ = normalizeSolutionToStr(getEssaySolution(q.content_json)) || ''
    const finalSolution = isEmpty ? fromQ : solutionNormalized
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

/** Merge lời giải từ worksheet_questions – khớp essay block với essay question theo thứ tự trong từng loại. */
export async function mergeWorksheetContentIfNeeded(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  contentMarkdown: string,
  questionIds: string[]
): Promise<string> {
  if (!questionIds.length) return contentMarkdown
  const { data: qRows } = await supabase
    .from('worksheet_questions')
    .select('id, type, content_json')
    .in('id', questionIds)
  const ordered = questionIds.map((id) => qRows?.find((r) => r.id === id)).filter(Boolean) as Array<{
    id: string
    type: string
    content_json: unknown
  }>
  if (!ordered.length) return contentMarkdown

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

/** Đồng bộ **[Chưa verify]** / **[Đã verify]** trên dòng đầu mỗi block theo `verified_at` trong DB (không đụng phần còn lại của markdown). */
export function syncVerifyTagsInWorksheetMarkdown(
  markdown: string,
  orderedQuestions: Array<{ type: string; verified_at?: string | null }>
): string {
  if (!markdown.trim() || !orderedQuestions.length) return markdown
  const blocks = parseWorksheetIntoBlocks(markdown)
  if (!blocks.length) return markdown
  const quizRows = orderedQuestions.filter((q) => q.type === 'quiz')
  const essayRows = orderedQuestions.filter((q) => q.type === 'essay')
  let qi = 0
  let ei = 0
  const toReplace: Array<{ block: (typeof blocks)[0]; newContent: string }> = []
  for (const block of blocks) {
    const row = block.type === 'quiz' ? quizRows[qi++] : essayRows[ei++]
    if (!row) continue
    const verified = Boolean(row.verified_at)
    const lines = block.content.split('\n')
    if (!lines.length) continue
    const first = lines[0]!
    if (!/\*\*\[(?:Chưa verify|Đã verify)\]\*\*/.test(first)) continue
    const tag = verified ? '**[Đã verify]**' : '**[Chưa verify]**'
    lines[0] = first.replace(/\*\*\[(?:Chưa verify|Đã verify)\]\*\*/g, tag)
    const newContent = lines.join('\n')
    if (newContent !== block.content) toReplace.push({ block, newContent })
  }
  let merged = markdown
  for (let i = toReplace.length - 1; i >= 0; i--) {
    const { block, newContent } = toReplace[i]!
    merged = replaceBlockInMarkdown(merged, block, newContent)
  }
  return merged
}

/** Markdown hiển thị: tag verify đúng theo DB + merge lời giải essay nếu thiếu. */
export async function enrichWorksheetMarkdownForDisplay(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  contentMarkdown: string,
  questionIds: string[] | null | undefined
): Promise<string> {
  const ids = (questionIds ?? []).filter(Boolean)
  if (!ids.length) return contentMarkdown ?? ''
  let md = contentMarkdown ?? ''
  if (md.trim()) {
    const { data: qRows } = await supabase
      .from('worksheet_questions')
      .select('id, type, verified_at')
      .in('id', ids)
    const ordered = ids
      .map((id) => qRows?.find((r) => r.id === id))
      .filter(Boolean) as Array<{ id: string; type: string; verified_at?: string | null }>
    if (ordered.length) md = syncVerifyTagsInWorksheetMarkdown(md, ordered)
  }
  return mergeWorksheetContentIfNeeded(supabase, md, ids)
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
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  contentMarkdownFallback: string,
  questionIds: string[] | null | undefined
): Promise<string> {
  const ids = (questionIds ?? []).filter(Boolean)
  if (!ids.length) return contentMarkdownFallback ?? ''

  const { data: qRows, error } = await supabase
    .from('worksheet_questions')
    .select('id, type, content_json, difficulty, source, verified_at')
    .in('id', ids)

  if (error || !qRows?.length) return contentMarkdownFallback ?? ''

  const ordered = ids
    .map((id) => qRows.find((r) => r.id === id))
    .filter(Boolean) as QuestionRowForDisplay[]

  if (!ordered.length) return contentMarkdownFallback ?? ''

  return questionsToMarkdown(ordered)
}
