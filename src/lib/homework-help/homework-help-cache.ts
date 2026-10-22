import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { HomeworkGuide, HomeworkProblem } from '@/lib/homework-help/homework-help-guide'
import { homeworkProblemFromParts } from '@/lib/homework-help/homework-help-guide'
import { homeworkStatementFingerprint } from '@/lib/homework-help/homework-help-fingerprint'
import {
  HOMEWORK_HELP_DRAFT_MODEL,
  HOMEWORK_HELP_FALLBACK_MODEL,
} from '@/lib/homework-help/homework-help-models'

type ProblemCacheRow = {
  knowledge: unknown
  thinking: unknown
  hints: unknown
  answer: string
  tags: unknown
  check_model?: string
  has_statement?: boolean
}

type PhotoCacheRow = {
  guide: unknown
}

/** Kho ảnh: vân tay từng câu và phần AI viết. Không có chữ đề. */
export type StoredHomeworkPhoto = {
  note: string
  prints: string[]
  problems: HomeworkProblem[]
}

const PRINT_KEY = /^[a-f0-9]{64}$/

function cleanNote(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

/** Bản ghi kho ảnh. Vân tay tính từ đề đang có, rồi xóa chữ đề trước khi ghi. */
export function homeworkPhotoCacheRecord(guide: HomeworkGuide): StoredHomeworkPhoto {
  return {
    note: cleanNote(guide.note),
    prints: guide.problems.map((problem) => homeworkStatementFingerprint(problem.statement)),
    problems: guide.problems.map((problem) => ({ ...problem, statement: '' })),
  }
}

export function homeworkPhotoCacheMatches(stored: StoredHomeworkPhoto, statements: string[]): boolean {
  if (stored.prints.length !== statements.length || stored.problems.length !== statements.length) return false
  return stored.prints.every((print, index) => print === homeworkStatementFingerprint(statements[index] ?? ''))
}

/** Gắn đề học sinh vừa gửi vào hướng dẫn đã lưu. */
export function homeworkPhotoCacheWithStatements(stored: StoredHomeworkPhoto, statements: string[]): HomeworkGuide {
  return {
    note: stored.note,
    problems: stored.problems.map((problem, index) => ({
      ...problem,
      statement: statements[index] ?? '',
    })),
  }
}

/** Đọc JSON kho ảnh. Bản cũ còn chữ đề thì đánh dấu `dirty` để ghi đè bằng vân tay. */
export function parseStoredHomeworkPhoto(raw: unknown): { stored: StoredHomeworkPhoto; dirty: boolean } | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const problemsRaw = record.problems
  if (!Array.isArray(problemsRaw)) return null
  const originals: string[] = []
  const problems: HomeworkProblem[] = []
  let dirty = false
  for (const row of problemsRaw) {
    if (!row || typeof row !== 'object') continue
    const text = String((row as { statement?: unknown }).statement ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    const problem = homeworkProblemFromParts(row, '')
    if (!problem) continue
    if (text) dirty = true
    originals.push(text)
    problems.push({ ...problem, statement: '' })
  }
  if (problems.length === 0) return null
  const given = Array.isArray(record.prints)
    ? record.prints.filter((item): item is string => typeof item === 'string' && PRINT_KEY.test(item))
    : []
  const printsOk = given.length === problems.length
  if (!printsOk && originals.every((text) => !text)) return null
  if (!printsOk) dirty = true
  return {
    dirty,
    stored: {
      note: cleanNote(record.note),
      prints: printsOk ? given : originals.map((text) => homeworkStatementFingerprint(text)),
      problems,
    },
  }
}

/** Bản cũ của đề có hình chỉ lưu đáp án, chưa có kiến thức hay hướng tư duy. */
export function homeworkStoredGuideIsThin(problem: HomeworkProblem): boolean {
  return problem.knowledge.length === 0 && problem.thinking.length === 0 && problem.hints.length === 0
}

function asProblem(row: ProblemCacheRow, statement: string): HomeworkProblem | null {
  return homeworkProblemFromParts(
    {
      knowledge: row.knowledge,
      thinking: row.thinking,
      hints: row.hints,
      answer: row.answer,
      tags: row.tags,
      ...(row.check_model === 'D' || row.check_model === 'G' || row.check_model === 'P'
        ? { answerMark: row.check_model, ...(row.check_model === 'G' ? { guideMark: 'G' as const } : {}) }
        : {}),
    },
    statement
  )
}

/** `statement` là đề của request này. Cột chữ đề trong DB không được đọc ra. */
export async function fetchHomeworkProblemCache(
  fingerprint: string,
  locale: string,
  statement: string
): Promise<HomeworkProblem | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<ProblemCacheRow>(
      `select knowledge, thinking, hints, answer, tags, check_model,
              (btrim(statement) <> '') as has_statement
       from public.homework_help_problem_cache
       where fingerprint = $1 and locale = $2
       limit 1`,
      [fingerprint, locale]
    )
    if (!row) return null
    if (row.has_statement) {
      await pgQuery(
        `update public.homework_help_problem_cache
         set statement = ''
         where fingerprint = $1 and locale = $2 and btrim(statement) <> ''`,
        [fingerprint, locale]
      )
    }
    return asProblem(row, statement)
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
        '',
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
    const existing = await fetchHomeworkProblemCache(fingerprint, locale, problem.statement)
    if (!existing) return problem
    const incomingHasGuide =
      problem.knowledge.length > 0 || problem.thinking.length > 0 || problem.hints.length > 0
    if (homeworkStoredGuideIsThin(existing) && incomingHasGuide) {
      await pgQuery(
        `update public.homework_help_problem_cache
         set statement = '',
             knowledge = $3::jsonb,
             thinking = $4::jsonb,
             hints = $5::jsonb,
             answer = $6,
             tags = $7::jsonb,
             read_model = $8,
             check_model = $9,
             updated_at = now()
         where fingerprint = $1 and locale = $2`,
        [
          fingerprint,
          locale,
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
    return { ...existing, statement: problem.statement, cached: true }
  } catch (error) {
    console.warn('[homework-help] problem cache write', error instanceof Error ? error.message : error)
    return problem
  }
}

export async function fetchHomeworkPhotoCache(
  imageHash: string,
  locale: string
): Promise<StoredHomeworkPhoto | null> {
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
    const parsed = parseStoredHomeworkPhoto(row.guide)
    if (!parsed) return null
    if (parsed.dirty) {
      await pgQuery(
        `update public.homework_help_photo_cache
         set guide = $3::jsonb
         where image_hash = $1 and locale = $2`,
        [imageHash, locale, JSON.stringify(parsed.stored)]
      )
    }
    return parsed.stored
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
    const row = await pgQueryOne<{ solution: string | null; has_statement: boolean }>(
      `select solution, (btrim(statement) <> '') as has_statement
       from public.homework_help_problem_cache
       where fingerprint = $1 and locale = $2
       limit 1`,
      [fingerprint, locale]
    )
    if (row?.has_statement) {
      await pgQuery(
        `update public.homework_help_problem_cache
         set statement = ''
         where fingerprint = $1 and locale = $2 and btrim(statement) <> ''`,
        [fingerprint, locale]
      )
    }
    const text = row?.solution?.trim() ?? ''
    return text || null
  } catch (error) {
    console.warn('[homework-help] solution cache read', error instanceof Error ? error.message : error)
    return null
  }
}

/** Bản đầu thắng. Hàng chưa có thì tạo hàng mỏng để lần sau vẫn đọc được lời giải. Không ghi chữ đề. */
export async function rememberHomeworkSolution(input: {
  fingerprint: string
  locale: string
  answer: string
  solution: string
}): Promise<void> {
  if (!isPgConfigured()) return
  const solution = input.solution.trim()
  if (!solution) return
  try {
    const updated = await pgQuery<{ fingerprint: string }>(
      `update public.homework_help_problem_cache
       set solution = $3, statement = '', updated_at = now()
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
       ) values ($1, $2, '', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $3, $4, $5, $5)
       on conflict (fingerprint, locale) do update
         set solution = case
           when btrim(public.homework_help_problem_cache.solution) = '' then excluded.solution
           else public.homework_help_problem_cache.solution
         end,
         statement = '',
         updated_at = now()`,
      [input.fingerprint, input.locale, input.answer, solution, HOMEWORK_HELP_DRAFT_MODEL]
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
  const payload = JSON.stringify(homeworkPhotoCacheRecord(guide))
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
       on conflict (image_hash, locale) do update
         set guide = excluded.guide
       where public.homework_help_photo_cache.guide->'prints' is null`,
      [imageHash, locale, payload]
    )
  } catch (error) {
    console.warn('[homework-help] photo cache write', error instanceof Error ? error.message : error)
  }
}
