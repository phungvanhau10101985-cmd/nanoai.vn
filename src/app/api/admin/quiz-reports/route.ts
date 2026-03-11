import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

/** Admin: danh sách báo cáo câu hỏi sai chờ duyệt */
export async function GET() {
  try {
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', authResult.user!.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ quản trị viên mới được xem.' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('quiz_question_reports')
      .select('id, curriculum_id, user_id, slide_index, block_index, quiz_marker, slide_content, slide_title, report_count, status, ai_reasoning, ai_model_used, created_at, updated_at')
      .eq('status', 'admin_pending')
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ items: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[admin/quiz-reports] GET:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
