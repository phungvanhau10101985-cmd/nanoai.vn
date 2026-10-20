import { createHash } from 'crypto'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import { updateWorksheetQuestionContentJsonFromPg } from '@/lib/db/worksheet-pg'

export const WORKSHEET_REVIEW_AGREES = 7

export type WorksheetQuestionProposal = {
  questionId: string
  preview: string
  agreeCount: number
  editCount: number
  authorIsMe: boolean
  myVote: 'agree' | 'reject' | null
}

type ReviewRow = {
  question_id: string
  content_hash: string
  user_id: string
  action: 'edit' | 'agree' | 'reject'
  body: unknown
  created_at: string
}

function hashBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex').slice(0, 32)
}

export function sameQuestionContent(prev: unknown, next: unknown): boolean {
  const norm = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()
  const left = (prev ?? {}) as Record<string, unknown>
  const right = (next ?? {}) as Record<string, unknown>
  if (norm(left.question || left.problem) !== norm(right.question || right.problem)) return false
  if (norm(left.solution) !== norm(right.solution)) return false
  const leftOptions = Array.isArray(left.options) ? left.options.map(norm).join('|') : ''
  const rightOptions = Array.isArray(right.options) ? right.options.map(norm).join('|') : ''
  if (leftOptions !== rightOptions) return false
  if (left.correctIndex != null || right.correctIndex != null) {
    if (Number(left.correctIndex) !== Number(right.correctIndex)) return false
  }
  return true
}

export function overlayRowsById<T extends { id: string; content_json: unknown }>(
  rows: T[],
  personal: Map<string, unknown>
): T[] {
  if (personal.size === 0) return rows
  return rows.map((row) => (personal.has(row.id) ? { ...row, content_json: personal.get(row.id) } : row))
}

function previewBody(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const row = body as { question?: unknown; problem?: unknown; solution?: unknown }
  const stem = String(row.question || row.problem || '').replace(/\s+/g, ' ').trim()
  const solution = String(row.solution || '').replace(/\s+/g, ' ').trim()
  const text = solution ? `${stem} — ${solution}` : stem
  return text.slice(0, 420)
}

export async function fetchQuestionReviewRowsPg(questionIds: string[]): Promise<ReviewRow[]> {
  if (!isPgConfigured() || questionIds.length === 0) return []
  try {
    return await pgQuery<ReviewRow>(
      `select question_id::text, content_hash, user_id::text, action, body, created_at
       from public.worksheet_question_reviews
       where question_id = any($1::uuid[])
       order by created_at asc, id asc`,
      [questionIds]
    )
  } catch (error) {
    console.error('[worksheet-question-review] fetch', error)
    return []
  }
}

export function personalBodiesForUser(rows: ReviewRow[], userId: string): Map<string, unknown> {
  const map = new Map<string, unknown>()
  for (const row of rows) {
    if (row.action === 'edit' && row.user_id === userId) map.set(row.question_id, row.body)
  }
  return map
}

export function proposalsFromRows(rows: ReviewRow[], userId: string): WorksheetQuestionProposal[] {
  const byQuestion = new Map<string, ReviewRow[]>()
  for (const row of rows) {
    const list = byQuestion.get(row.question_id) ?? []
    list.push(row)
    byQuestion.set(row.question_id, list)
  }
  const proposals: WorksheetQuestionProposal[] = []
  for (const [questionId, mine] of byQuestion) {
    const edits = mine.filter((row) => row.action === 'edit')
    const lastEdit = edits[edits.length - 1]
    if (!lastEdit) continue
    const agrees = new Set(
      mine
        .filter(
          (row) =>
            row.action === 'agree' &&
            row.content_hash === lastEdit.content_hash &&
            row.user_id !== lastEdit.user_id &&
            new Date(row.created_at).getTime() > new Date(lastEdit.created_at).getTime()
        )
        .map((row) => row.user_id)
    )
    if (agrees.size >= WORKSHEET_REVIEW_AGREES) continue
    const myVoteRow = [...mine]
      .reverse()
      .find(
        (row) =>
          (row.action === 'agree' || row.action === 'reject') &&
          row.user_id === userId &&
          row.content_hash === lastEdit.content_hash &&
          new Date(row.created_at).getTime() > new Date(lastEdit.created_at).getTime()
      )
    proposals.push({
      questionId,
      preview: previewBody(lastEdit.body),
      agreeCount: agrees.size,
      editCount: edits.length,
      authorIsMe: lastEdit.user_id === userId,
      myVote: myVoteRow?.action === 'agree' || myVoteRow?.action === 'reject' ? myVoteRow.action : null,
    })
  }
  return proposals
}

export async function recordQuestionEditPg(params: {
  questionId: string
  userId: string
  body: unknown
}): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `insert into public.worksheet_question_reviews
       (question_id, content_hash, user_id, action, body)
     values ($1::uuid, $2, $3::uuid, 'edit', $4::jsonb)`,
    [params.questionId, hashBody(params.body), params.userId, JSON.stringify(params.body ?? null)]
  )
}

export async function voteQuestionReviewPg(params: {
  questionId: string
  userId: string
  vote: 'agree' | 'reject'
}): Promise<{ applied: boolean; error?: string }> {
  if (!isPgConfigured()) return { applied: false, error: 'DATABASE_URL is not set' }
  const rows = await fetchQuestionReviewRowsPg([params.questionId])
  const edits = rows.filter((row) => row.action === 'edit')
  const lastEdit = edits[edits.length - 1]
  if (!lastEdit) return { applied: false, error: 'Chưa có đề xuất để duyệt.' }
  if (lastEdit.user_id === params.userId) return { applied: false, error: 'Người sửa không tự duyệt đề xuất của mình.' }
  await pgQuery(
    `delete from public.worksheet_question_reviews
     where question_id = $1::uuid and content_hash = $2 and user_id = $3::uuid and action = $4`,
    [params.questionId, lastEdit.content_hash, params.userId, params.vote === 'agree' ? 'reject' : 'agree']
  )
  const voteSql = params.vote === 'agree'
    ? `insert into public.worksheet_question_reviews
         (question_id, content_hash, user_id, action, body)
       values ($1::uuid, $2, $3::uuid, 'agree', $4::jsonb)
       on conflict (question_id, content_hash, user_id) where action = 'agree' do nothing`
    : `insert into public.worksheet_question_reviews
         (question_id, content_hash, user_id, action, body)
       values ($1::uuid, $2, $3::uuid, 'reject', $4::jsonb)
       on conflict (question_id, content_hash, user_id) where action = 'reject' do nothing`
  await pgQuery(voteSql, [params.questionId, lastEdit.content_hash, params.userId, JSON.stringify(lastEdit.body ?? null)])
  if (params.vote !== 'agree') return { applied: false }
  const agrees = await pgQuery<{ user_id: string }>(
    `select distinct user_id::text as user_id
     from public.worksheet_question_reviews
     where question_id = $1::uuid and action = 'agree' and content_hash = $2
       and user_id <> $3::uuid and created_at > $4::timestamptz`,
    [params.questionId, lastEdit.content_hash, lastEdit.user_id, lastEdit.created_at]
  )
  if (agrees.length < WORKSHEET_REVIEW_AGREES) return { applied: false }
  const updated = await updateWorksheetQuestionContentJsonFromPg(params.questionId, lastEdit.body)
  if (updated.error) return { applied: false, error: updated.error }
  return { applied: true }
}

export async function listSheetsContainingQuestionPg(questionId: string): Promise<Array<{ id: string; question_ids: string[] }>> {
  if (!isPgConfigured()) return []
  return pgQuery<{ id: string; question_ids: string[] }>(
    `select id::text, question_ids
     from public.worksheet_worksheets
     where $1::uuid = any(question_ids)`,
    [questionId]
  )
}
