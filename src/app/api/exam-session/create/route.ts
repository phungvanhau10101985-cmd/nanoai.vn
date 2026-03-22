import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getEssayProblem } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

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
  return requestOrigin.startsWith('http') ? requestOrigin : 'https://nanoai.vn'
}

/** Tạo phiên thi – lấy câu hỏi từ DB theo topic, thiếu thì bỏ qua (không AI tạo). */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tạo bài thi.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const body = await req.json().catch(() => ({}))
    const examType = String(body?.examType ?? '15ph').toLowerCase()
    const config = EXAM_TYPE_CONFIG[examType] ?? EXAM_TYPE_CONFIG['15ph']
    const subjectId = String(body?.subjectId ?? 'toan').trim()
    const gradeLevelId = String(body?.gradeLevelId ?? 'lop-12').trim()
    const classId = String(body?.classId ?? '').trim()
    const requestedSchoolId = String(body?.schoolId ?? '').trim()
    let lessonTopics: string[] = Array.isArray(body?.lessonTopics) ? (body.lessonTopics as string[]).map(String).filter(Boolean) : []
    const curriculumIds = Array.isArray(body?.curriculumIds) ? (body.curriculumIds as string[]).map(String).filter(Boolean) : []
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    if (curriculumIds.length > 0 && lessonTopics.length === 0) {
      const { data: curricula } = await adminSupabase
        .from('worksheet_curricula')
        .select('lesson_topics')
        .in('id', curriculumIds)
      const topics = new Set<string>()
      for (const c of curricula ?? []) {
        const t = c?.lesson_topics
        if (Array.isArray(t)) for (const x of t) if (typeof x === 'string' && x.trim()) topics.add(x.trim())
      }
      lessonTopics = [...topics]
    }
    const title = String(body?.title ?? 'Bài thi').trim() || 'Bài thi'
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
    }
    const pickedQuestions: NewExamQuestion[] = []

    if (!classId) {
      return NextResponse.json({ error: 'Vui lòng chọn lớp cho bài thi.' }, { status: 400 })
    }

    const { data: cls, error: clsErr } = await adminSupabase
      .from('classes')
      .select('id, teacher_id, name, school_id, grade_level_id')
      .eq('id', classId)
      .single()
    if (clsErr || !cls) {
      return NextResponse.json({ error: 'Không tìm thấy lớp đã chọn.' }, { status: 404 })
    }
    if (String(cls.teacher_id ?? '') !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền dùng lớp này.' }, { status: 403 })
    }

    const finalSchoolId = requestedSchoolId || String(cls.school_id ?? '').trim()
    if (!finalSchoolId) {
      return NextResponse.json({ error: 'Vui lòng chọn trường trước khi tạo bài thi.' }, { status: 400 })
    }
    const { data: schoolRow } = await adminSupabase
      .from('schools')
      .select('id, name')
      .eq('id', finalSchoolId)
      .maybeSingle()
    if (!schoolRow) {
      return NextResponse.json({ error: 'Không tìm thấy trường đã chọn.' }, { status: 404 })
    }
    if (String(cls.school_id ?? '').trim() && String(cls.school_id ?? '').trim() !== finalSchoolId) {
      return NextResponse.json({ error: 'Lớp đã gắn với trường khác. Vui lòng chọn đúng trường của lớp.' }, { status: 400 })
    }
    if (!String(cls.school_id ?? '').trim()) {
      await adminSupabase
        .from('classes')
        .update({ school_id: finalSchoolId, grade_level_id: gradeLevelId || null })
        .eq('id', classId)
    } else if (gradeLevelId && String(cls.grade_level_id ?? '').trim() !== gradeLevelId) {
      await adminSupabase
        .from('classes')
        .update({ grade_level_id: gradeLevelId })
        .eq('id', classId)
    }

    const allowedQuestionIds = new Set<string>()
    if (curriculumIds.length > 0) {
      const { data: worksheets } = await adminSupabase
        .from('worksheet_worksheets')
        .select('question_ids')
        .in('curriculum_id', curriculumIds)
      for (const ws of worksheets ?? []) {
        for (const qid of ((ws.question_ids ?? []) as string[])) {
          if (qid) allowedQuestionIds.add(String(qid))
        }
      }
      const { data: directRows } = await adminSupabase
        .from('worksheet_questions')
        .select('id')
        .in('curriculum_id', curriculumIds)
      for (const row of directRows ?? []) {
        if (row.id) allowedQuestionIds.add(String(row.id))
      }
    }
    const scopedQuizIds = allowedQuestionIds.size > 0
      ? selectedQuizQuestionIds.filter((id) => allowedQuestionIds.has(id))
      : selectedQuizQuestionIds
    const scopedEssayIds = allowedQuestionIds.size > 0
      ? selectedEssayQuestionIds.filter((id) => allowedQuestionIds.has(id))
      : selectedEssayQuestionIds

    if (selectionMode === 'manual' && scopedQuizIds.length > 0) {
      const { data: selectedRows, error: selectedErr } = await adminSupabase
        .from('worksheet_questions')
        .select('id, type, difficulty, content_json')
        .in('id', scopedQuizIds)
        .eq('type', 'quiz')
      if (selectedErr) return NextResponse.json({ error: selectedErr.message }, { status: 500 })
      const byId = new Map((selectedRows ?? []).map((r) => [String(r.id), r]))
      const selectedByDifficulty = { easy: 0, medium: 0, hard: 0 }
      for (const qid of scopedQuizIds) {
        const row = byId.get(qid)
        if (!row) continue
        const quiz = normalizeQuizFromContentJson(row.content_json)
        if (!quiz) continue
        const diff = normalizeDifficulty(String((row as { difficulty?: unknown }).difficulty ?? ''))
        selectedByDifficulty[diff] += 1
        pickedQuestions.push({
          question_text: quiz.question,
          options: quiz.options,
          correct_index: quiz.correctIndex,
          source: 'worksheet_quiz',
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
        const { data: poolRows, error: poolErr } = await adminSupabase
          .from('worksheet_questions')
          .select('id, type, difficulty, content_json')
          .in('id', scopedQuizIds)
          .eq('type', 'quiz')
        if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 })
        const pool = (poolRows ?? []).map((r) => {
          const quiz = normalizeQuizFromContentJson(r.content_json)
          const diff = String((r as { difficulty?: unknown }).difficulty ?? '')
          if (!quiz) return null
          return {
            question_text: quiz.question,
            options: quiz.options,
            correct_index: quiz.correctIndex,
            source: 'worksheet_quiz' as const,
            difficulty: diff,
          }
        }).filter(Boolean) as Array<{
          question_text: string
          options: string[]
          correct_index: number
          source: 'worksheet_quiz'
          difficulty: string
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
        pickedQuestions.push(...picked)
        for (const item of picked) {
          perQuestionMinutes.push(
            quizMinutesForDifficulty(item.difficulty, {
              easy: quizMinutesEasy,
              medium: quizMinutesMedium,
              hard: quizMinutesHard,
            })
          )
        }
      } else {
        let q = adminSupabase
          .from('worksheet_official_questions')
          .select('question_text, options, correct_index, difficulty')
          .eq('subject_id', subjectId)
          .eq('grade_level_id', gradeLevelId)

        if (lessonTopics.length >= 1) {
          q = q.not('topic_normalized', 'is', null).in('topic_normalized', lessonTopics)
        }
        if (difficulty) {
          q = q.eq('difficulty', difficulty)
        }

        const { data: officialRows } = await q.limit(Math.max(30, requestedQuizCount * 4))
        const pool = (officialRows ?? []).map((r) => ({
          question_text: String(r.question_text ?? '').trim(),
          options: Array.isArray(r.options) ? r.options.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 4) : [],
          correct_index: typeof r.correct_index === 'number' ? r.correct_index : Number(r.correct_index ?? 0),
          source: 'official' as const,
          difficulty: String((r as { difficulty?: unknown }).difficulty ?? ''),
        })).filter((r) => r.question_text && r.options.length >= 2)
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
        const picked = [
          ...easyPool.slice(0, requestedQuizByDifficulty.easy),
          ...mediumPool.slice(0, requestedQuizByDifficulty.medium),
          ...hardPool.slice(0, requestedQuizByDifficulty.hard),
        ]
        pickedQuestions.push(
          ...picked.map((qz) => ({
            question_text: qz.question_text,
            options: qz.options,
            correct_index: Number.isFinite(qz.correct_index) ? Math.max(0, Math.min(3, Math.floor(qz.correct_index))) : 0,
            source: 'official',
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
      const { data: selectedEssayRows, error: essayErr } = await adminSupabase
        .from('worksheet_questions')
        .select('id, type, content_json')
        .in('id', scopedEssayIds)
        .eq('type', 'essay')
      if (essayErr) return NextResponse.json({ error: essayErr.message }, { status: 500 })
      const byEssayId = new Map((selectedEssayRows ?? []).map((r) => [String(r.id), r]))
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

    const code = generateCode()
    const calculatedDurationMinutes = Math.max(
      1,
      Math.ceil(perQuestionMinutes.reduce((sum, m) => sum + (Number.isFinite(m) ? m : 0), 0))
    )
    const finalDurationMinutes = config.duration
    const calculatedMinutesPerQuestion = perQuestionMinutes.length > 0
      ? perQuestionMinutes.reduce((sum, m) => sum + (Number.isFinite(m) ? m : 0), 0) / perQuestionMinutes.length
      : weightedMinutesPerQuestion
    const { data: session, error: sessionErr } = await adminSupabase
      .from('exam_sessions')
      .insert({
        code,
        teacher_id: user.id,
        title,
        exam_type: examType,
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        class_id: classId,
        school_id: finalSchoolId,
        duration_minutes: finalDurationMinutes,
        minutes_per_question: calculatedMinutesPerQuestion,
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
          essayMinutesById,
          calculatedDurationMinutes,
          finalDurationMinutes,
          classId,
          schoolId: finalSchoolId,
        },
        status: 'active',
      })
      .select('id')
      .single()

    if (sessionErr || !session?.id) {
      console.error('[exam-session] Insert session failed:', sessionErr?.message)
      return NextResponse.json({ error: 'Tạo phiên thi thất bại.' }, { status: 500 })
    }

    const questionOrder = pickedQuestions.map((_, i) => i)
    for (let i = questionOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questionOrder[i], questionOrder[j]] = [questionOrder[j], questionOrder[i]]
    }

    const orderedQuestions = questionOrder.map((i) => pickedQuestions[i])
    const inserts = orderedQuestions.map((q, idx) => ({
      session_id: session.id,
      question_text: q.question_text,
      options: Array.isArray(q.options) ? q.options : [],
      correct_index: typeof q.correct_index === 'number' ? q.correct_index : 0,
      order: idx,
      source: q.source,
    }))

    const { error: questionsErr } = await adminSupabase.from('exam_questions').insert(inserts)
    if (questionsErr) {
      console.error('[exam-session] Insert questions failed:', questionsErr.message)
      await adminSupabase.from('exam_sessions').delete().eq('id', session.id)
      return NextResponse.json({ error: 'Lưu câu hỏi thất bại.' }, { status: 500 })
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
