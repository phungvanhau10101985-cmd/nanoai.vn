import { asJsonObject, parseLooseJson } from '@/lib/ai/loose-model-json'

const MERMAID_MAX = 2000

/** Tóm tắt Flash cho ảnh bài học. Mermaid chỉ là gợi ý bố cục, cắt bớt nếu quá dài. */
export function parseFlashJson(text: string): { summary: string; mermaid: string } {
  const body = asJsonObject(parseLooseJson(text))
  if (!body) throw new Error('invalid json')
  const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
  let mermaid = typeof body.mermaid === 'string' ? body.mermaid.trim() : ''
  if (!summary || !mermaid) throw new Error('Thiếu summary hoặc mermaid trong phản hồi AI.')
  if (mermaid.length > MERMAID_MAX) {
    const cut = mermaid.lastIndexOf('\n', MERMAID_MAX)
    mermaid = mermaid.slice(0, cut > 1500 ? cut : MERMAID_MAX).trim()
  }
  if (!mermaid) throw new Error('Thiếu summary hoặc mermaid trong phản hồi AI.')
  return { summary, mermaid }
}
