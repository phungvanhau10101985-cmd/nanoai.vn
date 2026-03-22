import { latexToReadable } from './latex-to-readable'
import { blockToContentJson } from './markdown-to-questions'
import { normalizeSolutionToStr } from './worksheet-content-json'

export function normalizeEssayEditorContent(text: string): string {
  const parsed = blockToContentJson({
    index: 1,
    type: 'essay',
    content: text,
    startOffset: 0,
    endOffset: text.length,
  }) as { problem?: string; solution?: string } | null
  if (parsed?.problem || parsed?.solution) {
    const headingMatch = text.match(/^([^\n]*Bài\s+\d+[^\n]*)\n?/i)
    const heading = headingMatch?.[1]?.trim() || ''
    const problem = latexToReadable(String(parsed.problem ?? '').trim())
    const solution = normalizeSolutionToStr(parsed.solution ?? '')
    const parts = [heading, problem, '**Lời giải:**', solution || '(Chưa có lời giải)'].filter(Boolean)
    return parts.join('\n\n')
  }

  const readable = latexToReadable(text)
  const markerRegex = /\*\*Lời giải\*\*:\s*|\*\*Đáp án\*\*:\s*/i
  const m = readable.match(markerRegex)
  if (!m || m.index == null) return readable
  const markerStart = m.index
  const markerEnd = markerStart + m[0].length
  const before = readable.slice(0, markerStart).trim()
  const afterRaw = readable.slice(markerEnd).trim()

  const nestedMarker = afterRaw.search(/(?:^|\n)\s*\*\*Lời giải\*\*:\s*/i)
  const afterNoNested = nestedMarker >= 0 ? afterRaw.slice(0, nestedMarker).trim() : afterRaw

  let after = afterNoNested
  const probe = after.slice(0, 220).trim()
  if (probe.length >= 90) {
    const dupAt = after.indexOf(probe, Math.max(220, Math.floor(probe.length * 0.8)))
    if (dupAt > 220) after = after.slice(0, dupAt).trim()
  }

  const normalized = normalizeSolutionToStr(after)
  if (!normalized) return readable
  const headingMatch = before.match(/^([^\n]*Bài\s+\d+[^\n]*)\n?/i)
  const heading = headingMatch?.[1]?.trim() || ''
  const problem = heading ? before.slice((headingMatch?.[0] ?? '').length).trim() : before
  const parts = [heading, problem, '**Lời giải:**', normalized].filter(Boolean)
  return parts.join('\n\n')
}

export function toEditableBlockContent(content: string, type: 'quiz' | 'essay'): string {
  const readable = latexToReadable(content)
  if (type !== 'essay') return readable
  return normalizeEssayEditorContent(readable)
}
