import type { SupabaseClient } from '@supabase/supabase-js'
import { SUBJECTS } from '@/app/tao-giao-trinh/lib/curriculum-subjects'
import { parseExamGradingMeta } from '@/lib/exam-feedback'

export type ClassMemberPayload = {
  userId: string
  name: string
  birthDate: string | null
  kind: 'student' | 'teacher_member'
  removable: boolean
}

export type ExamAttemptPayload = {
  id: string
  sessionId: string
  examCode: string
  examTitle: string
  studentName: string
  userId: string | null
  score: number
  maxScore: number
  submittedAt: string
  gradingMeta: ReturnType<typeof parseExamGradingMeta>
  /** Phiên bài tập về nhà — HS không xem điểm công khai */
  practiceHomework: boolean
}

export type ExamSessionPayload = {
  id: string
  code: string
  title: string
  createdAt: string | null
  status?: string
  practiceHomework: boolean
}

export type ClassDetailPayload = {
  cls: {
    id: string
    name: string
    join_code: string
    teacher_id: string
    grade_level_id: string | null
    subject_label: string | null
    teacher_display_name: string | null
  }
  isTeacher: boolean
  schoolName: string
  subjectNames: string[]
  members: ClassMemberPayload[]
  initialExamAttempts: ExamAttemptPayload[]
  initialExamSessions: ExamSessionPayload[]
}

type SchoolRel = { name?: string | null } | null | undefined

export async function loadClassDetailPayload(
  supabase: SupabaseClient,
  classId: string,
  userId: string
): Promise<ClassDetailPayload | null> {
  const { data: cls, error } = await supabase
    .from('classes')
    .select('id, name, join_code, teacher_id, grade_level_id, school_id, subject_label, teacher_display_name, schools(name)')
    .eq('id', classId)
    .single()

  if (error || !cls) return null

  const isTeacher = cls.teacher_id === userId
  const schoolsRel = cls.schools as SchoolRel | SchoolRel[]
  const schoolName = String((Array.isArray(schoolsRel) ? schoolsRel[0]?.name : schoolsRel?.name) ?? '').trim()
  const subjectLabelMap = new Map<string, string>(SUBJECTS.map((s) => [s.id, s.labelVi]))
  const { data: classExamSubjects } = await supabase
    .from('exam_sessions')
    .select('subject_id')
    .eq('class_id', classId)
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

  const { data: memberRows } = await supabase
    .from('class_members')
    .select('user_id, member_display_name, birth_date')
    .eq('class_id', classId)
  const baseMembers: ClassMemberPayload[] = (memberRows ?? []).map(
    (m: { user_id: string; member_display_name: string | null; birth_date: string | null }) => {
      const kind = m.user_id === cls.teacher_id ? ('teacher_member' as const) : ('student' as const)
      const display = String(m.member_display_name ?? '').trim()
      return {
        userId: m.user_id,
        name: display || '—',
        birthDate: m.birth_date,
        kind,
        removable: isTeacher && kind === 'student' && m.user_id !== cls.teacher_id,
      }
    }
  )

  let mergedMembers = baseMembers
  let initialExamAttempts: ExamAttemptPayload[] = []
  let initialExamSessions: ExamSessionPayload[] = []

  if (isTeacher) {
    const { data: examSessions } = await supabase
      .from('exam_sessions')
      .select('id, code, title, created_at, is_practice_homework')
      .eq('class_id', classId)
      .eq('teacher_id', userId)
      .order('created_at', { ascending: false })
      .limit(200)
    initialExamSessions = (examSessions ?? []).map(
      (x: {
        id: string
        code: string | null
        title: string | null
        created_at?: string | null
        is_practice_homework?: boolean | null
      }) => ({
        id: x.id,
        code: String(x.code ?? '').trim(),
        title: String(x.title ?? '').trim() || 'Bài thi',
        createdAt: x.created_at != null ? String(x.created_at) : null,
        practiceHomework: Boolean(x.is_practice_homework),
      })
    )
    const sessionIds = (examSessions ?? []).map((x: { id: string }) => x.id)
    if (sessionIds.length > 0) {
      const { data: attempts } = await supabase
        .from('exam_attempts')
        .select('id, session_id, user_id, student_name, score, max_score, submitted_at, grading_meta')
        .in('session_id', sessionIds)
        .order('submitted_at', { ascending: false })
        .limit(500)
      const attemptUserIds = Array.from(new Set((attempts ?? []).map((a: { user_id: string | null }) => a.user_id).filter(Boolean) as string[]))
      const { data: attemptProfiles } = attemptUserIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', attemptUserIds)
        : { data: [] }
      const sessionMetaMap = Object.fromEntries(
        (examSessions ?? []).map(
          (x: {
            id: string
            code: string | null
            title: string | null
            is_practice_homework?: boolean | null
          }) => [
            x.id,
            {
              code: x.code ?? '',
              title: x.title ?? 'Bài thi',
              practiceHomework: Boolean(x.is_practice_homework),
            },
          ]
        )
      )
      const profileMap = Object.fromEntries((attemptProfiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? '—']))
      initialExamAttempts = (attempts ?? []).map(
        (a: {
          id: string
          session_id: string
          user_id: string | null
          student_name: string | null
          score: number
          max_score: number
          submitted_at: string
          grading_meta: unknown
        }) => ({
          id: a.id,
          sessionId: a.session_id,
          examCode: sessionMetaMap[a.session_id]?.code ?? '',
          examTitle: sessionMetaMap[a.session_id]?.title ?? 'Bài thi',
          studentName: a.student_name || (a.user_id ? profileMap[a.user_id] ?? '—' : '—'),
          userId: a.user_id ? String(a.user_id) : null,
          score: Number(a.score ?? 0),
          maxScore: Number(a.max_score ?? 0),
          submittedAt: a.submitted_at,
          gradingMeta: parseExamGradingMeta(a.grading_meta),
          practiceHomework: Boolean(sessionMetaMap[a.session_id]?.practiceHomework),
        })
      )

      const seenIds = new Set(baseMembers.map((m) => m.userId))
      const extras: ClassMemberPayload[] = []
      for (const a of attempts ?? []) {
        const uid = a.user_id ? String(a.user_id) : ''
        if (uid) {
          if (seenIds.has(uid)) continue
          seenIds.add(uid)
          const nm = String(a.student_name ?? '').trim()
          extras.push({
            userId: uid,
            name: nm || profileMap[uid] || '—',
            birthDate: null,
            kind: 'student',
            removable: false,
          })
        } else {
          const nm = String(a.student_name ?? '').trim()
          if (!nm) continue
          const synthetic = `exam-attempt:${a.id}`
          if (seenIds.has(synthetic)) continue
          seenIds.add(synthetic)
          extras.push({ userId: synthetic, name: nm, birthDate: null, kind: 'student', removable: false })
        }
      }
      if (extras.length > 0) {
        mergedMembers = [...baseMembers, ...extras]
      }
    }
  } else if (baseMembers.some((m) => m.userId === userId)) {
    const { data: sessionsForStudent } = await supabase
      .from('exam_sessions')
      .select('id, code, title, created_at, status, is_practice_homework')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(200)
    initialExamSessions = (sessionsForStudent ?? []).map(
      (x: {
        id: string
        code: string | null
        title: string | null
        created_at?: string | null
        status?: string | null
        is_practice_homework?: boolean | null
      }) => ({
        id: x.id,
        code: String(x.code ?? '').trim(),
        title: String(x.title ?? '').trim() || 'Bài thi',
        createdAt: x.created_at != null ? String(x.created_at) : null,
        status: x.status != null ? String(x.status) : 'active',
        practiceHomework: Boolean(x.is_practice_homework),
      })
    )
    const sessionIds = (sessionsForStudent ?? []).map((x: { id: string }) => x.id)
    if (sessionIds.length > 0) {
      const { data: myAttempts } = await supabase
        .from('exam_attempts')
        .select('id, session_id, user_id, student_name, score, max_score, submitted_at, grading_meta')
        .eq('user_id', userId)
        .in('session_id', sessionIds)
      const sessionMetaMap = Object.fromEntries(
        (sessionsForStudent ?? []).map(
          (x: {
            id: string
            code: string | null
            title: string | null
            is_practice_homework?: boolean | null
          }) => [
            x.id,
            {
              code: x.code ?? '',
              title: x.title ?? 'Bài thi',
              practiceHomework: Boolean(x.is_practice_homework),
            },
          ]
        )
      )
      initialExamAttempts = (myAttempts ?? []).map(
        (a: {
          id: string
          session_id: string
          user_id: string | null
          student_name: string | null
          score: number
          max_score: number
          submitted_at: string
          grading_meta: unknown
        }) => ({
          id: a.id,
          sessionId: a.session_id,
          examCode: String(sessionMetaMap[a.session_id]?.code ?? '').trim(),
          examTitle: String(sessionMetaMap[a.session_id]?.title ?? 'Bài thi').trim() || 'Bài thi',
          studentName: String(a.student_name ?? '').trim(),
          userId: a.user_id ? String(a.user_id) : null,
          score: Number(a.score ?? 0),
          maxScore: Number(a.max_score ?? 0),
          submittedAt: a.submitted_at,
          gradingMeta: parseExamGradingMeta(a.grading_meta),
          practiceHomework: Boolean(sessionMetaMap[a.session_id]?.practiceHomework),
        })
      )
    }
  }

  return {
    cls: {
      id: cls.id,
      name: cls.name,
      join_code: cls.join_code,
      teacher_id: cls.teacher_id,
      grade_level_id: cls.grade_level_id ?? null,
      subject_label: (cls as { subject_label?: string | null }).subject_label ?? null,
      teacher_display_name: (cls as { teacher_display_name?: string | null }).teacher_display_name ?? null,
    },
    isTeacher,
    schoolName,
    subjectNames,
    members: mergedMembers,
    initialExamAttempts,
    initialExamSessions,
  }
}
