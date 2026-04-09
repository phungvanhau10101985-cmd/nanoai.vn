import { SUBJECTS } from '@/app/tao-giao-trinh/lib/curriculum-subjects'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
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

function birthDateOnly(v: unknown): string | null {
  if (v == null) return null
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s : null
}

function tsIso(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

/**
 * Payload trang chi tiết lớp — Postgres (`DATABASE_URL`).
 */
export async function loadClassDetailPayload(
  classId: string,
  userId: string
): Promise<ClassDetailPayload | null> {
  if (!isPgConfigured()) return null

  try {
    const cls = await pgQueryOne<{
      id: string
      name: string | null
      join_code: string | null
      teacher_id: string
      grade_level_id: string | null
      subject_label: string | null
      teacher_display_name: string | null
      school_name: string | null
    }>(
      `select c.id::text, c.name, c.join_code, c.teacher_id::text, c.grade_level_id, c.subject_label,
              c.teacher_display_name, sch.name as school_name
       from public.classes c
       left join public.schools sch on sch.id = c.school_id
       where c.id = $1::uuid
       limit 1`,
      [classId]
    )
    if (!cls) return null

    const isTeacher = cls.teacher_id === userId
    const schoolName = String(cls.school_name ?? '').trim()

    const subjectLabelMap = new Map<string, string>(SUBJECTS.map((s) => [s.id, s.labelVi]))
    const subjRows = await pgQuery<{ subject_id: string | null }>(
      `select distinct subject_id::text as subject_id
       from public.exam_sessions
       where class_id = $1::uuid and subject_id is not null
       limit 300`,
      [classId]
    )
    const subjectNames = Array.from(
      new Set(
        subjRows
          .map((x) => String(x.subject_id ?? '').trim())
          .filter(Boolean)
          .map((sid) => subjectLabelMap.get(sid) ?? sid)
      )
    )

    const memberRows = await pgQuery<{
      user_id: string
      member_display_name: string | null
      birth_date: unknown
    }>(
      `select user_id::text, member_display_name, birth_date
       from public.class_members
       where class_id = $1::uuid`,
      [classId]
    )

    const baseMembers: ClassMemberPayload[] = memberRows.map((m) => {
      const kind = m.user_id === cls.teacher_id ? ('teacher_member' as const) : ('student' as const)
      const display = String(m.member_display_name ?? '').trim()
      return {
        userId: m.user_id,
        name: display || '—',
        birthDate: birthDateOnly(m.birth_date),
        kind,
        removable: isTeacher && kind === 'student' && m.user_id !== cls.teacher_id,
      }
    })

    let mergedMembers = baseMembers
    let initialExamAttempts: ExamAttemptPayload[] = []
    let initialExamSessions: ExamSessionPayload[] = []

    if (isTeacher) {
      const examSessions = await pgQuery<{
        id: string
        code: string | null
        title: string | null
        created_at: unknown
        is_practice_homework: boolean | null
      }>(
        `select id::text, code, title, created_at, is_practice_homework
         from public.exam_sessions
         where class_id = $1::uuid and teacher_id = $2::uuid
         order by created_at desc
         limit 200`,
        [classId, userId]
      )

      initialExamSessions = examSessions.map((x) => ({
        id: x.id,
        code: String(x.code ?? '').trim(),
        title: String(x.title ?? '').trim() || 'Bài thi',
        createdAt: x.created_at != null ? tsIso(x.created_at) : null,
        practiceHomework: Boolean(x.is_practice_homework),
      }))

      const sessionIds = examSessions.map((x) => x.id)
      if (sessionIds.length > 0) {
        const attempts = await pgQuery<{
          id: string
          session_id: string
          user_id: string | null
          student_name: string | null
          score: unknown
          max_score: unknown
          submitted_at: unknown
          grading_meta: unknown
        }>(
          `select id::text, session_id::text, user_id::text, student_name, score, max_score,
                  submitted_at, grading_meta
           from public.exam_attempts
           where session_id = any($1::uuid[])
           order by submitted_at desc nulls last
           limit 500`,
          [sessionIds]
        )

        const attemptUserIds = [
          ...new Set(attempts.map((a) => a.user_id).filter((u): u is string => Boolean(u))),
        ]
        const attemptProfiles =
          attemptUserIds.length > 0
            ? await pgQuery<{ id: string; full_name: string | null }>(
                `select id::text, full_name from public.profiles where id = any($1::uuid[])`,
                [attemptUserIds]
              )
            : []
        const profileMap = Object.fromEntries(
          attemptProfiles.map((p) => [p.id, p.full_name ?? '—'])
        )

        const sessionMetaMap = Object.fromEntries(
          examSessions.map((x) => [
            x.id,
            {
              code: x.code ?? '',
              title: x.title ?? 'Bài thi',
              practiceHomework: Boolean(x.is_practice_homework),
            },
          ])
        )

        initialExamAttempts = attempts.map((a) => ({
          id: a.id,
          sessionId: a.session_id,
          examCode: sessionMetaMap[a.session_id]?.code ?? '',
          examTitle: sessionMetaMap[a.session_id]?.title ?? 'Bài thi',
          studentName:
            (a.student_name && String(a.student_name).trim()) ||
            (a.user_id ? profileMap[a.user_id] ?? '—' : '—'),
          userId: a.user_id ? String(a.user_id) : null,
          score: Number(a.score ?? 0),
          maxScore: Number(a.max_score ?? 0),
          submittedAt: tsIso(a.submitted_at),
          gradingMeta: parseExamGradingMeta(a.grading_meta),
          practiceHomework: Boolean(sessionMetaMap[a.session_id]?.practiceHomework),
        }))

        const seenIds = new Set(baseMembers.map((m) => m.userId))
        const extras: ClassMemberPayload[] = []
        for (const a of attempts) {
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
            extras.push({
              userId: synthetic,
              name: nm,
              birthDate: null,
              kind: 'student',
              removable: false,
            })
          }
        }
        if (extras.length > 0) {
          mergedMembers = [...baseMembers, ...extras]
        }
      }
    } else if (baseMembers.some((m) => m.userId === userId)) {
      const sessionsForStudent = await pgQuery<{
        id: string
        code: string | null
        title: string | null
        created_at: unknown
        status: string | null
        is_practice_homework: boolean | null
      }>(
        `select id::text, code, title, created_at, status::text, is_practice_homework
         from public.exam_sessions
         where class_id = $1::uuid
         order by created_at desc
         limit 200`,
        [classId]
      )

      initialExamSessions = sessionsForStudent.map((x) => ({
        id: x.id,
        code: String(x.code ?? '').trim(),
        title: String(x.title ?? '').trim() || 'Bài thi',
        createdAt: x.created_at != null ? tsIso(x.created_at) : null,
        status: x.status != null ? String(x.status) : 'active',
        practiceHomework: Boolean(x.is_practice_homework),
      }))

      const sessionIds = sessionsForStudent.map((x) => x.id)
      if (sessionIds.length > 0) {
        const myAttempts = await pgQuery<{
          id: string
          session_id: string
          user_id: string | null
          student_name: string | null
          score: unknown
          max_score: unknown
          submitted_at: unknown
          grading_meta: unknown
        }>(
          `select id::text, session_id::text, user_id::text, student_name, score, max_score,
                  submitted_at, grading_meta
           from public.exam_attempts
           where user_id = $1::uuid and session_id = any($2::uuid[])`,
          [userId, sessionIds]
        )

        const sessionMetaMap = Object.fromEntries(
          sessionsForStudent.map((x) => [
            x.id,
            {
              code: x.code ?? '',
              title: x.title ?? 'Bài thi',
              practiceHomework: Boolean(x.is_practice_homework),
            },
          ])
        )

        initialExamAttempts = myAttempts.map((a) => ({
          id: a.id,
          sessionId: a.session_id,
          examCode: String(sessionMetaMap[a.session_id]?.code ?? '').trim(),
          examTitle:
            String(sessionMetaMap[a.session_id]?.title ?? 'Bài thi').trim() || 'Bài thi',
          studentName: String(a.student_name ?? '').trim(),
          userId: a.user_id ? String(a.user_id) : null,
          score: Number(a.score ?? 0),
          maxScore: Number(a.max_score ?? 0),
          submittedAt: tsIso(a.submitted_at),
          gradingMeta: parseExamGradingMeta(a.grading_meta),
          practiceHomework: Boolean(sessionMetaMap[a.session_id]?.practiceHomework),
        }))
      }
    }

    return {
      cls: {
        id: cls.id,
        name: String(cls.name ?? ''),
        join_code: String(cls.join_code ?? ''),
        teacher_id: cls.teacher_id,
        grade_level_id: cls.grade_level_id,
        subject_label: cls.subject_label,
        teacher_display_name: cls.teacher_display_name,
      },
      isTeacher,
      schoolName,
      subjectNames,
      members: mergedMembers,
      initialExamAttempts,
      initialExamSessions,
    }
  } catch (e) {
    console.error('[load-class-detail-payload]', e)
    return null
  }
}
