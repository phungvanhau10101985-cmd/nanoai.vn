import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import Link from 'next/link'
import LopDetailClient from './lop-detail-client'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReturnType<typeof import('@/lib/seo').buildMetadata>> {
  const { id } = await params
  const supabase = createClient()
  const { data } = await supabase
    .from('classes')
    .select('name')
    .eq('id', id)
    .single()
  return buildMetadata({
    title: data?.name ? `${data.name} - Lớp học` : 'Lớp học',
    description: 'Chi tiết lớp học.',
    path: `/lop/${id}`,
    keywords: ['lớp học'],
  })
}

export default async function LopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const { data: cls, error } = await supabase
    .from('classes')
    .select('id, name, join_code, teacher_id, grade_level_id, school_id, schools(name)')
    .eq('id', id)
    .single()

  if (error || !cls) notFound()

  const isTeacher = cls.teacher_id === user.id

  const schoolName = String((Array.isArray(cls.schools) ? cls.schools[0]?.name : cls.schools?.name) ?? '').trim()

  const { data: members } = await supabase
    .from('class_members')
    .select(`
      user_id,
      profiles (full_name)
    `)
    .eq('class_id', id)

  const { data: worksheets } = isTeacher
    ? await supabase
        .from('class_worksheets')
        .select(`
          worksheet_id,
          worksheet_worksheets (id, topic)
        `)
        .eq('class_id', id)
    : await supabase
        .from('class_worksheets')
        .select(`
          worksheet_id,
          worksheet_worksheets (id, topic)
        `)
        .eq('class_id', id)

  let initialSubmissions: Array<{ id: string; worksheetId: string; worksheetTopic: string; studentName: string; quizScore: number; quizTotal: number; submittedAt: string }> = []
  let initialExamAttempts: Array<{ id: string; examTitle: string; studentName: string; score: number; maxScore: number; submittedAt: string }> = []
  if (isTeacher) {
    const { data: subs } = await supabase
      .from('worksheet_submissions')
      .select('id, worksheet_id, user_id, quiz_score, quiz_total, submitted_at')
      .eq('class_id', id)
      .order('submitted_at', { ascending: false })
    const userIds = Array.from(new Set((subs ?? []).map((s: { user_id: string }) => s.user_id)))
    const wsIds = Array.from(new Set((subs ?? []).map((s: { worksheet_id: string }) => s.worksheet_id)))
    const [{ data: profs }, { data: wss }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] },
      wsIds.length ? supabase.from('worksheet_worksheets').select('id, topic').in('id', wsIds) : { data: [] },
    ])
    const profMap = Object.fromEntries((profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? '—']))
    const wsMap = Object.fromEntries((wss ?? []).map((w: { id: string; topic: string }) => [w.id, w.topic]))
    initialSubmissions = (subs ?? []).map((s: { id: string; worksheet_id: string; user_id: string; quiz_score: number; quiz_total: number; submitted_at: string }) => ({
      id: s.id,
      worksheetId: s.worksheet_id,
      worksheetTopic: wsMap[s.worksheet_id] ?? '—',
      studentName: profMap[s.user_id] ?? '—',
      quizScore: s.quiz_score,
      quizTotal: s.quiz_total,
      submittedAt: s.submitted_at,
    }))

    const { data: examSessions } = await supabase
      .from('exam_sessions')
      .select('id, title')
      .eq('class_id', id)
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
    const sessionIds = (examSessions ?? []).map((x: { id: string }) => x.id)
    if (sessionIds.length > 0) {
      const { data: attempts } = await supabase
        .from('exam_attempts')
        .select('id, session_id, user_id, student_name, score, max_score, submitted_at')
        .in('session_id', sessionIds)
        .order('submitted_at', { ascending: false })
        .limit(500)
      const attemptUserIds = Array.from(new Set((attempts ?? []).map((a: { user_id: string | null }) => a.user_id).filter(Boolean) as string[]))
      const { data: attemptProfiles } = attemptUserIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', attemptUserIds)
        : { data: [] }
      const sessionTitleMap = Object.fromEntries((examSessions ?? []).map((x: { id: string; title: string | null }) => [x.id, x.title ?? 'Bài thi']))
      const profileMap = Object.fromEntries((attemptProfiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? '—']))
      initialExamAttempts = (attempts ?? []).map((a: { id: string; session_id: string; user_id: string | null; student_name: string | null; score: number; max_score: number; submitted_at: string }) => ({
        id: a.id,
        examTitle: sessionTitleMap[a.session_id] ?? 'Bài thi',
        studentName: a.student_name || (a.user_id ? profileMap[a.user_id] ?? '—' : '—'),
        score: Number(a.score ?? 0),
        maxScore: Number(a.max_score ?? 0),
        submittedAt: a.submitted_at,
      }))
    }
  }

  const { t } = await getServerDictionary()

  return (
    <div className="app-shell min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/lop" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← {t.classes.backToList}
        </Link>

        <LopDetailClient
          cls={{
            id: cls.id,
            name: cls.name,
            join_code: cls.join_code,
            gradeLevelId: cls.grade_level_id ?? null,
            schoolName,
          }}
          isTeacher={isTeacher}
          members={(members ?? []).map((m) => {
            const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
            return { userId: m.user_id, name: p?.full_name ?? '—' }
          })}
          worksheets={(worksheets ?? [])
            .filter((w) => w.worksheet_worksheets != null)
            .map((w) => {
              const ws = Array.isArray(w.worksheet_worksheets) ? w.worksheet_worksheets[0] : w.worksheet_worksheets
              return ws ? { id: ws.id, topic: ws.topic } : null
            })
            .filter((x): x is { id: string; topic: string } => x != null)}
          initialSubmissions={initialSubmissions}
          initialExamAttempts={initialExamAttempts}
          t={t.classes}
        />
      </div>
    </div>
  )
}
