import { shuffleArray } from '@/lib/exam-layout-token'

export type ExamQuestionRow = {
  id: string
  question_text: string
  options: unknown
  correct_index: unknown
  source: unknown
}

export type ExamLayoutSnapshotV1 = {
  v: 1
  questionOrder: string[]
  optionPerms: Record<string, number[]>
}

export type PublicExamQuestion = {
  id: string
  index: number
  type: 'quiz' | 'essay'
  question_text: string
  options: string[]
}

export function isEssayQuestionRow(q: ExamQuestionRow): boolean {
  const src = String(q.source ?? '').toLowerCase()
  if (src.includes('essay')) return true
  if (!Array.isArray(q.options)) return true
  if ((q.options as unknown[]).length < 2) return true
  return false
}

export function buildFreshExamLayout(questions: ExamQuestionRow[]): {
  snapshot: ExamLayoutSnapshotV1
  publicQuestions: PublicExamQuestion[]
} {
  const quizRows = questions.filter((q) => !isEssayQuestionRow(q))
  const essayRows = questions.filter((q) => isEssayQuestionRow(q))
  const orderedRows = [...shuffleArray(quizRows), ...shuffleArray(essayRows)]
  const optionPerms: Record<string, number[]> = {}
  const publicQuestions: PublicExamQuestion[] = orderedRows.map((q, i) => {
    const rawOpts = Array.isArray(q.options) ? (q.options as string[]) : []
    if (rawOpts.length >= 2) {
      const n = rawOpts.length
      const perm = shuffleArray([...Array.from({ length: n }, (_, k) => k)])
      const displayOpts = perm.map((origIdx) => String(rawOpts[origIdx] ?? ''))
      optionPerms[String(q.id)] = perm
      return {
        id: String(q.id),
        index: i + 1,
        type: 'quiz' as const,
        question_text: q.question_text,
        options: displayOpts,
      }
    }
    return {
      id: String(q.id),
      index: i + 1,
      type: 'essay' as const,
      question_text: q.question_text,
      options: [] as string[],
    }
  })
  return {
    snapshot: { v: 1, questionOrder: orderedRows.map((r) => String(r.id)), optionPerms },
    publicQuestions,
  }
}

export function rebuildPublicFromSnapshot(
  questions: ExamQuestionRow[],
  snapshot: ExamLayoutSnapshotV1
): PublicExamQuestion[] | null {
  if (!snapshot?.questionOrder?.length) return null
  const map = new Map(questions.map((q) => [String(q.id), q]))
  const optionPerms = snapshot.optionPerms ?? {}
  let idx = 0
  const out: PublicExamQuestion[] = []
  for (const qid of snapshot.questionOrder) {
    const q = map.get(String(qid))
    if (!q) return null
    idx++
    const rawOpts = Array.isArray(q.options) ? (q.options as string[]) : []
    const perm = optionPerms[String(q.id)]
    if (rawOpts.length >= 2) {
      if (!perm || !Array.isArray(perm) || perm.length !== rawOpts.length) return null
      const displayOpts = perm.map((origIdx) => String(rawOpts[origIdx] ?? ''))
      out.push({
        id: String(q.id),
        index: idx,
        type: 'quiz',
        question_text: q.question_text,
        options: displayOpts,
      })
    } else {
      out.push({
        id: String(q.id),
        index: idx,
        type: 'essay',
        question_text: q.question_text,
        options: [],
      })
    }
  }
  return out
}

function optionLabel(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    const text = row.text ?? row.label ?? row.content
    if (typeof text === 'string') return text.replace(/\s+/g, ' ').trim()
  }
  return ''
}

/** Vị trí chữ A/B/C/D trên đề đã trộn, ứng với chỉ số đáp án gốc. */
export function correctDisplayIndex(perm: readonly number[], correctIndex: number): number | null {
  if (!Number.isInteger(correctIndex) || correctIndex < 0) return null
  const at = perm.findIndex((orig) => orig === correctIndex)
  return at >= 0 ? at : null
}

/**
 * Học sinh chọn một ô trên đề đang hiện. Đúng khi ô đó là đáp án gốc,
 * hoặc cùng nội dung với đáp án gốc. Không so chữ A/B/C với chỉ số gốc.
 */
export function displayedChoiceMatchesOriginal(input: {
  options: readonly unknown[]
  perm: readonly number[] | undefined
  displayIndex: number
  correctIndex: number
}): boolean {
  const optionCount = input.options.length
  const { perm, displayIndex, correctIndex } = input
  if (!perm || perm.length !== optionCount || optionCount < 2) return false
  if (!Number.isInteger(displayIndex) || displayIndex < 0 || displayIndex >= optionCount) return false
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= optionCount) return false
  const original = perm[displayIndex]
  if (!Number.isInteger(original) || original < 0 || original >= optionCount) return false
  if (original === correctIndex) return true
  const picked = optionLabel(input.options[original])
  const answer = optionLabel(input.options[correctIndex])
  return picked.length > 0 && picked === answer
}

export function parseLayoutSnapshot(raw: unknown): ExamLayoutSnapshotV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (Number(o.v) !== 1) return null
  const order = o.questionOrder
  const perms = o.optionPerms
  if (!Array.isArray(order) || order.length === 0) return null
  if (!perms || typeof perms !== 'object') return null
  return {
    v: 1,
    questionOrder: order.map((x) => String(x)),
    optionPerms: perms as Record<string, number[]>,
  }
}
