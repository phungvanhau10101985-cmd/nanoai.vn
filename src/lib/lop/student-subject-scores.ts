import { pgQuery } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { parseExamGradingMeta } from '@/lib/exam-feedback'
import { examPointsOn10 } from '@/lib/lop/class-gradebook'

export type StudentSubjectScoreRow = {
  id: string
  code: string
  title: string
  homework: boolean
  submitted: boolean
  /** Điểm bài thi quy về thang 10. Bài tập không hiện số điểm. */
  score10: number | null
}

export async function listStudentSubjectScoresPg(opts: {
  classId: string
  teacherId: string
  subjectId: string
  studentUserId: string
}): Promise<StudentSubjectScoreRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      id: string
      code: string | null
      title: string | null
      is_practice_homework: boolean | null
      score: unknown
      max_score: unknown
      grading_meta: unknown
      submitted_at: unknown
    }>(
      `select es.id::text, es.code, es.title, es.is_practice_homework,
              a.score, a.max_score, a.grading_meta, a.submitted_at
       from public.exam_sessions es
       left join public.exam_attempts a
         on a.session_id = es.id and a.user_id = $4::uuid
       where es.class_id = $1::uuid
         and es.teacher_id = $2::uuid
         and es.subject_id = $3
       order by es.created_at desc
       limit 80`,
      [opts.classId, opts.teacherId, opts.subjectId, opts.studentUserId]
    )
    return rows.map((row) => {
      const homework = Boolean(row.is_practice_homework)
      const submitted = row.submitted_at != null
      let score10: number | null = null
      if (!homework && submitted) {
        score10 = examPointsOn10(
          Number(row.score ?? 0),
          Number(row.max_score ?? 0),
          parseExamGradingMeta(row.grading_meta)
        )
      }
      return {
        id: row.id,
        code: String(row.code ?? '').trim(),
        title: String(row.title ?? '').trim() || '—',
        homework,
        submitted,
        score10,
      }
    })
  } catch (error) {
    console.error('[student-subject-scores] list', error)
    return null
  }
}
