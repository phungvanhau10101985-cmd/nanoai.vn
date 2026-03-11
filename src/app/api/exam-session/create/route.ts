import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

    const totalQuestions = Math.max(1, Math.floor(config.duration / config.minutesPerQuestion))

    let q = adminSupabase
      .from('worksheet_official_questions')
      .select('question_text, options, correct_index')
      .eq('subject_id', subjectId)
      .eq('grade_level_id', gradeLevelId)

    if (lessonTopics.length >= 1) {
      q = q.not('topic_normalized', 'is', null).in('topic_normalized', lessonTopics)
    }
    if (difficulty) {
      q = q.eq('difficulty', difficulty)
    }

    const { data: officialRows } = await q.limit(totalQuestions * 3)
    const pool = officialRows ?? []
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, totalQuestions)

    if (shuffled.length < totalQuestions) {
      const fallback = await adminSupabase
        .from('worksheet_official_questions')
        .select('question_text, options, correct_index')
        .eq('subject_id', subjectId)
        .eq('grade_level_id', gradeLevelId)
        .limit((totalQuestions - shuffled.length) * 2)
      const { data: extra } = await fallback
      const extraList = extra ?? []
      const usedTexts = new Set(shuffled.map((r) => r.question_text))
      for (const r of extraList) {
        if (shuffled.length >= totalQuestions) break
        if (!usedTexts.has(r.question_text)) {
          usedTexts.add(r.question_text)
          shuffled.push(r)
        }
      }
    }

    if (shuffled.length === 0) {
      return NextResponse.json(
        { error: 'Không có câu hỏi phù hợp trong ngân hàng. Vui lòng tạo câu hỏi trước (Tạo câu hỏi trên slide).' },
        { status: 400 }
      )
    }

    const code = generateCode()
    const { data: session, error: sessionErr } = await adminSupabase
      .from('exam_sessions')
      .insert({
        code,
        teacher_id: user.id,
        title,
        exam_type: examType,
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        duration_minutes: config.duration,
        minutes_per_question: config.minutesPerQuestion,
        config: { lessonTopics, difficulty },
        status: 'active',
      })
      .select('id')
      .single()

    if (sessionErr || !session?.id) {
      console.error('[exam-session] Insert session failed:', sessionErr?.message)
      return NextResponse.json({ error: 'Tạo phiên thi thất bại.' }, { status: 500 })
    }

    const questionOrder = shuffled.map((_, i) => i)
    for (let i = questionOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questionOrder[i], questionOrder[j]] = [questionOrder[j], questionOrder[i]]
    }

    const orderedQuestions = questionOrder.map((i) => shuffled[i])
    const inserts = orderedQuestions.map((q, idx) => ({
      session_id: session.id,
      question_text: q.question_text,
      options: Array.isArray(q.options) ? q.options : [],
      correct_index: q.correct_index ?? 0,
      order: idx,
      source: 'official',
    }))

    const { error: questionsErr } = await adminSupabase.from('exam_questions').insert(inserts)
    if (questionsErr) {
      console.error('[exam-session] Insert questions failed:', questionsErr.message)
      await adminSupabase.from('exam_sessions').delete().eq('id', session.id)
      return NextResponse.json({ error: 'Lưu câu hỏi thất bại.' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://nanoai.vn'
    const examUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/lam-bai/${code}`

    return NextResponse.json({
      success: true,
      code,
      examUrl,
      sessionId: session.id,
      totalQuestions: inserts.length,
      durationMinutes: config.duration,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-session] Error:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
