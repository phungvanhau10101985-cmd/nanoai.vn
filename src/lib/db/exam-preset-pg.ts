import { getEssaySolution } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { examTopicKey, topicsFromExamConfig } from '@/lib/exam-preset-match'
import { fetchWorksheetQuestionsTypeContentByIdsFromPg } from '@/lib/db/worksheet-pg'

export type ExamPresetListItem = {
  id: string
  title: string
  questionCount: number
  totalPoints: number
  durationMinutes: number
  createdAt: string
}

export type ExamPresetQuestion = {
  index: number
  type: 'quiz' | 'essay'
  questionText: string
  options: string[]
  points: number
  minutes: number
  solution: string
  correctLabel: string | null
}

export type ExamPresetDetail = {
  id: string
  title: string
  durationMinutes: number
  questionCount: number
  totalPoints: number
  totalMinutes: number
  questions: ExamPresetQuestion[]
}

function roundPoints(n: number): number {
  return Math.round(n * 100) / 100
}

function indexToLetter(index: number): string {
  if (index === 0) return 'A'
  if (index === 1) return 'B'
  if (index === 2) return 'C'
  if (index === 3) return 'D'
  return ''
}

function minutesFromConfig(config: unknown, worksheetQuestionId: string | null, isQuiz: boolean): number {
  const c = config && typeof config === 'object' && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {}
  const map = isQuiz ? c.quizMinutesById : c.essayMinutesById
  if (!worksheetQuestionId || !map || typeof map !== 'object' || Array.isArray(map)) return 0
  const raw = (map as Record<string, unknown>)[worksheetQuestionId]
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export async function fetchCurriculumTopicTitlesPg(curriculumIds: string[]): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  if (curriculumIds.length === 0) return []
  try {
    const rows = await pgQuery<{ topic: string | null }>(
      `select topic from public.worksheet_curricula where id = any($1::uuid[])`,
      [curriculumIds]
    )
    const seen = new Set<string>()
    const out: string[] = []
    for (const row of rows) {
      const topic = String(row.topic ?? '').trim()
      if (!topic || seen.has(topic)) continue
      seen.add(topic)
      out.push(topic)
    }
    return out
  } catch (e) {
    console.error('[exam-preset-pg] fetchCurriculumTopicTitlesPg', e)
    return null
  }
}

export async function listMatchingExamPresetsPg(params: {
  subjectId: string
  gradeLevelId: string
  durationMinutes: number
  topics: string[]
}): Promise<ExamPresetListItem[] | null> {
  if (!isPgConfigured()) return null
  const wantKey = examTopicKey(params.topics)
  if (!wantKey) return []
  try {
    const rows = await pgQuery<{
      id: string
      title: string | null
      duration_minutes: number | null
      config: unknown
      created_at: string | null
      question_count: number | string | null
      total_points: number | string | null
    }>(
      `select distinct on (coalesce(s.exam_lineage_root_id, s.id))
         s.id::text,
         s.title,
         s.duration_minutes,
         s.config,
         s.created_at,
         (select count(*)::int from public.exam_questions q where q.session_id = s.id) as question_count,
         (select coalesce(sum(q.points), 0) from public.exam_questions q where q.session_id = s.id) as total_points
       from public.exam_sessions s
       where s.subject_id = $1
         and s.grade_level_id = $2
         and s.duration_minutes = $3
         and coalesce(s.is_practice_homework, false) = false
         and s.status = 'active'
       order by coalesce(s.exam_lineage_root_id, s.id), s.created_at asc
       limit 200`,
      [params.subjectId, params.gradeLevelId, params.durationMinutes]
    )
    const matched = rows.filter((row) => examTopicKey(topicsFromExamConfig(row.config)) === wantKey)
    matched.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    return matched.slice(0, 40).map((row) => ({
      id: row.id,
      title: String(row.title ?? '').trim() || 'Bài thi',
      questionCount: Math.max(0, Math.floor(Number(row.question_count) || 0)),
      totalPoints: roundPoints(Number(row.total_points) || 0),
      durationMinutes: Math.max(0, Math.floor(Number(row.duration_minutes) || 0)),
      createdAt: String(row.created_at ?? ''),
    }))
  } catch (e) {
    console.error('[exam-preset-pg] listMatchingExamPresetsPg', e)
    return null
  }
}

export async function fetchExamPresetDetailPg(sessionId: string): Promise<ExamPresetDetail | 'not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const session = await pgQueryOne<{
      id: string
      title: string | null
      duration_minutes: number | null
      config: unknown
      is_practice_homework: boolean | null
    }>(
      `select id::text, title, duration_minutes, config, is_practice_homework
       from public.exam_sessions
       where id = $1::uuid
         and coalesce(is_practice_homework, false) = false
         and status = 'active'
       limit 1`,
      [sessionId]
    )
    if (!session) return 'not_found'
    const questions = await pgQuery<{
      question_text: string | null
      options: unknown
      correct_index: number | null
      points: number | string | null
      worksheet_question_id: string | null
    }>(
      `select question_text, options, correct_index, points, worksheet_question_id::text
       from public.exam_questions
       where session_id = $1::uuid
       order by "order" asc`,
      [sessionId]
    )
    const wsIds = questions
      .map((q) => String(q.worksheet_question_id ?? '').trim())
      .filter(Boolean)
    const wsMap = wsIds.length > 0 ? await fetchWorksheetQuestionsTypeContentByIdsFromPg(wsIds) : new Map()
    if (wsMap === null) return null
    const items: ExamPresetQuestion[] = questions.map((q, idx) => {
      const options = Array.isArray(q.options)
        ? q.options.map((x) => String(x ?? '').trim()).filter(Boolean)
        : []
      const isQuiz = options.length >= 2
      const ci = typeof q.correct_index === 'number' ? q.correct_index : Number(q.correct_index ?? -1)
      const correctIndex = isQuiz && Number.isFinite(ci)
        ? Math.max(0, Math.min(options.length - 1, Math.floor(ci)))
        : -1
      const correctLabel = correctIndex >= 0 ? indexToLetter(correctIndex) : null
      let solution = correctIndex >= 0 ? String(options[correctIndex] ?? '') : ''
      const wsq = String(q.worksheet_question_id ?? '').trim()
      if (!isQuiz && wsq) {
        const row = wsMap.get(wsq)
        if (row && row.type === 'essay') {
          const fromDb = getEssaySolution(row.content_json).trim()
          if (fromDb) solution = fromDb
        }
      }
      const points = roundPoints(Number(q.points) || 0)
      const minutes = minutesFromConfig(session.config, wsq || null, isQuiz)
      return {
        index: idx + 1,
        type: isQuiz ? 'quiz' : 'essay',
        questionText: String(q.question_text ?? ''),
        options,
        points,
        minutes,
        solution,
        correctLabel,
      }
    })
    const totalPoints = roundPoints(items.reduce((sum, q) => sum + q.points, 0))
    const totalMinutes = roundPoints(items.reduce((sum, q) => sum + q.minutes, 0))
    return {
      id: session.id,
      title: String(session.title ?? '').trim() || 'Bài thi',
      durationMinutes: Math.max(0, Math.floor(Number(session.duration_minutes) || 0)),
      questionCount: items.length,
      totalPoints,
      totalMinutes,
      questions: items,
    }
  } catch (e) {
    console.error('[exam-preset-pg] fetchExamPresetDetailPg', e)
    return null
  }
}

export async function fetchExamPresetSourcePg(sessionId: string): Promise<Record<string, unknown> | 'not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select *
       from public.exam_sessions
       where id = $1::uuid
         and coalesce(is_practice_homework, false) = false
         and status = 'active'
       limit 1`,
      [sessionId]
    )
    if (!row) return 'not_found'
    return row
  } catch (e) {
    console.error('[exam-preset-pg] fetchExamPresetSourcePg', e)
    return null
  }
}

export async function findTeacherExamCopyPg(params: {
  teacherId: string
  classId: string
  lineageRootId: string
}): Promise<{ id: string; code: string; title: string; durationMinutes: number; totalQuestions: number } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      code: string
      title: string | null
      duration_minutes: number | null
      total_questions: number | string | null
    }>(
      `select s.id::text, s.code, s.title, s.duration_minutes,
              (select count(*)::int from public.exam_questions q where q.session_id = s.id) as total_questions
       from public.exam_sessions s
       where s.teacher_id = $1::uuid
         and s.class_id = $2::uuid
         and (s.id = $3::uuid or s.exam_lineage_root_id = $3::uuid)
         and coalesce(s.is_practice_homework, false) = false
       order by s.created_at asc
       limit 1`,
      [params.teacherId, params.classId, params.lineageRootId]
    )
    if (!row) return null
    return {
      id: row.id,
      code: String(row.code ?? ''),
      title: String(row.title ?? '').trim() || 'Bài thi',
      durationMinutes: Math.max(0, Math.floor(Number(row.duration_minutes) || 0)),
      totalQuestions: Math.max(0, Math.floor(Number(row.total_questions) || 0)),
    }
  } catch (e) {
    console.error('[exam-preset-pg] findTeacherExamCopyPg', e)
    return null
  }
}
