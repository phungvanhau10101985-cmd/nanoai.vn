import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type WorksheetSheetVerifyRowPg = {
  id: string
  user_id: string
  curriculum_id: string | null
  topic: string | null
  question_ids: string[] | null
  sgk_image_urls: unknown
}

export async function fetchWorksheetSheetForVerifyPg(worksheetId: string): Promise<WorksheetSheetVerifyRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select w.id::text, w.user_id::text, w.curriculum_id::text, w.topic::text,
              w.question_ids, w.sgk_image_urls
       from public.worksheet_worksheets w
       where w.id = $1::uuid limit 1`,
      [worksheetId]
    )
    if (!row) return null
    const qids = row.question_ids
    return {
      id: String(row.id),
      user_id: String(row.user_id ?? ''),
      curriculum_id: row.curriculum_id != null ? String(row.curriculum_id) : null,
      topic: row.topic != null ? String(row.topic) : null,
      question_ids: Array.isArray(qids) ? qids.map((x) => String(x)) : null,
      sgk_image_urls: row.sgk_image_urls,
    }
  } catch (e) {
    console.error('[worksheet-verify-run-pg] fetchWorksheetSheetForVerifyPg', e)
    return null
  }
}

export async function fetchCurriculumContentMarkdownForVerifyPg(curriculumId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ c: string | null }>(
      `select content_markdown::text as c from public.worksheet_curricula where id = $1::uuid limit 1`,
      [curriculumId]
    )
    return row?.c != null ? String(row.c) : null
  } catch (e) {
    console.error('[worksheet-verify-run-pg] fetchCurriculumContentMarkdownForVerifyPg', e)
    return null
  }
}

export type WorksheetQuestionVerifyRowPg = {
  id: string
  type: string
  content_json: unknown
  difficulty?: string
  source?: string
  verified_at?: string | null
}

export async function fetchWorksheetQuestionsByIdsForVerifyPg(
  questionIds: string[]
): Promise<WorksheetQuestionVerifyRowPg[] | null> {
  if (!isPgConfigured() || questionIds.length === 0) return []
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, type::text, content_json, difficulty::text as difficulty,
              source::text as source, verified_at
       from public.worksheet_questions
       where id = any($1::uuid[])`,
      [questionIds]
    )
    return rows.map((r) => ({
      id: String(r.id),
      type: String(r.type ?? ''),
      content_json: r.content_json,
      difficulty: r.difficulty != null ? String(r.difficulty) : undefined,
      source: r.source != null ? String(r.source) : undefined,
      verified_at: r.verified_at != null ? String(r.verified_at) : null,
    }))
  } catch (e) {
    console.error('[worksheet-verify-run-pg] fetchWorksheetQuestionsByIdsForVerifyPg', e)
    return null
  }
}

async function pgExecuteRowCount(text: string, params?: unknown[]): Promise<number> {
  const pool = getPgPool()
  const res = await pool.query(text, params)
  return res.rowCount ?? 0
}

export async function updateWorksheetQuestionContentJsonPg(questionId: string, contentJson: unknown): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const n = await pgExecuteRowCount(
      `update public.worksheet_questions set content_json = $2::jsonb where id = $1::uuid`,
      [questionId, JSON.stringify(contentJson ?? {})]
    )
    return n > 0
  } catch (e) {
    console.error('[worksheet-verify-run-pg] updateWorksheetQuestionContentJsonPg', e)
    return false
  }
}

export async function updateWorksheetQuestionVerifiedAtNowPg(questionId: string, atIso: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const n = await pgExecuteRowCount(
      `update public.worksheet_questions set verified_at = $2::timestamptz where id = $1::uuid`,
      [questionId, atIso]
    )
    return n > 0
  } catch (e) {
    console.error('[worksheet-verify-run-pg] updateWorksheetQuestionVerifiedAtNowPg', e)
    return false
  }
}

export async function updateWorksheetSheetContentMarkdownPg(worksheetId: string, contentMarkdown: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const n = await pgExecuteRowCount(
      `update public.worksheet_worksheets set content_markdown = $2 where id = $1::uuid`,
      [worksheetId, contentMarkdown]
    )
    return n > 0
  } catch (e) {
    console.error('[worksheet-verify-run-pg] updateWorksheetSheetContentMarkdownPg', e)
    return false
  }
}
