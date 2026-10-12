import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { HomeworkGuide, HomeworkProblem } from '@/lib/homework-help/homework-help-guide'
import { parseHomeworkGuide } from '@/lib/homework-help/homework-help-guide'
import {
  HOMEWORK_HELP_CHECK_MODEL,
  HOMEWORK_HELP_DRAFT_MODEL,
} from '@/lib/homework-help/homework-help-models'

type ProblemCacheRow = {
  statement: string
  knowledge: unknown
  thinking: unknown
  hints: unknown
  answer: string
}

type PhotoCacheRow = {
  guide: unknown
}

function asProblem(row: ProblemCacheRow): HomeworkProblem | null {
  const guide = parseHomeworkGuide({
    note: '',
    problems: [
      {
        statement: row.statement,
        knowledge: row.knowledge,
        thinking: row.thinking,
        hints: row.hints,
        answer: row.answer,
      },
    ],
  })
  return guide?.problems[0] ?? null
}

export async function fetchHomeworkProblemCache(
  fingerprint: string,
  locale: string
): Promise<HomeworkProblem | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<ProblemCacheRow>(
      `select statement, knowledge, thinking, hints, answer
       from public.homework_help_problem_cache
       where fingerprint = $1 and locale = $2
       limit 1`,
      [fingerprint, locale]
    )
    return row ? asProblem(row) : null
  } catch (error) {
    console.warn('[homework-help] problem cache read', error instanceof Error ? error.message : error)
    return null
  }
}

export async function touchHomeworkProblemCache(fingerprint: string, locale: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.homework_help_problem_cache
       set usage_count = usage_count + 1, last_used_at = now(), updated_at = now()
       where fingerprint = $1 and locale = $2`,
      [fingerprint, locale]
    )
  } catch (error) {
    console.warn('[homework-help] problem cache touch', error instanceof Error ? error.message : error)
  }
}

/** Giữ bản đã lưu nếu đề này đã có. Bản đầu thắng, lần sau không ghi đè. */
export async function rememberHomeworkProblem(
  fingerprint: string,
  locale: string,
  problem: HomeworkProblem
): Promise<HomeworkProblem> {
  if (!isPgConfigured()) return problem
  try {
    const inserted = await pgQuery<{ fingerprint: string }>(
      `insert into public.homework_help_problem_cache (
         fingerprint, locale, statement, knowledge, thinking, hints, answer, read_model, check_model
       ) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9)
       on conflict (fingerprint, locale) do nothing
       returning fingerprint`,
      [
        fingerprint,
        locale,
        problem.statement,
        JSON.stringify(problem.knowledge),
        JSON.stringify(problem.thinking),
        JSON.stringify(problem.hints),
        problem.answer,
        HOMEWORK_HELP_DRAFT_MODEL,
        HOMEWORK_HELP_CHECK_MODEL,
      ]
    )
    if (inserted.length > 0) return problem
    const existing = await fetchHomeworkProblemCache(fingerprint, locale)
    if (!existing) return problem
    await touchHomeworkProblemCache(fingerprint, locale)
    return existing
  } catch (error) {
    console.warn('[homework-help] problem cache write', error instanceof Error ? error.message : error)
    return problem
  }
}

export async function fetchHomeworkPhotoCache(
  imageHash: string,
  locale: string
): Promise<HomeworkGuide | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<PhotoCacheRow>(
      `select guide
       from public.homework_help_photo_cache
       where image_hash = $1 and locale = $2
       limit 1`,
      [imageHash, locale]
    )
    if (!row) return null
    return parseHomeworkGuide(row.guide)
  } catch (error) {
    console.warn('[homework-help] photo cache read', error instanceof Error ? error.message : error)
    return null
  }
}

export async function touchHomeworkPhotoCache(imageHash: string, locale: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.homework_help_photo_cache
       set usage_count = usage_count + 1, last_used_at = now()
       where image_hash = $1 and locale = $2`,
      [imageHash, locale]
    )
  } catch (error) {
    console.warn('[homework-help] photo cache touch', error instanceof Error ? error.message : error)
  }
}

export async function rememberHomeworkPhotoCache(
  imageHash: string,
  locale: string,
  guide: HomeworkGuide
): Promise<void> {
  if (!isPgConfigured() || guide.problems.length === 0) return
  try {
    await pgQuery(
      `insert into public.homework_help_photo_cache (image_hash, locale, guide)
       values ($1, $2, $3::jsonb)
       on conflict (image_hash, locale) do nothing`,
      [imageHash, locale, JSON.stringify(guide)]
    )
  } catch (error) {
    console.warn('[homework-help] photo cache write', error instanceof Error ? error.message : error)
  }
}
