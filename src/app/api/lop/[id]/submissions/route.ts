import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: classId } = await params
  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const { data: cls } = await supabase
    .from('classes')
    .select('teacher_id')
    .eq('id', classId)
    .single()

  if (!cls || cls.teacher_id !== auth.user.id) {
    return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 })
  }

  const { data: submissions, error } = await supabase
    .from('worksheet_submissions')
    .select('id, worksheet_id, user_id, quiz_score, quiz_total, submitted_at')
    .eq('class_id', classId)
    .order('submitted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = Array.from(new Set((submissions ?? []).map((s: { user_id: string }) => s.user_id)))
  const wsIds = Array.from(new Set((submissions ?? []).map((s: { worksheet_id: string }) => s.worksheet_id)))

  const [{ data: profs }, { data: worksheets }] = await Promise.all([
    userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] },
    wsIds.length ? supabase.from('worksheet_worksheets').select('id, topic').in('id', wsIds) : { data: [] },
  ])

  const profMap = Object.fromEntries((profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? '—']))
  const wsMap = Object.fromEntries((worksheets ?? []).map((w: { id: string; topic: string }) => [w.id, w.topic]))

  const items = (submissions ?? []).map((s: { id: string; worksheet_id: string; user_id: string; quiz_score: number; quiz_total: number; submitted_at: string }) => ({
    id: s.id,
    worksheetId: s.worksheet_id,
    worksheetTopic: wsMap[s.worksheet_id] ?? '—',
    userId: s.user_id,
    studentName: profMap[s.user_id] ?? '—',
    quizScore: s.quiz_score,
    quizTotal: s.quiz_total,
    submittedAt: s.submitted_at,
  }))

  return NextResponse.json({ items })
}
