import { createHash } from 'crypto'
import { consecutiveReviewCounts } from '@/app/tao-giao-trinh/lib/review-consecutive'
import { WORKSHEET_REVIEW_AGREES } from '@/app/tao-giao-trinh/lib/worksheet-review-count'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import { updateWorksheetQuestionContentJsonFromPg } from '@/lib/db/worksheet-pg'
import { coalesceEssayParts } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

export { WORKSHEET_REVIEW_AGREES }

export type WorksheetQuestionProposal = {
  questionId: string
  /** Bản sửa đang chờ. */
  preview: string
  /** Bản gốc đang dùng chung, để người sau đối chiếu. */
  originalPreview: string
  agreeCount: number
  rejectCount: number
  editCount: number
  authorIsMe: boolean
  myVote: 'agree' | 'reject' | null
  /** Khối markdown bản gốc, giữ xuống dòng. */
  originalBlock: string
  /** Khối markdown bản sửa, giữ xuống dòng. */
  editedBlock: string
  editedBody?: unknown
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

function normQuestionText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

/** So phần người đọc thấy. Tách lời giải ra khỏi đề, hoặc chỉ xuống dòng, không tính là sửa. */
export function sameQuestionContent(prev: unknown, next: unknown): boolean {
  const left = (prev ?? {}) as Record<string, unknown>
  const right = (next ?? {}) as Record<string, unknown>
  const leftParts = coalesceEssayParts(String(left.question || left.problem || ''), String(left.solution || ''))
  const rightParts = coalesceEssayParts(String(right.question || right.problem || ''), String(right.solution || ''))
  if (normQuestionText(leftParts.problem) !== normQuestionText(rightParts.problem)) return false
  if (normQuestionText(leftParts.solution) !== normQuestionText(rightParts.solution)) return false
  const leftOptions = Array.isArray(left.options) ? left.options.map(normQuestionText).join('|') : ''
  const rightOptions = Array.isArray(right.options) ? right.options.map(normQuestionText).join('|') : ''
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

export function previewQuestionBody(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const row = body as { question?: unknown; problem?: unknown; solution?: unknown }
  const parts = coalesceEssayParts(String(row.question || row.problem || ''), String(row.solution || ''))
  const stem = parts.problem.replace(/\s+/g, ' ').trim()
  const solution = parts.solution.replace(/\s+/g, ' ').trim()
  const text = solution ? `${stem} — ${solution}` : stem
  return text.slice(0, 1600)
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

type PendingQuestionReview = {
  questionId: string
  lastEdit: ReviewRow
  agreeCount: number
  rejectCount: number
  editCount: number
  authorIsMe: boolean
  myVote: 'agree' | 'reject' | null
}

function sameUser(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

function rowsByQuestion(rows: ReviewRow[]): Map<string, ReviewRow[]> {
  const byQuestion = new Map<string, ReviewRow[]>()
  for (const row of rows) {
    const list = byQuestion.get(row.question_id) ?? []
    list.push(row)
    byQuestion.set(row.question_id, list)
  }
  return byQuestion
}

/** Mỗi người một phiếu. Sửa mới thì chỉ đếm phiếu sau lần sửa đó, không tính người sửa. */
export function voterIdsForLastEdit(mine: ReviewRow[], action: 'agree' | 'reject'): string[] {
  const lastEdit = mine.filter((row) => row.action === 'edit').at(-1)
  if (!lastEdit) return []
  const afterEdit = new Date(lastEdit.created_at).getTime()
  return [
    ...new Set(
      mine
        .filter(
          (row) =>
            row.action === action &&
            row.content_hash === lastEdit.content_hash &&
            !sameUser(row.user_id, lastEdit.user_id) &&
            new Date(row.created_at).getTime() > afterEdit
        )
        .map((row) => row.user_id.trim().toLowerCase())
    ),
  ]
}

export function approverIdsForLastEdit(mine: ReviewRow[]): string[] {
  return voterIdsForLastEdit(mine, 'agree')
}

function votesAfterLastEdit(mine: ReviewRow[]) {
  const lastEdit = mine.filter((row) => row.action === 'edit').at(-1)
  if (!lastEdit) return []
  const afterEdit = new Date(lastEdit.created_at).getTime()
  return mine
    .filter(
      (row) =>
        (row.action === 'agree' || row.action === 'reject') &&
        row.content_hash === lastEdit.content_hash &&
        !sameUser(row.user_id, lastEdit.user_id) &&
        new Date(row.created_at).getTime() > afterEdit
    )
    .map((row) => ({
      userId: row.user_id,
      action: row.action as 'agree' | 'reject',
      at: new Date(row.created_at).getTime(),
    }))
}

export function reviewCountForQuestion(mine: ReviewRow[]): { agreeCount: number; rejectCount: number; editCount: number } {
  const edits = mine.filter((row) => row.action === 'edit')
  const counts = consecutiveReviewCounts(votesAfterLastEdit(mine))
  return {
    agreeCount: counts.agreeCount,
    rejectCount: counts.rejectCount,
    editCount: edits.length,
  }
}

/** Khóa vòng duyệt. Đổi khi có bản sửa mới, không đổi khi chỉ thêm một phiếu. */
export function worksheetTeacherReviewRoundKey(
  items: Array<{ questionId: string; editCount: number; pending: boolean; authorIsMe: boolean }>
): string {
  return items
    .map((item) => `${item.questionId}:${item.pending ? item.editCount : 0}:${item.pending && item.authorIsMe ? 'a' : item.pending ? 'p' : 's'}`)
    .join('|')
}

/** Bản sửa mới nhất còn chờ. 7 đúng liên tiếp thì thay gốc. 7 sai liên tiếp thì bỏ bản sửa. */
export function pendingQuestionReview(mine: ReviewRow[], userId: string, questionId: string): PendingQuestionReview | null {
  const edits = mine.filter((row) => row.action === 'edit')
  const lastEdit = edits[edits.length - 1]
  if (!lastEdit) return null
  const afterEdit = new Date(lastEdit.created_at).getTime()
  const counts = consecutiveReviewCounts(votesAfterLastEdit(mine))
  if (counts.closed) return null
  const myVoteRow = [...mine]
    .reverse()
    .find(
      (row) =>
        (row.action === 'agree' || row.action === 'reject') &&
        sameUser(row.user_id, userId) &&
        row.content_hash === lastEdit.content_hash &&
        new Date(row.created_at).getTime() > afterEdit
    )
  return {
    questionId,
    lastEdit,
    agreeCount: counts.agreeCount,
    rejectCount: counts.rejectCount,
    editCount: edits.length,
    authorIsMe: sameUser(lastEdit.user_id, userId),
    myVote: myVoteRow?.action === 'agree' || myVoteRow?.action === 'reject' ? myVoteRow.action : null,
  }
}

export function personalBodiesForUser(rows: ReviewRow[], userId: string): Map<string, unknown> {
  const map = new Map<string, unknown>()
  for (const [questionId, mine] of rowsByQuestion(rows)) {
    const pending = pendingQuestionReview(mine, userId, questionId)
    if (!pending) continue
    if (pending.authorIsMe || pending.myVote === 'agree') map.set(questionId, pending.lastEdit.body)
  }
  return map
}

export function proposalsFromRows(
  rows: ReviewRow[],
  userId: string,
  sharedById?: Map<string, unknown>
): WorksheetQuestionProposal[] {
  const proposals: WorksheetQuestionProposal[] = []
  for (const [questionId, mine] of rowsByQuestion(rows)) {
    const pending = pendingQuestionReview(mine, userId, questionId)
    if (!pending) continue
    if (sharedById?.has(questionId)) {
      const shared = sharedById.get(questionId)
      const edit = pending.lastEdit.body
      const sameWords = sameQuestionContent(shared, edit) || previewQuestionBody(shared) === previewQuestionBody(edit)
      if (sameWords) continue
    }
    proposals.push({
      questionId,
      preview: previewQuestionBody(pending.lastEdit.body),
      originalPreview: '',
      agreeCount: pending.agreeCount,
      rejectCount: pending.rejectCount,
      editCount: pending.editCount,
      authorIsMe: pending.authorIsMe,
      myVote: pending.myVote,
      originalBlock: '',
      editedBlock: '',
      editedBody: pending.lastEdit.body,
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
}): Promise<{ applied: boolean; discarded?: boolean; error?: string }> {
  if (!isPgConfigured()) return { applied: false, error: 'DATABASE_URL is not set' }
  const rows = await fetchQuestionReviewRowsPg([params.questionId])
  const edits = rows.filter((row) => row.action === 'edit')
  const lastEdit = edits[edits.length - 1]
  if (!lastEdit) return { applied: false, error: 'Chưa có đề xuất để duyệt.' }
  if (sameUser(lastEdit.user_id, params.userId)) return { applied: false, error: 'Người sửa không tự duyệt đề xuất của mình.' }
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
  const voteRows = await pgQuery<{ user_id: string; action: 'agree' | 'reject'; created_at: string }>(
    `select user_id::text as user_id, action, created_at
     from public.worksheet_question_reviews
     where question_id = $1::uuid and content_hash = $2 and action in ('agree', 'reject')
       and user_id <> $3::uuid and created_at > $4::timestamptz
     order by created_at asc, id asc`,
    [params.questionId, lastEdit.content_hash, lastEdit.user_id, lastEdit.created_at]
  )
  const tail = consecutiveReviewCounts(
    voteRows.map((row) => ({
      userId: row.user_id,
      action: row.action,
      at: new Date(row.created_at).getTime(),
    }))
  )
  if (!tail.closed) return { applied: false }
  if (tail.agreeCount < WORKSHEET_REVIEW_AGREES) return { applied: false, discarded: true }
  const updated = await updateWorksheetQuestionContentJsonFromPg(params.questionId, lastEdit.body)
  if (updated.error) return { applied: false, error: updated.error }
  return { applied: true }
}

export async function acknowledgedQuestionIdsPg(userId: string, questionIds: string[]): Promise<string[]> {
  if (!isPgConfigured() || !userId || questionIds.length === 0) return []
  const rows = await pgQuery<{ question_id: string }>(
    `select question_id::text as question_id
     from public.worksheet_question_teacher_acks
     where user_id = $1::uuid and question_id = any($2::uuid[])`,
    [userId, questionIds]
  )
  return rows.map((row) => row.question_id)
}

export async function acknowledgeQuestionsPg(userId: string, questionIds: string[]): Promise<void> {
  const ids = [...new Set(questionIds.map((id) => id.trim()).filter(Boolean))]
  if (!isPgConfigured() || !userId || ids.length === 0) return
  await pgQuery(
    `insert into public.worksheet_question_teacher_acks (question_id, user_id)
     select id, $2::uuid
     from unnest($1::uuid[]) as id
     on conflict (question_id, user_id) do nothing`,
    [ids, userId]
  )
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
