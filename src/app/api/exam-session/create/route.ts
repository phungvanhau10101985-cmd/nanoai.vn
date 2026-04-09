import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  collectAllowedQuestionIdsFromCurriculaPg,
  fetchLessonTopicsFromCurriculumIdsPg,
  fetchOfficialQuestionsBankPg,
  fetchWorksheetEssayRowsByIdsPg,
  fetchWorksheetQuizRowsByIdsPg,
  insertExamQuestionRowsPg,
  insertExamSessionCreatePg,
  deleteExamSessionByIdPg,
  setExamLineageRootToSelfPg,
} from '@/lib/db/exam-session-admin-pg'
import {
  fetchClassForExamSessionCreatePg,
  updateClassGradeLevelIfDifferentPg,
  updateClassSchoolAndGradeIfUnsetPg,
} from '@/lib/db/classes-pg'
import { fetchSchoolByIdPg } from '@/lib/db/schools-repo'
import {
  DEFAULT_WEB_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_NAME_LEGACY,
  normalizeWebLocale,
  type WebLocale,
} from '@/lib/i18n/config'
import { resolveDefaultExamSessionTitle } from '@/lib/i18n/exam-session-default-titles'
import { getEssayProblem } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { shuffleArray } from '@/lib/exam-layout-token'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

/** Hàng từ worksheet_questions / ngân hàng — annotate để TS khớp khi client là service role. */
type WorksheetQuestionPick = {
  id: string
  type?: string
  difficulty?: unknown
  content_json?: unknown
}
type OfficialBankRow = {
  question_text?: unknown
  options?: unknown
  correct_index?: unknown
  difficulty?: unknown
}
type OfficialPoolItem = {
  question_text: string
  options: string[]
  correct_index: number
  source: 'official'
  difficulty: string
}

/** Tổng điểm tối đa toàn đề (TN + TL) — khớp UI tạo đề */
const EXAM_TARGET_TOTAL_POINTS = 100

function roundExamTotalPoints(n: number): number {
  return Math.round(n * 100) / 100
}

const EXAM_TYPE_CONFIG: Record<string, { duration: number; minutesPerQuestion: number }> = {
  '15ph': { duration: 15, minutesPerQuestion: 1 },
  '1tiet': { duration: 45, minutesPerQuestion: 1 },
  hocky: { duration: 90, minutesPerQuestion: 1.5 },
  totnghiep: { duration: 120, minutesPerQuestion: 2 },
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function normalizeQuizFromContentJson(contentJson: unknown): { question: string; options: string[]; correctIndex: number } | null {
  const c = (contentJson ?? {}) as { question?: unknown; options?: unknown; correctIndex?: unknown }
  const question = typeof c.question === 'string' ? c.question.trim() : ''
  const rawOptions = Array.isArray(c.options) ? c.options : []
  const options = rawOptions
    .map((x) => (typeof x === 'string' ? x.replace(/^[A-D]\.\s*/i, '').trim() : ''))
    .filter(Boolean)
    .slice(0, 4)
  const ciRaw = typeof c.correctIndex === 'number' ? c.correctIndex : Number(c.correctIndex)
  const correctIndex = Number.isFinite(ciRaw) ? Math.max(0, Math.min(3, Math.floor(ciRaw))) : 0
  if (!question || options.length < 2) return null
  return { question, options, correctIndex }
}

function sampleShuffle<T>(arr: T[]): T[] {
  const cloned = [...arr]
  for (let i = cloned.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cloned[i], cloned[j]] = [cloned[j], cloned[i]]
  }
  return cloned
}

function quizMinutesForDifficulty(
  difficulty: string | null | undefined,
  config: { easy: number; medium: number; hard: number }
): number {
  if (difficulty === 'easy') return config.easy
  if (difficulty === 'hard') return config.hard
  return config.medium
}

function normalizeDifficulty(difficulty: string | null | undefined): 'easy' | 'medium' | 'hard' {
  if (difficulty === 'easy' || difficulty === 'hard') return difficulty
  return 'medium'
}

function clampQuizPointsPerQuestion(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.max(0.25, Math.min(50, Math.round(n * 100) / 100))
}

function clampEssayPointsMax(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(200, Math.round(n * 100) / 100))
}

function resolveBaseUrl(req: NextRequest): string {
  const envBaseRaw = String(
    process.env.NEXT_PUBLIC_SITE_URL
    || process.env.APP_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL
    || ''
  ).trim()
  const envBase = envBaseRaw
    ? (envBaseRaw.startsWith('http') ? envBaseRaw : `https://${envBaseRaw}`)
    : ''
  const envIsLocal = envBase.includes('localhost') || envBase.includes('127.0.0.1')

  const forwardedHostRaw = String(req.headers.get('x-forwarded-host') || '').trim()
  const forwardedHost = forwardedHostRaw.split(',')[0]?.trim() || ''
  const forwardedProtoRaw = String(req.headers.get('x-forwarded-proto') || '').trim()
  const forwardedProto = (forwardedProtoRaw.split(',')[0]?.trim() || 'https').toLowerCase()
  if (forwardedHost) {
    const isLocal = forwardedHost.includes('localhost') || forwardedHost.includes('127.0.0.1')
    if (isLocal && envBase && !envIsLocal) return envBase
    return `${isLocal ? 'http' : forwardedProto}://${forwardedHost}`
  }

  const host = String(req.headers.get('host') || '').trim()
  if (host) {
    const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
    if ((host.includes('localhost') || host.includes('127.0.0.1')) && envBase && !envIsLocal) return envBase
    return `${proto}://${host}`
  }

  const requestOrigin = String(req.nextUrl.origin || '').trim()
  if (
    requestOrigin.startsWith('http')
    && !requestOrigin.includes('localhost')
    && !requestOrigin.includes('127.0.0.1')
  ) return requestOrigin
  if (envBase) return envBase
  return requestOrigin.startsWith('http') ? requestOrigin : defaultPublicOrigin()
}

/** Tạo phiên thi – lấy câu hỏi từ DB theo topic, thiếu thì bỏ qua (không AI tạo). */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const examType = String(body?.examType ?? '15ph').toLowerCase()
    const config = EXAM_TYPE_CONFIG[examType] ?? EXAM_TYPE_CONFIG['15ph']
    const subjectId = String(body?.subjectId ?? 'toan').trim()
    const gradeLevelId = String(body?.gradeLevelId ?? 'lop-12').trim()
    const classId = String(body?.classId ?? '').trim()
    const requestedSchoolId = String(body?.schoolId ?? '').trim()
    let lessonTopics: string[] = Array.isArray(body?.lessonTopics) ? (body.lessonTopics as string[]).map(String).filter(Boolean) : []
    const curriculumIds = Array.isArray(body?.curriculumIds) ? (body.curriculumIds as string[]).map(String).filter(Boolean) : []
    if (curriculumIds.length > 0 && lessonTopics.length === 0) {
      const topicsFetched = await fetchLessonTopicsFromCurriculumIdsPg(curriculumIds)
      if (topicsFetched === null) {
        return NextResponse.json({ error: 'Không thể đọc chủ đề từ giáo trình.' }, { status: 503 })
      }
      lessonTopics = topicsFetched
    }
    const practiceHomework = body?.practiceHomework === true
    let titleLocale: WebLocale = DEFAULT_WEB_LOCALE
    const localeFromBody = normalizeWebLocale(
      typeof body?.locale === 'string' ? body.locale : null
    )
    if (localeFromBody) titleLocale = localeFromBody
    else {
      const cs = cookies()
      const localeFromCookie =
        normalizeWebLocale(cs.get(LOCALE_COOKIE_NAME)?.value)
        ?? normalizeWebLocale(cs.get(LOCALE_COOKIE_NAME_LEGACY)?.value)
      if (localeFromCookie) titleLocale = localeFromCookie
    }
    const titleFromBody = String(body?.title ?? '').trim()
    const title =
      titleFromBody || resolveDefaultExamSessionTitle(titleLocale, practiceHomework)
    const difficulty = ['easy', 'medium', 'hard'].includes(String(body?.difficulty ?? '')) ? body.difficulty : undefined
    const selectionMode = body?.selectionMode === 'manual' ? 'manual' : 'random'
    const selectedQuizQuestionIds = Array.isArray(body?.selectedQuizQuestionIds)
      ? (body.selectedQuizQuestionIds as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean)
      : []
    const selectedEssayQuestionIds = Array.isArray(body?.selectedEssayQuestionIds)
      ? (body.selectedEssayQuestionIds as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean)
      : []
    const rawEssayMinutesById = (body?.essayMinutesById && typeof body.essayMinutesById === 'object')
      ? (body.essayMinutesById as Record<string, unknown>)
      : {}
    const essayMinutesById: Record<string, number> = {}
    for (const [qid, raw] of Object.entries(rawEssayMinutesById)) {
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(n)) continue
      essayMinutesById[String(qid)] = Math.max(0.5, Math.min(20, n))
    }
    const rawEssayPointsById = (body?.essayPointsById && typeof body.essayPointsById === 'object')
      ? (body.essayPointsById as Record<string, unknown>)
      : {}
    const essayPointsById: Record<string, number> = {}
    for (const [qid, raw] of Object.entries(rawEssayPointsById)) {
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(n)) continue
      essayPointsById[String(qid)] = clampEssayPointsMax(n, 10)
    }
    const quizQuestionCountRaw = Number(body?.quizQuestionCount ?? 0)
    const quizQuestionCount = Number.isFinite(quizQuestionCountRaw) ? Math.max(0, Math.min(200, Math.floor(quizQuestionCountRaw))) : 0
    const quizCountEasyRaw = Number(body?.quizCountEasy ?? 0)
    const quizCountMediumRaw = Number(body?.quizCountMedium ?? 0)
    const quizCountHardRaw = Number(body?.quizCountHard ?? 0)
    const requestedQuizByDifficulty = {
      easy: Number.isFinite(quizCountEasyRaw) ? Math.max(0, Math.min(200, Math.floor(quizCountEasyRaw))) : 0,
      medium: Number.isFinite(quizCountMediumRaw) ? Math.max(0, Math.min(200, Math.floor(quizCountMediumRaw))) : 0,
      hard: Number.isFinite(quizCountHardRaw) ? Math.max(0, Math.min(200, Math.floor(quizCountHardRaw))) : 0,
    }

    const quizMinutesEasy = typeof body?.quizMinutesEasy === 'number' && body.quizMinutesEasy >= 0.5 && body.quizMinutesEasy <= 10
      ? body.quizMinutesEasy
      : config.minutesPerQuestion
    const quizMinutesMedium = typeof body?.quizMinutesMedium === 'number' && body.quizMinutesMedium >= 0.5 && body.quizMinutesMedium <= 10
      ? body.quizMinutesMedium
      : (
        typeof body?.minutesPerQuestion === 'number' && body.minutesPerQuestion >= 0.5 && body.minutesPerQuestion <= 10
          ? body.minutesPerQuestion
          : config.minutesPerQuestion
      )
    const quizMinutesHard = typeof body?.quizMinutesHard === 'number' && body.quizMinutesHard >= 0.5 && body.quizMinutesHard <= 10
      ? body.quizMinutesHard
      : Math.max(quizMinutesMedium, config.minutesPerQuestion)

    const quizPointsEasy = clampQuizPointsPerQuestion(
      typeof body?.quizPointsEasy === 'number' ? body.quizPointsEasy : Number(body?.quizPointsEasy),
      1
    )
    const quizPointsMedium = clampQuizPointsPerQuestion(
      typeof body?.quizPointsMedium === 'number' ? body.quizPointsMedium : Number(body?.quizPointsMedium),
      1.5
    )
    const quizPointsHard = clampQuizPointsPerQuestion(
      typeof body?.quizPointsHard === 'number' ? body.quizPointsHard : Number(body?.quizPointsHard),
      2
    )
    const pointsForQuizDifficulty = (diff: string | null | undefined) => {
      const d = normalizeDifficulty(diff)
      if (d === 'easy') return quizPointsEasy
      if (d === 'hard') return quizPointsHard
      return quizPointsMedium
    }
    const autoTotalQuestions = Math.max(1, Math.floor(config.duration / quizMinutesMedium))
    const requestedQuizCountFromDiff = requestedQuizByDifficulty.easy + requestedQuizByDifficulty.medium + requestedQuizByDifficulty.hard
    const requestedQuizCount =
      requestedQuizCountFromDiff > 0
        ? requestedQuizCountFromDiff
        : (quizQuestionCount > 0 ? quizQuestionCount : Math.max(1, autoTotalQuestions))
    if (requestedQuizCountFromDiff <= 0 && requestedQuizCount > 0) {
      requestedQuizByDifficulty.medium = requestedQuizCount
    }
    const requestedEssayCount = selectedEssayQuestionIds.length
    const weightedMinutesPerQuestion = requestedQuizCount > 0 ? quizMinutesMedium : config.minutesPerQuestion
    const perQuestionMinutes: number[] = []
    type NewExamQuestion = {
      question_text: string
      options: string[]
      correct_index: number | null
      source: string
      /** Điểm tối đa câu (TN: cộng khi đúng; TL: trần khi chấm) */
      points: number
      /** Câu lấy từ worksheet_questions — để chữa bài đọc lời giải từ DB */
      worksheet_question_id?: string | null
    }
    const pickedQuestions: NewExamQuestion[] = []

    if (!classId) {
      return NextResponse.json({ error: 'Vui lòng chọn lớp cho bài thi.' }, { status: 400 })
    }

    const clsFetch = await fetchClassForExamSessionCreatePg(classId)
    if (clsFetch === null) {
      return NextResponse.json({ error: 'Không thể đọc lớp.' }, { status: 503 })
    }
    if (clsFetch === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy lớp đã chọn.' }, { status: 404 })
    }
    const cls = clsFetch
    if (String(cls.teacher_id ?? '') !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền dùng lớp này.' }, { status: 403 })
    }

    const finalSchoolId = requestedSchoolId || String(cls.school_id ?? '').trim()
    if (!finalSchoolId) {
      return NextResponse.json({ error: 'Vui lòng chọn trường trước khi tạo bài thi.' }, { status: 400 })
    }
    const schoolRow = await fetchSchoolByIdPg(finalSchoolId)
    if (!schoolRow) {
      return NextResponse.json({ error: 'Không tìm thấy trường đã chọn.' }, { status: 404 })
    }
    if (String(cls.school_id ?? '').trim() && String(cls.school_id ?? '').trim() !== finalSchoolId) {
      return NextResponse.json({ error: 'Lớp đã gắn với trường khác. Vui lòng chọn đúng trường của lớp.' }, { status: 400 })
    }
    if (!String(cls.school_id ?? '').trim()) {
      const up = await updateClassSchoolAndGradeIfUnsetPg(
        classId,
        user.id,
        finalSchoolId,
        gradeLevelId || null
      )
      if (up === null) {
        return NextResponse.json({ error: 'Không thể cập nhật lớp.' }, { status: 503 })
      }
    } else if (gradeLevelId && String(cls.grade_level_id ?? '').trim() !== gradeLevelId) {
      const up = await updateClassGradeLevelIfDifferentPg(classId, user.id, gradeLevelId)
      if (up === null) {
        return NextResponse.json({ error: 'Không thể cập nhật khối lớp.' }, { status: 503 })
      }
    }

    let allowedQuestionIds = new Set<string>()
    if (curriculumIds.length > 0) {
      const collected = await collectAllowedQuestionIdsFromCurriculaPg(curriculumIds)
      if (collected === null) {
        return NextResponse.json({ error: 'Không thể đọc câu hỏi theo giáo trình.' }, { status: 503 })
      }
      allowedQuestionIds = collected
    }
    const scopedQuizIds = allowedQuestionIds.size > 0
      ? selectedQuizQuestionIds.filter((id) => allowedQuestionIds.has(id))
      : selectedQuizQuestionIds
    const scopedEssayIds = allowedQuestionIds.size > 0
      ? selectedEssayQuestionIds.filter((id) => allowedQuestionIds.has(id))
      : selectedEssayQuestionIds

    if (selectionMode === 'manual' && scopedQuizIds.length > 0) {
      const selectedRows = await fetchWorksheetQuizRowsByIdsPg(scopedQuizIds)
      if (selectedRows === null) {
        return NextResponse.json({ error: 'Không thể đọc câu trắc nghiệm đã chọn.' }, { status: 503 })
      }
      const selectedQuiz = selectedRows as WorksheetQuestionPick[]
      const byId = new Map(selectedQuiz.map((r) => [String(r.id), r]))
      const selectedByDifficulty = { easy: 0, medium: 0, hard: 0 }
      for (const qid of scopedQuizIds) {
        const row = byId.get(qid)
        if (!row) continue
        const quiz = normalizeQuizFromContentJson(row.content_json)
        if (!quiz) continue
        const diff = normalizeDifficulty(String(row.difficulty ?? ''))
        selectedByDifficulty[diff] += 1
        pickedQuestions.push({
          question_text: quiz.question,
          options: quiz.options,
          correct_index: quiz.correctIndex,
          source: 'worksheet_quiz',
          worksheet_question_id: String(qid),
          points: pointsForQuizDifficulty(String(row.difficulty ?? '')),
        })
        perQuestionMinutes.push(
          quizMinutesForDifficulty(diff, {
            easy: quizMinutesEasy,
            medium: quizMinutesMedium,
            hard: quizMinutesHard,
          })
        )
      }
      if (
        selectedByDifficulty.easy !== requestedQuizByDifficulty.easy
        || selectedByDifficulty.medium !== requestedQuizByDifficulty.medium
        || selectedByDifficulty.hard !== requestedQuizByDifficulty.hard
      ) {
        return NextResponse.json(
          { error: 'Số câu giáo viên chọn chưa đúng chỉ tiêu Dễ/Trung bình/Khó.' },
          { status: 400 }
        )
      }
    } else if (requestedQuizCount > 0) {
      // Random quiz: if teacher selected quiz pool from curricula, random within that pool first.
      if (scopedQuizIds.length > 0) {
        const poolRowsRaw = await fetchWorksheetQuizRowsByIdsPg(scopedQuizIds)
        if (poolRowsRaw === null) {
          return NextResponse.json({ error: 'Không thể đọc ngân hàng câu trắc nghiệm.' }, { status: 503 })
        }
        const poolRowsTyped = poolRowsRaw as WorksheetQuestionPick[]
        const pool = poolRowsTyped.map((r) => {
          const quiz = normalizeQuizFromContentJson(r.content_json)
          const diff = String((r as { difficulty?: unknown }).difficulty ?? '')
          if (!quiz) return null
          return {
            question_text: quiz.question,
            options: quiz.options,
            correct_index: quiz.correctIndex,
            source: 'worksheet_quiz' as const,
            difficulty: diff,
            worksheet_question_id: String(r.id),
          }
        }).filter(Boolean) as Array<{
          question_text: string
          options: string[]
          correct_index: number
          source: 'worksheet_quiz'
          difficulty: string
          worksheet_question_id: string
        }>
        const easyPool = sampleShuffle(pool.filter((x) => normalizeDifficulty(x.difficulty) === 'easy'))
        const mediumPool = sampleShuffle(pool.filter((x) => normalizeDifficulty(x.difficulty) === 'medium'))
        const hardPool = sampleShuffle(pool.filter((x) => normalizeDifficulty(x.difficulty) === 'hard'))
        if (
          easyPool.length < requestedQuizByDifficulty.easy
          || mediumPool.length < requestedQuizByDifficulty.medium
          || hardPool.length < requestedQuizByDifficulty.hard
        ) {
          return NextResponse.json(
            { error: 'Không đủ câu trắc nghiệm theo mức độ trong các giáo trình đã chọn.' },
            { status: 400 }
          )
        }
        const picked = [
          ...easyPool.slice(0, requestedQuizByDifficulty.easy),
          ...mediumPool.slice(0, requestedQuizByDifficulty.medium),
          ...hardPool.slice(0, requestedQuizByDifficulty.hard),
        ]
        for (const item of picked) {
          pickedQuestions.push({
            question_text: item.question_text,
            options: item.options,
            correct_index: item.correct_index,
            source: item.source,
            worksheet_question_id: item.worksheet_question_id,
            points: pointsForQuizDifficulty(item.difficulty),
          })
          perQuestionMinutes.push(
            quizMinutesForDifficulty(item.difficulty, {
              easy: quizMinutesEasy,
              medium: quizMinutesMedium,
              hard: quizMinutesHard,
            })
          )
        }
      } else {
        const officialRows = await fetchOfficialQuestionsBankPg({
          subjectId,
          gradeLevelId,
          lessonTopics,
          difficulty: difficulty as string | undefined,
          limit: Math.max(30, requestedQuizCount * 4),
        })
        if (officialRows === null) {
          return NextResponse.json({ error: 'Không thể đọc ngân hàng câu chính thức.' }, { status: 503 })
        }
        const bankRows = officialRows as OfficialBankRow[]
        const pool: OfficialPoolItem[] = bankRows
          .map((r) => ({
            question_text: String(r.question_text ?? '').trim(),
            options: Array.isArray(r.options) ? r.options.map((x: unknown) => String(x ?? '').trim()).filter(Boolean).slice(0, 4) : [],
            correct_index: typeof r.correct_index === 'number' ? r.correct_index : Number(r.correct_index ?? 0),
            source: 'official' as const,
            difficulty: String(r.difficulty ?? ''),
          }))
          .filter((r): r is OfficialPoolItem => Boolean(r.question_text && r.options.length >= 2))
        const easyPool = sampleShuffle(pool.filter((x) => normalizeDifficulty(x.difficulty) === 'easy'))
        const mediumPool = sampleShuffle(pool.filter((x) => normalizeDifficulty(x.difficulty) === 'medium'))
        const hardPool = sampleShuffle(pool.filter((x) => normalizeDifficulty(x.difficulty) === 'hard'))
        if (
          easyPool.length < requestedQuizByDifficulty.easy
          || mediumPool.length < requestedQuizByDifficulty.medium
          || hardPool.length < requestedQuizByDifficulty.hard
        ) {
          return NextResponse.json(
            { error: 'Không đủ câu trắc nghiệm theo mức độ trong ngân hàng câu hỏi.' },
            { status: 400 }
          )
        }
        const picked: OfficialPoolItem[] = [
          ...easyPool.slice(0, requestedQuizByDifficulty.easy),
          ...mediumPool.slice(0, requestedQuizByDifficulty.medium),
          ...hardPool.slice(0, requestedQuizByDifficulty.hard),
        ]
        pickedQuestions.push(
          ...picked.map((qz: OfficialPoolItem) => ({
            question_text: qz.question_text,
            options: qz.options,
            correct_index: Number.isFinite(qz.correct_index) ? Math.max(0, Math.min(3, Math.floor(qz.correct_index))) : 0,
            source: 'official',
            points: pointsForQuizDifficulty(qz.difficulty),
          }))
        )
        for (const item of picked) {
          perQuestionMinutes.push(
            quizMinutesForDifficulty(item.difficulty, {
              easy: quizMinutesEasy,
              medium: quizMinutesMedium,
              hard: quizMinutesHard,
            })
          )
        }
      }
    }

    if (scopedEssayIds.length > 0) {
      const essayRowsRaw = await fetchWorksheetEssayRowsByIdsPg(scopedEssayIds)
      if (essayRowsRaw === null) {
        return NextResponse.json({ error: 'Không thể đọc câu tự luận.' }, { status: 503 })
      }
      const essayRows = essayRowsRaw as WorksheetQuestionPick[]
      const byEssayId = new Map(essayRows.map((r) => [String(r.id), r]))
      for (const qid of scopedEssayIds) {
        const row = byEssayId.get(qid)
        if (!row) continue
        const problem = getEssayProblem(row.content_json).trim()
        if (!problem) continue
        pickedQuestions.push({
          question_text: problem,
          options: [],
          correct_index: null,
          source: 'worksheet_essay',
          worksheet_question_id: String(qid),
          points: essayPointsById[qid] ?? 10,
        })
        perQuestionMinutes.push(essayMinutesById[qid] ?? 2)
      }
    }

    if (pickedQuestions.length === 0) {
      return NextResponse.json(
        { error: 'Không có câu hỏi phù hợp trong ngân hàng. Vui lòng tạo câu hỏi trước (Tạo câu hỏi trên slide).' },
        { status: 400 }
      )
    }

    if (practiceHomework) {
      for (const q of pickedQuestions) {
        ;(q as { points?: number }).points = 1
      }
    }

    const nQuiz = pickedQuestions.filter(
      (q) => Array.isArray(q.options) && q.options.length >= 2
    ).length
    const nEssay = pickedQuestions.length - nQuiz
    let quizPointsMax = 0
    let essayPointsMax = 0
    for (const q of pickedQuestions) {
      const pts = Number.isFinite(q.points) && q.points >= 0 ? q.points : 1
      const isTn = Array.isArray(q.options) && q.options.length >= 2
      if (isTn) quizPointsMax += pts
      else essayPointsMax += pts
    }

    const totalPickedPoints = roundExamTotalPoints(quizPointsMax + essayPointsMax)
    if (!practiceHomework && Math.abs(totalPickedPoints - EXAM_TARGET_TOTAL_POINTS) > 0.01) {
      return NextResponse.json(
        {
          error: `Tổng điểm trắc nghiệm + tự luận phải đúng 100 điểm (hiện: ${totalPickedPoints}).`,
        },
        { status: 400 },
      )
    }

    const code = generateCode()
    const calculatedDurationMinutes = Math.max(
      1,
      Math.ceil(perQuestionMinutes.reduce((sum, m) => sum + (Number.isFinite(m) ? m : 0), 0))
    )
    const finalDurationMinutes = config.duration
    const calculatedMinutesPerQuestion = perQuestionMinutes.length > 0
      ? perQuestionMinutes.reduce((sum, m) => sum + (Number.isFinite(m) ? m : 0), 0) / perQuestionMinutes.length
      : weightedMinutesPerQuestion
    const sessionInsert = await insertExamSessionCreatePg({
      code,
      teacherId: user.id,
      title,
      examType,
      subjectId,
      gradeLevelId,
      classId,
      schoolId: finalSchoolId,
      durationMinutes: finalDurationMinutes,
      minutesPerQuestion: calculatedMinutesPerQuestion,
      config: {
        lessonTopics,
        difficulty,
        selectionMode,
        requestedQuizCount,
        requestedQuizByDifficulty,
        requestedEssayCount,
        quizMinutesEasy,
        quizMinutesMedium,
        quizMinutesHard,
        quizPointsEasy,
        quizPointsMedium,
        quizPointsHard,
        essayMinutesById,
        essayPointsById,
        calculatedDurationMinutes,
        finalDurationMinutes,
        classId,
        schoolId: finalSchoolId,
        practiceHomework,
        scoring: {
          quizPointsMax,
          essayPointsMax,
          quizCount: nQuiz,
          essayCount: nEssay,
          perQuestionWeights: true,
        },
      },
      practiceHomework,
    })

    if (!sessionInsert?.id) {
      console.error('[exam-session] Insert session failed')
      return NextResponse.json({ error: 'Tạo phiên thi thất bại.' }, { status: 500 })
    }
    const session = { id: sessionInsert.id }

    /** Trắc nghiệm luôn trên, tự luận dưới — chỉ xáo thứ tự trong từng nhóm */
    const quizzes = pickedQuestions.filter((q) => Array.isArray(q.options) && q.options.length >= 2)
    const essays = pickedQuestions.filter((q) => !Array.isArray(q.options) || q.options.length < 2)
    const orderedQuestions = [...shuffleArray(quizzes), ...shuffleArray(essays)]
    const inserts = orderedQuestions.map((q, idx) => ({
      question_text: q.question_text,
      options: Array.isArray(q.options) ? q.options : [],
      correct_index: typeof q.correct_index === 'number' ? q.correct_index : 0,
      order: idx,
      source: q.source,
      worksheet_question_id: q.worksheet_question_id ?? null,
      points: Number.isFinite(q.points) && q.points >= 0 ? q.points : 1,
    }))

    const questionsOk = await insertExamQuestionRowsPg(session.id, inserts)
    if (questionsOk !== true) {
      console.error('[exam-session] Insert questions failed')
      await deleteExamSessionByIdPg(session.id)
      return NextResponse.json({ error: 'Lưu câu hỏi thất bại.' }, { status: 500 })
    }

    const lineageOk = await setExamLineageRootToSelfPg(session.id)
    if (lineageOk !== true) {
      console.error('[exam-session] Set exam_lineage_root_id failed')
    }

    const examUrl = `${resolveBaseUrl(req)}/lam-bai/${code}`

    return NextResponse.json({
      success: true,
      code,
      examUrl,
      sessionId: session.id,
      totalQuestions: inserts.length,
      durationMinutes: finalDurationMinutes,
      classId,
      schoolId: finalSchoolId,
      className: String(cls.name ?? ''),
      schoolName: String(schoolRow.name ?? ''),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-session] Error:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
