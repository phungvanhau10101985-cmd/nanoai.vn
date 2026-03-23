import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import Link from 'next/link'
import LopDetailClient from './lop-detail-client'
import { SUBJECTS } from '@/app/tao-giao-trinh/lib/curriculum-subjects'

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

  type SchoolRel = { name?: string | null } | null | undefined
  const schoolsRel = cls.schools as SchoolRel | SchoolRel[]
  const schoolName = String((Array.isArray(schoolsRel) ? schoolsRel[0]?.name : schoolsRel?.name) ?? '').trim()
  const subjectLabelMap = new Map<string, string>(SUBJECTS.map((s) => [s.id, s.labelVi]))
  const { data: classExamSubjects } = await supabase
    .from('exam_sessions')
    .select('subject_id')
    .eq('class_id', id)
    .not('subject_id', 'is', null)
    .limit(300)
  const subjectNames = Array.from(
    new Set(
      (classExamSubjects ?? [])
        .map((x: { subject_id?: string | null }) => String(x.subject_id ?? '').trim())
        .filter(Boolean)
        .map((sid) => subjectLabelMap.get(sid) ?? sid)
    )
  )

  const { data: members } = await supabase
    .from('class_members')
    .select(`
      user_id,
      profiles (full_name)
    `)
    .eq('class_id', id)

  const baseMembers = (members ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    return { userId: m.user_id, name: p?.full_name ?? '—' }
  })

  let mergedMembers = baseMembers
  let initialSubmissions: Array<{ id: string; worksheetId: string; worksheetTopic: string; studentName: string; quizScore: number; quizTotal: number; submittedAt: string }> = []
  let initialExamAttempts: Array<{ id: string; sessionId: string; examCode: string; examTitle: string; studentName: string; score: number; maxScore: number; submittedAt: string }> = []
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
      .select('id, code, title')
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
      const sessionMetaMap = Object.fromEntries(
        (examSessions ?? []).map((x: { id: string; code: string | null; title: string | null }) => [
          x.id,
          { code: x.code ?? '', title: x.title ?? 'Bài thi' },
        ])
      )
      const profileMap = Object.fromEntries((attemptProfiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? '—']))
      initialExamAttempts = (attempts ?? []).map((a: { id: string; session_id: string; user_id: string | null; student_name: string | null; score: number; max_score: number; submitted_at: string }) => ({
        id: a.id,
        sessionId: a.session_id,
        examCode: sessionMetaMap[a.session_id]?.code ?? '',
        examTitle: sessionMetaMap[a.session_id]?.title ?? 'Bài thi',
        studentName: a.student_name || (a.user_id ? profileMap[a.user_id] ?? '—' : '—'),
        score: Number(a.score ?? 0),
        maxScore: Number(a.max_score ?? 0),
        submittedAt: a.submitted_at,
      }))

      /** Học sinh đã nộp đề thi nhưng có thể chưa có trong class_members — hiển thị luôn trong danh sách lớp */
      const seenIds = new Set(baseMembers.map((m) => m.userId))
      const extras: Array<{ userId: string; name: string }> = []
      for (const a of attempts ?? []) {
        const uid = a.user_id ? String(a.user_id) : ''
        if (uid) {
          if (seenIds.has(uid)) continue
          seenIds.add(uid)
          const nm = String(a.student_name ?? '').trim()
          extras.push({ userId: uid, name: nm || profileMap[uid] || '—' })
        } else {
          const nm = String(a.student_name ?? '').trim()
          if (!nm) continue
          const synthetic = `exam-attempt:${a.id}`
          if (seenIds.has(synthetic)) continue
          seenIds.add(synthetic)
          extras.push({ userId: synthetic, name: nm })
        }
      }
      if (extras.length > 0) {
        mergedMembers = [...baseMembers, ...extras]
      }
    }
  }

  const { t } = await getServerDictionary()

  return (
    <div className="app-shell min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8 lg:max-w-3xl lg:px-6 lg:py-10">
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
            subjectNames,
          }}
          isTeacher={isTeacher}
          members={mergedMembers}
          initialSubmissions={initialSubmissions}
          initialExamAttempts={initialExamAttempts}
          t={t.classes}
        />
      </div>
    </div>
  )
}
