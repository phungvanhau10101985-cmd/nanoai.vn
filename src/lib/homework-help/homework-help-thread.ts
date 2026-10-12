import { parseHomeworkGuide, type HomeworkProblem } from '@/lib/homework-help/homework-help-guide'

export type HomeworkSessionSummary = {
  id: string
  preview: string
  updatedAt: string
  messageCount: number
}

export type HomeworkThreadMessage = {
  id: string
  role: 'user' | 'teacher'
  body: string
  kind: 'question' | 'photo' | 'problem' | 'note'
  imageCount: number
  problem: HomeworkProblem | null
  createdAt: string
}

export function parseHomeworkThreadProblem(raw: unknown): HomeworkProblem | null {
  const guide = parseHomeworkGuide({ note: '', problems: [raw] })
  return guide?.problems[0] ?? null
}

export function homeworkImageCount(payload: unknown): number {
  if (!payload || typeof payload !== 'object') return 0
  const count = (payload as { imageCount?: unknown }).imageCount
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return 0
  return Math.min(3, Math.floor(count))
}
