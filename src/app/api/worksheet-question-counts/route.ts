/**
 * Đếm số câu theo loại/difficulty cho giáo trình.
 * Giới hạn: quiz mỗi difficulty 10, essay mỗi bloom 6.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

const QUIZ_LIMIT = 10
const ESSAY_LIMIT = 6

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const curriculumId = searchParams.get('curriculumId')?.trim()
    if (!curriculumId) return NextResponse.json({ error: 'Thiếu curriculumId.' }, { status: 400 })

    const { data: ws } = await supabase
      .from('worksheet_worksheets')
      .select('question_ids')
      .eq('curriculum_id', curriculumId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const qIds = ((ws?.question_ids ?? []) as string[]).filter(Boolean)
    if (qIds.length === 0) {
      return NextResponse.json({
        quiz: { easy: 0, medium: 0, hard: 0 },
        essay: { 'nhan-biet': 0, 'thong-hieu': 0, 'van-dung-thap': 0, 'van-dung-cao': 0, 'thuc-te': 0 },
        limits: { quiz: QUIZ_LIMIT, essay: ESSAY_LIMIT },
      })
    }

    const { data: rows } = await supabase
      .from('worksheet_questions')
      .select('type, difficulty')
      .in('id', qIds)

    const quiz: Record<string, number> = { easy: 0, medium: 0, hard: 0 }
    const essay: Record<string, number> = {
      'nhan-biet': 0,
      'thong-hieu': 0,
      'van-dung-thap': 0,
      'van-dung-cao': 0,
      'thuc-te': 0,
    }

    for (const r of rows ?? []) {
      const d = (r.difficulty ?? 'medium') as string
      if (r.type === 'quiz') {
        const key = ['easy', 'medium', 'hard'].includes(d) ? d : 'medium'
        quiz[key] = (quiz[key] ?? 0) + 1
      } else if (r.type === 'essay') {
        const key = essay.hasOwnProperty(d) ? d : 'thong-hieu'
        essay[key] = (essay[key] ?? 0) + 1
      }
    }

    return NextResponse.json({
      quiz: { easy: quiz.easy ?? 0, medium: quiz.medium ?? 0, hard: quiz.hard ?? 0 },
      essay,
      limits: { quiz: QUIZ_LIMIT, essay: ESSAY_LIMIT },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
