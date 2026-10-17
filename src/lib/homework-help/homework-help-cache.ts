import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { HomeworkGuide, HomeworkProblem } from '@/lib/homework-help/homework-help-guide'
import { parseHomeworkGuide } from '@/lib/homework-help/homework-help-guide'
import {
  HOMEWORK_HELP_DRAFT_MODEL,
  HOMEWORK_HELP_FALLBACK_MODEL,
} from '@/lib/homework-help/homework-help-models'

type ProblemCacheRow = {
  statement: string
  knowledge: unknown
  thinking: unknown
  hints: unknown
  answer: string
  tags: unknown
  check_model?: string
}

type PhotoCacheRow = {
  guide: unknown
}

/** Bản cũ của đề có hình chỉ lưu đáp án, chưa có kiến thức hay hướng tư duy. */
export function homeworkStoredGuideIsThin(problem: HomeworkProblem): boolean {
  return problem.knowledge.length === 0 && problem.thinking.length === 0 && problem.hints.length === 0
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
        tags: row.tags,
        ...(row.check_model === 'D' || row.check_model === 'G' || row.check_model === 'P'
          ? { answerMark: row.check_model, ...(row.check_model === 'G' ? { guideMark: 'G' as const } : {}) }
          : {}),
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
      `select statement, knowledge, thinking, hints, answer, tags, check_model
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

/** Giữ bản đã lưu nếu đề này đã có. Bản đầu thắng, lần sau không ghi đè. Bản chỉ có đáp án thì được bài Gemini đủ kiến thức thay. */
export async function rememberHomeworkProblem(
  fingerprint: string,
  locale: string,
  problem: HomeworkProblem,
  verifyModel: string = HOMEWORK_HELP_FALLBACK_MODEL
): Promise<HomeworkProblem> {
  if (!isPgConfigured()) return problem
  try {
    const inserted = await pgQuery<{ fingerprint: string }>(
      `insert into public.homework_help_problem_cache (
         fingerprint, locale, statement, knowledge, thinking, hints, answer, tags, read_model, check_model
       ) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9, $10)
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
        JSON.stringify(problem.tags ?? []),
        problem.guideMark === 'G' ? HOMEWORK_HELP_FALLBACK_MODEL : HOMEWORK_HELP_DRAFT_MODEL,
        problem.answerMark ?? verifyModel,
      ]
    )
    if (inserted.length > 0) return problem
    const existing = await fetchHomeworkProblemCache(fingerprint, locale)
    if (!existing) return problem
    const incomingHasGuide =
      problem.knowledge.length > 0 || problem.thinking.length > 0 || problem.hints.length > 0
    if (homeworkStoredGuideIsThin(existing) && incomingHasGuide) {
      await pgQuery(
        `update public.homework_help_problem_cache
         set statement = $3,
             knowledge = $4::jsonb,
             thinking = $5::jsonb,
             hints = $6::jsonb,
             answer = $7,
             tags = $8::jsonb,
             read_model = $9,
             check_model = $10,
             updated_at = now()
         where fingerprint = $1 and locale = $2`,
        [
          fingerprint,
          locale,
          problem.statement,
          JSON.stringify(problem.knowledge),
          JSON.stringify(problem.thinking),
          JSON.stringify(problem.hints),
          problem.answer,
          JSON.stringify(problem.tags ?? []),
          problem.guideMark === 'G' ? HOMEWORK_HELP_FALLBACK_MODEL : HOMEWORK_HELP_DRAFT_MODEL,
          problem.answerMark ?? verifyModel,
        ]
      )
      return problem
    }
    await touchHomeworkProblemCache(fingerprint, locale)
    return { ...existing, cached: true }
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

export async function fetchHomeworkSolution(fingerprint: string, locale: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ solution: string | null }>(
      `select solution
       from public.homework_help_problem_cache
       where fingerprint = $1 and locale = $2
       limit 1`,
      [fingerprint, locale]
    )
    const text = row?.solution?.trim() ?? ''
    return text || null
  } catch (error) {
    console.warn('[homework-help] solution cache read', error instanceof Error ? error.message : error)
    return null
  }
}

/** Bản đầu thắng. Hàng chưa có thì tạo hàng mỏng để lần sau vẫn đọc được lời giải. */
export async function rememberHomeworkSolution(input: {
  fingerprint: string
  locale: string
  statement: string
  answer: string
  solution: string
}): Promise<void> {
  if (!isPgConfigured()) return
  const solution = input.solution.trim()
  if (!solution) return
  try {
    const updated = await pgQuery<{ fingerprint: string }>(
      `update public.homework_help_problem_cache
       set solution = $3, updated_at = now()
       where fingerprint = $1 and locale = $2 and btrim(solution) = ''
       returning fingerprint`,
      [input.fingerprint, input.locale, solution]
    )
    if (updated.length > 0) return
    const existing = await fetchHomeworkSolution(input.fingerprint, input.locale)
    if (existing) return
    await pgQuery(
      `insert into public.homework_help_problem_cache (
         fingerprint, locale, statement, knowledge, thinking, hints, answer, solution, read_model, check_model
       ) values ($1, $2, $3, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $4, $5, $6, $6)
       on conflict (fingerprint, locale) do update
         set solution = case
           when btrim(public.homework_help_problem_cache.solution) = '' then excluded.solution
           else public.homework_help_problem_cache.solution
         end,
         updated_at = now()`,
      [
        input.fingerprint,
        input.locale,
        input.statement,
        input.answer,
        solution,
        HOMEWORK_HELP_DRAFT_MODEL,
      ]
    )
  } catch (error) {
    console.warn('[homework-help] solution cache write', error instanceof Error ? error.message : error)
  }
}

export async function rememberHomeworkPhotoCache(
  imageHash: string,
  locale: string,
  guide: HomeworkGuide
): Promise<void> {
  if (!isPgConfigured() || guide.problems.length === 0) return
  const payload = JSON.stringify(guide)
  try {
    const existing = await fetchHomeworkPhotoCache(imageHash, locale)
    const existingIsThin =
      existing != null && existing.problems.length > 0 && existing.problems.every(homeworkStoredGuideIsThin)
    if (existing && !existingIsThin) return
    if (existingIsThin) {
      await pgQuery(
        `update public.homework_help_photo_cache
         set guide = $3::jsonb
         where image_hash = $1 and locale = $2`,
        [imageHash, locale, payload]
      )
      return
    }
    await pgQuery(
      `insert into public.homework_help_photo_cache (image_hash, locale, guide)
       values ($1, $2, $3::jsonb)
       on conflict (image_hash, locale) do nothing`,
      [imageHash, locale, payload]
    )
  } catch (error) {
    console.warn('[homework-help] photo cache write', error instanceof Error ? error.message : error)
  }
}
