import type { Json } from '@/types/database.types'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

function isPgUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === '23505'
}

export type SlideQuizSessionRowPg = {
  id: string
  code: string
  quiz_data: Json
  status: string
}

export async function fetchSlideQuizSessionByCodeFromPg(code: string): Promise<SlideQuizSessionRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      code: string
      quiz_data: unknown
      status: string
    }>(
      `select id::text, code, quiz_data, status::text
       from public.slide_quiz_sessions
       where code = $1
       limit 1`,
      [code]
    )
    if (!row) return null
    return {
      id: row.id,
      code: row.code,
      quiz_data: (row.quiz_data ?? null) as Json,
      status: row.status,
    }
  } catch (e) {
    console.error('[slide-quiz-pg] fetchSlideQuizSessionByCodeFromPg', e)
    return null
  }
}

/** Cập nhật `status = revealed` khi `created_by` khớp. `true` nếu có dòng cập nhật. */
export async function updateSlideQuizSessionRevealedForOwnerPg(
  code: string,
  ownerUserId: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.slide_quiz_sessions
       set status = 'revealed'
       where code = $1 and created_by = $2::uuid
       returning id::text as id`,
      [code, ownerUserId]
    )
    return row != null
  } catch (e) {
    console.error('[slide-quiz-pg] updateSlideQuizSessionRevealedForOwnerPg', e)
    return null
  }
}

export async function insertSlideQuizSessionFromPg(input: {
  code: string
  curriculumId: string
  slideIndex: number
  blockIndex: number
  quizData: unknown
  createdBy: string
}): Promise<{ id: string; code: string } | 'duplicate_code' | null> {
  if (!isPgConfigured()) return null
  const quizJson = JSON.stringify(input.quizData ?? {})
  try {
    const row = await pgQueryOne<{ id: string; code: string }>(
      `insert into public.slide_quiz_sessions
         (code, curriculum_id, slide_index, block_index, quiz_data, status, created_by)
       values ($1, $2::uuid, $3, $4, $5::jsonb, 'active', $6::uuid)
       returning id::text, code`,
      [input.code, input.curriculumId, input.slideIndex, input.blockIndex, quizJson, input.createdBy]
    )
    if (!row) return null
    return { id: row.id, code: row.code }
  } catch (e) {
    if (isPgUniqueViolation(e)) return 'duplicate_code'
    console.error('[slide-quiz-pg] insertSlideQuizSessionFromPg', e)
    return null
  }
}

export async function fetchSlideQuizSessionIdByCodeFromPg(code: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text from public.slide_quiz_sessions where code = $1 limit 1`,
      [code]
    )
    return row?.id ?? null
  } catch (e) {
    console.error('[slide-quiz-pg] fetchSlideQuizSessionIdByCodeFromPg', e)
    return null
  }
}

/** `ok` | `duplicate` (unique device/session) | `null` lỗi. */
export async function insertSlideQuizResponseFromPg(input: {
  sessionId: string
  answerIndex: number
  userId: string | null
  deviceId: string
}): Promise<'ok' | 'duplicate' | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `insert into public.slide_quiz_responses (session_id, answer_index, user_id, device_id)
       values ($1::uuid, $2, $3::uuid, $4)`,
      [input.sessionId, input.answerIndex, input.userId, input.deviceId]
    )
    return 'ok'
  } catch (e) {
    if (isPgUniqueViolation(e)) return 'duplicate'
    console.error('[slide-quiz-pg] insertSlideQuizResponseFromPg', e)
    return null
  }
}

export async function fetchSlideQuizResultsForOwnerFromPg(
  code: string,
  ownerUserId: string
): Promise<{ answer_indexes: number[] } | 'not_found' | 'forbidden' | null> {
  if (!isPgConfigured()) return null
  try {
    const session = await pgQueryOne<{ id: string; created_by: string }>(
      `select id::text, created_by::text from public.slide_quiz_sessions where code = $1 limit 1`,
      [code]
    )
    if (!session) return 'not_found'
    if (session.created_by !== ownerUserId) return 'forbidden'
    const rows = await pgQuery<{ answer_index: number }>(
      `select answer_index from public.slide_quiz_responses where session_id = $1::uuid`,
      [session.id]
    )
    return {
      answer_indexes: rows.map((r) => r.answer_index),
    }
  } catch (e) {
    console.error('[slide-quiz-pg] fetchSlideQuizResultsForOwnerFromPg', e)
    return null
  }
}
