import {
  getEssaySolution,
  getThinkingGuide,
  isPlaceholderSolution,
} from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { cleanQuizSolution } from '@/app/tao-giao-trinh/lib/worksheet-quiz-solution'
import { listTutorTopicNames } from '@/lib/ai-tutor/ai-tutor-store'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { fetchExamSessionForTeacherReviewPg } from '@/lib/db/exam-session-pg'
import { fetchWorksheetQuestionsTypeContentByIdsFromPg } from '@/lib/db/worksheet-pg'
import type { WebLocale } from '@/lib/i18n/config'
import { parseLayoutSnapshot } from '@/lib/exam-session/student-exam-layout'
import { resolveExamActor } from '@/lib/lop/lop-viewer'
import { isValidUuidString } from '@/lib/validate-uuid'
import {
  fetchHomeworkProblemCache,
  homeworkStoredGuideIsThin,
  rememberHomeworkProblem,
  rememberHomeworkSolution,
  touchHomeworkProblemCache,
} from '@/lib/homework-help/homework-help-cache'
import { explainHomeworkText, fillHomeworkExerciseGaps } from '@/lib/homework-help/homework-help-ai'
import { homeworkStatementFingerprint } from '@/lib/homework-help/homework-help-fingerprint'
import {
  answerFromSolution,
  exerciseGuideGaps,
  exerciseStatement,
  mergeExerciseGuide,
  quizAnswer,
  thinkingLinesFromGuide,
  type ExerciseGuideParts,
} from '@/lib/homework-help/homework-help-from-exercise'
import type { HomeworkGuide, HomeworkProblem } from '@/lib/homework-help/homework-help-guide'
import { attachHomeworkTags } from '@/lib/homework-help/homework-help-tags'
import { appendHomeworkExchange, startHomeworkSession } from '@/lib/homework-help/homework-help-store'

export type ExerciseConsultResult =
  | { ok: true; problem: HomeworkProblem }
  | { ok: false; code: 'unauthorized' | 'missing_text' | 'ai_unavailable' | 'payment_required' }

function asOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

function asIndex(value: unknown, optionCount: number): number {
  const index = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(index) || index < 0 || index >= optionCount) return -1
  return index
}

function storedSolution(type: string, content: unknown): string {
  const raw = getEssaySolution(content).trim()
  if (!raw || isPlaceholderSolution(raw)) return ''
  const text = type === 'quiz' ? cleanQuizSolution(raw) : raw
  return text.length >= 20 ? text : ''
}

function knownParts(input: {
  question: string
  options: string[]
  correctIndex: number
  thinkingGuide: string
  solution: string
}): { statement: string; known: ExerciseGuideParts; solution: string } {
  const statement = exerciseStatement(input.question, input.options)
  const answer =
    input.options.length >= 2
      ? quizAnswer(input.options, input.correctIndex)
      : answerFromSolution(input.solution)
  return {
    statement,
    solution: input.solution,
    known: {
      knowledge: [],
      thinking: thinkingLinesFromGuide(input.thinkingGuide),
      hints: [],
      answer,
      tags: [],
    },
  }
}

async function tagProblem(problem: HomeworkProblem, locale: WebLocale): Promise<HomeworkProblem> {
  const saved = await listTutorTopicNames(locale)
  return { ...problem, tags: attachHomeworkTags(problem, saved) }
}

async function keepSolution(fingerprint: string, locale: WebLocale, answer: string, solution: string): Promise<void> {
  if (solution.trim().length < 20) return
  await rememberHomeworkSolution({
    fingerprint,
    locale,
    answer,
    solution,
  })
}

async function keepThread(userId: string, locale: WebLocale, problem: HomeworkProblem): Promise<void> {
  const sessionId = await startHomeworkSession(userId, locale)
  if (!sessionId) return
  await appendHomeworkExchange({
    sessionId,
    userId,
    text: problem.statement,
    imageCount: 0,
    guide: { note: '', problems: [problem] },
  })
}

async function finishExerciseSeed(input: {
  actorId: string
  locale: WebLocale
  seed: { statement: string; known: ExerciseGuideParts; solution: string }
  rememberThread: boolean
}): Promise<HomeworkProblem | null> {
  const { seed } = input
  if (!seed.statement) return null
  const fingerprint = homeworkStatementFingerprint(seed.statement)
  const cached = await fetchHomeworkProblemCache(fingerprint, input.locale, seed.statement)
  const cacheUseful = Boolean(cached && !homeworkStoredGuideIsThin(cached))
  const hasSavedWork =
    seed.known.thinking.length > 0 || Boolean(seed.known.answer.trim()) || seed.solution.length >= 20 || cacheUseful

  let problem: HomeworkProblem
  if (!hasSavedWork) {
    const explained = await explainHomeworkText({
      userId: input.actorId,
      locale: input.locale,
      text: seed.statement,
    })
    const first = explained === 'ai_unavailable' ? null : explained.problems[0]
    if (!first) return null
    problem = await tagProblem(first, input.locale)
    if (input.rememberThread) await keepThread(input.actorId, input.locale, problem)
    return problem
  }

  const known: ExerciseGuideParts = {
    knowledge: cached?.knowledge ?? [],
    thinking: seed.known.thinking.length > 0 ? seed.known.thinking : cached?.thinking ?? [],
    hints: cached?.hints ?? [],
    answer: seed.known.answer.trim() || cached?.answer.trim() || '',
    tags: cached?.tags ?? [],
  }
  const gaps = exerciseGuideGaps(known)
  const filled =
    gaps.length > 0
      ? await fillHomeworkExerciseGaps({
          userId: input.actorId,
          locale: input.locale,
          statement: seed.statement,
          known,
          solution: seed.solution,
        })
      : null
  const merged = await tagProblem(mergeExerciseGuide(seed.statement, known, filled), input.locale)
  if (!merged.thinking.length && !merged.knowledge.length && !merged.answer.trim()) return null
  const aiAdded =
    filled != null &&
    ((known.knowledge.length === 0 && merged.knowledge.length > 0) ||
      (known.hints.length === 0 && merged.hints.length > 0) ||
      (known.thinking.length === 0 && merged.thinking.length > 0) ||
      (!known.answer.trim() && Boolean(merged.answer.trim())))
  const shouldStore = aiAdded || (gaps.length === 0 && !cacheUseful)
  problem = shouldStore ? await rememberHomeworkProblem(fingerprint, input.locale, merged) : merged
  if (cacheUseful && !shouldStore) await touchHomeworkProblemCache(fingerprint, input.locale)
  await keepSolution(fingerprint, input.locale, problem.answer, seed.solution)
  if (input.rememberThread && !cacheUseful) await keepThread(input.actorId, input.locale, problem)
  return { ...problem, statement: seed.statement, cached: Boolean(problem.cached) || (cacheUseful && !aiAdded) }
}

export type JoinedHomeworkItem = {
  id: string
  code: string
  title: string
  className: string
  createdAt: string
  questionCount: number
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  const text = String(value ?? '').trim()
  return text
}

export async function listJoinedClassHomework(userId: string): Promise<JoinedHomeworkItem[]> {
  try {
  const rows = await pgQuery<{
    id: string
    code: string
    title: string
    class_name: string | null
    created_at: unknown
    question_count: number
  }>(
    `select s.id::text, s.code, s.title, c.name as class_name, s.created_at,
            (select count(*)::int from public.exam_questions q where q.session_id = s.id) as question_count
     from public.exam_sessions s
     join public.classes c on c.id = s.class_id
     where coalesce(s.is_practice_homework, false) = true
       and s.status = 'active'
       and s.class_id in (
         select m.class_id from public.class_members m where m.user_id = $1::uuid
       )
     order by s.created_at desc
     limit 40`,
    [userId]
  )
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title.trim() || row.code,
    className: String(row.class_name ?? '').trim(),
    createdAt: asIso(row.created_at),
    questionCount: Number(row.question_count) || 0,
  }))
  } catch (error) {
    console.warn('[homework-help] joined homework list', error instanceof Error ? error.message : error)
    return []
  }
}

export async function openJoinedClassHomework(input: {
  locale: WebLocale
  sessionId: string
}): Promise<ExerciseConsultResult & { guide?: HomeworkGuide }> {
  try {
  const actor = await resolveExamActor()
  if (!actor) return { ok: false, code: 'unauthorized' }
  const sessionId = input.sessionId.trim()
  if (!isValidUuidString(sessionId)) return { ok: false, code: 'missing_text' }
  const session = await pgQueryOne<{ title: string }>(
    `select s.title
     from public.exam_sessions s
     join public.class_members m on m.class_id = s.class_id and m.user_id = $2::uuid
     where s.id = $1::uuid
       and coalesce(s.is_practice_homework, false) = true
       and s.status = 'active'
     limit 1`,
    [sessionId, actor.id]
  )
  if (!session) return { ok: false, code: 'missing_text' }
  const questions = await pgQuery<{
    id: string
    question_text: string
    options: unknown
    correct_index: unknown
    worksheet_question_id: string | null
  }>(
    `select id::text, question_text, options, correct_index, worksheet_question_id::text
     from public.exam_questions
     where session_id = $1::uuid
     order by "order" asc
     limit 30`,
    [sessionId]
  )
  if (!questions.length) return { ok: false, code: 'missing_text' }
  const attempt = await pgQueryOne<{ layout_snapshot: unknown }>(
    `select layout_snapshot
     from public.exam_attempts
     where session_id = $1::uuid and user_id = $2::uuid
     limit 1`,
    [sessionId, actor.id]
  )
  const perms = parseLayoutSnapshot(attempt?.layout_snapshot)?.optionPerms ?? {}
  const worksheetIds = questions
    .map((question) => String(question.worksheet_question_id ?? '').trim())
    .filter((id) => isValidUuidString(id))
  const sheets = worksheetIds.length ? await fetchWorksheetQuestionsTypeContentByIdsFromPg(worksheetIds) : null
  const problems: HomeworkProblem[] = []
  for (const question of questions) {
    const rawOptions = asOptions(question.options)
    const perm = perms[question.id]
    const options =
      perm && perm.length === rawOptions.length ? perm.map((orig) => rawOptions[orig] ?? '') : rawOptions
    const storedCorrect = asIndex(question.correct_index, rawOptions.length)
    const correctIndex =
      perm && perm.length === rawOptions.length && storedCorrect >= 0 ? perm.indexOf(storedCorrect) : storedCorrect
    const worksheetId = String(question.worksheet_question_id ?? '').trim()
    const sheet = isValidUuidString(worksheetId) ? sheets?.get(worksheetId) : undefined
    const seed = knownParts({
      question: String(question.question_text ?? ''),
      options,
      correctIndex,
      thinkingGuide: sheet ? getThinkingGuide(sheet.content_json) : '',
      solution: sheet ? storedSolution(sheet.type, sheet.content_json) : '',
    })
    const problem = await finishExerciseSeed({
      actorId: actor.id,
      locale: input.locale,
      seed,
      rememberThread: false,
    })
    if (problem) problems.push(problem)
  }
  if (!problems.length) return { ok: false, code: 'ai_unavailable' }
  const title = session.title.trim() || 'Bài tập về nhà'
  const sessionChat = await startHomeworkSession(actor.id, input.locale)
  if (sessionChat) {
    await appendHomeworkExchange({
      sessionId: sessionChat,
      userId: actor.id,
      text: title,
      imageCount: 0,
      guide: { note: '', problems },
    })
  }
  return { ok: true, problem: problems[0], guide: { note: '', problems } }
  } catch (error) {
    console.warn('[homework-help] joined homework', error instanceof Error ? error.message : error)
    return { ok: false, code: 'ai_unavailable' }
  }
}

export async function openExerciseConsult(input: {
  locale: WebLocale
  examCode: string
  questionId: string
}): Promise<ExerciseConsultResult> {
  const actor = await resolveExamActor()
  if (!actor) return { ok: false, code: 'unauthorized' }
  const questionId = input.questionId.trim()
  const examCode = input.examCode.trim().toUpperCase()
  if (!isValidUuidString(questionId) || !examCode) return { ok: false, code: 'missing_text' }

  try {
  const row = await pgQueryOne<{
    question_text: string
    options: unknown
    correct_index: unknown
    worksheet_question_id: string | null
    session_id: string
    is_practice_homework: boolean
  }>(
    `select eq.question_text, eq.options, eq.correct_index, eq.worksheet_question_id::text,
            s.id::text as session_id, coalesce(s.is_practice_homework, false) as is_practice_homework
     from public.exam_questions eq
     join public.exam_sessions s on s.id = eq.session_id
     where eq.id = $1::uuid and upper(s.code) = $2
     limit 1`,
    [questionId, examCode]
  )
  if (!row || !row.is_practice_homework) return { ok: false, code: 'missing_text' }
  const attempt = await pgQueryOne<{ layout_snapshot: unknown }>(
    `select layout_snapshot
     from public.exam_attempts
     where session_id = $1::uuid and user_id = $2::uuid
     limit 1`,
    [row.session_id, actor.id]
  )
  if (!attempt) return { ok: false, code: 'unauthorized' }

  const rawOptions = asOptions(row.options)
  const perm = parseLayoutSnapshot(attempt.layout_snapshot)?.optionPerms[questionId]
  const options =
    perm && perm.length === rawOptions.length ? perm.map((orig) => rawOptions[orig] ?? '') : rawOptions
  const storedCorrect = asIndex(row.correct_index, rawOptions.length)
  const correctIndex =
    perm && perm.length === rawOptions.length && storedCorrect >= 0 ? perm.indexOf(storedCorrect) : storedCorrect
  const worksheetId = String(row.worksheet_question_id ?? '').trim()
  let thinkingGuide = ''
  let solution = ''
  if (isValidUuidString(worksheetId)) {
    const sheets = await fetchWorksheetQuestionsTypeContentByIdsFromPg([worksheetId])
    const sheet = sheets?.get(worksheetId)
    if (sheet) {
      thinkingGuide = getThinkingGuide(sheet.content_json)
      solution = storedSolution(sheet.type, sheet.content_json)
    }
  }
  const seed = knownParts({
    question: String(row.question_text ?? ''),
    options,
    correctIndex,
    thinkingGuide,
    solution,
  })
  if (!seed.statement) return { ok: false, code: 'missing_text' }
  const problem = await finishExerciseSeed({
    actorId: actor.id,
    locale: input.locale,
    seed,
    rememberThread: true,
  })
  if (!problem) return { ok: false, code: 'ai_unavailable' }
  return { ok: true, problem }
  } catch (error) {
    console.warn('[homework-help] exercise consult', error instanceof Error ? error.message : error)
    return { ok: false, code: 'ai_unavailable' }
  }
}

/** Giáo viên mở hướng tư duy của một câu bài tập. Không trả lời giải. Bài thi không mở được. */
export async function openTeacherHomeworkThinking(input: {
  locale: WebLocale
  examCode: string
  questionId: string
}): Promise<{ ok: true; lines: string[] } | { ok: false; code: 'unauthorized' | 'empty' | 'unavailable' }> {
  const actor = await resolveExamActor()
  if (!actor) return { ok: false, code: 'unauthorized' }
  const questionId = input.questionId.trim()
  const examCode = input.examCode.trim().toUpperCase()
  if (!isValidUuidString(questionId) || !examCode) return { ok: false, code: 'unauthorized' }
  const session = await fetchExamSessionForTeacherReviewPg(examCode, actor.id)
  if (!session || session === 'not_found' || session === 'forbidden' || !session.is_practice_homework) {
    return { ok: false, code: 'unauthorized' }
  }
  try {
    const row = await pgQueryOne<{
      question_text: string
      options: unknown
      correct_index: unknown
      worksheet_question_id: string | null
    }>(
      `select question_text, options, correct_index, worksheet_question_id::text
       from public.exam_questions
       where id = $1::uuid and session_id = $2::uuid
       limit 1`,
      [questionId, session.id]
    )
    if (!row) return { ok: false, code: 'unauthorized' }
    const worksheetId = String(row.worksheet_question_id ?? '').trim()
    let thinkingGuide = ''
    let solution = ''
    if (isValidUuidString(worksheetId)) {
      const sheets = await fetchWorksheetQuestionsTypeContentByIdsFromPg([worksheetId])
      const sheet = sheets?.get(worksheetId)
      if (sheet) {
        thinkingGuide = getThinkingGuide(sheet.content_json)
        solution = storedSolution(sheet.type, sheet.content_json)
      }
    }
    const saved = thinkingLinesFromGuide(thinkingGuide)
    if (saved.length > 0) return { ok: true, lines: saved }
    const rawOptions = asOptions(row.options)
    const seed = knownParts({
      question: String(row.question_text ?? ''),
      options: rawOptions,
      correctIndex: asIndex(row.correct_index, rawOptions.length),
      thinkingGuide,
      solution,
    })
    if (!seed.statement) return { ok: false, code: 'empty' }
    const problem = await finishExerciseSeed({
      actorId: actor.id,
      locale: input.locale,
      seed,
      rememberThread: false,
    })
    const lines = problem?.thinking ?? []
    if (lines.length > 0) return { ok: true, lines }
    return { ok: false, code: 'empty' }
  } catch (error) {
    console.warn('[homework-help] teacher thinking', error instanceof Error ? error.message : error)
    return { ok: false, code: 'unavailable' }
  }
}
