/**
 * Parse quiz urlOrId – dùng chung cho API (server) và client.
 * Tránh import từ content-embed (use client) trong API route.
 */

const QUIZ_DELIM = '\x1f'

/** Parse quiz urlOrId – trả về dữ liệu nếu hợp lệ, null nếu lỗi. Hỗ trợ 2 format:
 * - Mới: question\x1fopt1\x1fopt2\x1fopt3\x1fopt4\x1fcorrectIndex
 * - Cũ: question|opt1|opt2|opt3|opt4|correctIndex
 */
export function parseQuizData(urlOrId: string): { question: string; options: string[]; correctIndex: number } | null {
  try {
    if (urlOrId.includes(QUIZ_DELIM)) {
      const parts = urlOrId.split(QUIZ_DELIM)
      if (parts.length === 6) {
        const question = String(parts[0] ?? '').trim()
        const options = parts.slice(1, 5).map((p) => String(p ?? '').trim()).filter(Boolean)
        const correctIdx = parseInt(parts[5], 10) || 0
        if (question && options.length >= 2) {
          return { question, options, correctIndex: Math.min(correctIdx, options.length - 1) }
        }
      }
    }
    const parts = urlOrId.split('|')
    if (parts.length >= 6) {
      const correctIdx = parseInt(parts[parts.length - 1], 10) || 0
      const options = parts.slice(parts.length - 5, parts.length - 1).map((p) => String(p ?? '').trim()).filter(Boolean)
      const question = parts.slice(0, parts.length - 5).join('|').trim() || ''
      if (question && options.length >= 2) {
        return { question, options, correctIndex: Math.min(correctIdx, options.length - 1) }
      }
    }
  } catch {
    /* ignore */
  }
  return null
}
