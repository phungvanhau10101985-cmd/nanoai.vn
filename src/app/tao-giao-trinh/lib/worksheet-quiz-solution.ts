/** Lời giải trắc nghiệm viết trước. Dòng đáp án chỉ đặt sau lời giải. */
export const QUIZ_SOLUTION_MIN = 40

export const QUIZ_SOLUTION_RULE =
  'solution là lời giải chi tiết từng bước cho đúng đề vừa tạo. Viết các bước trước, chưa kết luận A/B/C/D. Không nhắc A, B, C, D và không ghi "Đáp án:" trong solution. correctIndex chỉ là kết luận, hệ thống tự ghi dòng đáp án sau lời giải. solution không được rỗng.'

export function cleanQuizSolution(raw: unknown): string {
  let text = String(raw ?? '').trim()
  text = text.replace(/^(?:\*\*)?Lời giải(?:\*\*)?\s*:\s*/i, '')
  text = text.replace(/\n+\s*(?:\*\*)?Đáp án(?:\*\*)?\s*:\s*[A-D]\.?\s*$/i, '')
  return text.trim()
}

export function quizSolutionIsDetailed(raw: unknown): boolean {
  return cleanQuizSolution(raw).length >= QUIZ_SOLUTION_MIN
}

/** Phần đáp án hiện cho giáo viên: lời giải trước, kết luận đáp án ở dòng cuối. */
export function formatQuizAnswerBlock(correctIndex: number, solution: unknown): string {
  const letter = String.fromCharCode(65 + Math.max(0, Math.min(Math.floor(Number(correctIndex) || 0), 3)))
  const steps = cleanQuizSolution(solution)
  const conclusion = `**Đáp án:** ${letter}`
  if (!steps) return conclusion
  return `${steps}\n\n${conclusion}`
}
