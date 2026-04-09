import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { parseExamGradingMeta, type ExamGradingMeta } from '@/lib/exam-feedback'

export type GradebookColumn =
  | { key: string; kind: 'worksheet'; header: string }
  | { key: string; kind: 'exam'; header: string }

export type GradebookRow = {
  userId: string
  displayName: string
  dob: string
  birthIso: string | null
  cells: Record<string, string>
  total10: number
}

export type GradebookPayload = {
  className: string
  columns: GradebookColumn[]
  rows: GradebookRow[]
}

function formatDobVi(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function pointsOn10(score: number, max: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return 0
  return Math.round((score / max) * 1000) / 100
}

/**
 * Điểm một cột đề thi quy về /10 để cộng vào tổng sổ.
 * - Đã chấm tự luận (`essayPointsAwarded`): dùng score/max toàn bài (TN + TL).
 * - Chưa chấm TL nhưng có TN: chỉ quy phần TN theo quizPoints/quizPointsMax (tránh 3/100 → 0.3 làm lệch tổng).
 * - Chỉ TL, chưa chấm: 0; đã chấm: score/max.
 */
function examPointsOn10(score: number, max: number, meta: ExamGradingMeta | null): number {
  if (!meta) {
    return pointsOn10(score, max)
  }

  const essayGraded =
    meta.essayPointsMax > 0 &&
    meta.essayPointsAwarded !== undefined &&
    Number.isFinite(meta.essayPointsAwarded)

  if (essayGraded) {
    return pointsOn10(score, max)
  }

  if (meta.quizTotal > 0 && meta.essayPointsMax > 0 && meta.quizPointsMax > 0) {
    return pointsOn10(meta.quizPoints, meta.quizPointsMax)
  }
  if (meta.quizTotal === 0 && meta.essayPointsMax > 0) {
    return 0
  }
  return pointsOn10(score, max)
}

export type GradebookFetchError = 'not_found' | 'forbidden' | 'db'

/**
 * Bảng điểm lớp (phiếu đã gán + đề thi) — Postgres trực tiếp.
 */
export async function fetchClassGradebookData(
  classId: string,
  teacherUserId: string
): Promise<{ ok: false; error: GradebookFetchError } | { ok: true; data: GradebookPayload }> {
  if (!isPgConfigured()) return { ok: false, error: 'db' }

  try {
    const cls = await pgQueryOne<{ id: string; name: string | null; teacher_id: string }>(
      `select id::text, name, teacher_id::text from public.classes where id = $1::uuid limit 1`,
      [classId]
    )
    if (!cls) return { ok: false, error: 'not_found' }
    if (cls.teacher_id !== teacherUserId) return { ok: false, error: 'forbidden' }

    const memberRows = await pgQuery<{
      user_id: string
      member_display_name: string | null
      birth_date: string | null
    }>(
      `select user_id::text, member_display_name, birth_date::text as birth_date
       from public.class_members
       where class_id = $1::uuid`,
      [classId]
    )

    const students = memberRows.filter((m) => m.user_id !== cls.teacher_id)

    const cwRows = await pgQuery<{ worksheet_id: string; assigned_at: string | null }>(
      `select worksheet_id::text, assigned_at::text as assigned_at
       from public.class_worksheets
       where class_id = $1::uuid
       order by assigned_at asc nulls first`,
      [classId]
    )

    const wsIds = [...new Set(cwRows.map((r) => r.worksheet_id))]
    const wsMetas =
      wsIds.length > 0
        ? await pgQuery<{ id: string; topic: string | null }>(
            `select id::text, topic from public.worksheet_worksheets where id = any($1::uuid[])`,
            [wsIds]
          )
        : []

    const topicByWs = Object.fromEntries(
      wsMetas.map((w) => [w.id, String(w.topic ?? '').trim() || '—'])
    )

    const examRows = await pgQuery<{ id: string; code: string | null; title: string | null }>(
      `select id::text, code, title
       from public.exam_sessions
       where class_id = $1::uuid and teacher_id = $2::uuid
       order by created_at desc`,
      [classId, teacherUserId]
    )

    const subRows = await pgQuery<{
      worksheet_id: string
      user_id: string
      quiz_score: unknown
      quiz_total: unknown
    }>(
      `select worksheet_id::text, user_id::text, quiz_score, quiz_total
       from public.worksheet_submissions
       where class_id = $1::uuid`,
      [classId]
    )

    const sessionIds = examRows.map((s) => s.id)
    const attemptRows =
      sessionIds.length > 0
        ? await pgQuery<{
            session_id: string
            user_id: string | null
            score: unknown
            max_score: unknown
            grading_meta: unknown
          }>(
            `select session_id::text, user_id::text, score, max_score, grading_meta
             from public.exam_attempts
             where session_id = any($1::uuid[])`,
            [sessionIds]
          )
        : []

    const subMap = new Map<string, { score: number; total: number }>()
    for (const s of subRows) {
      const uid = String(s.user_id)
      const wid = String(s.worksheet_id)
      subMap.set(`${uid}::${wid}`, {
        score: Number(s.quiz_score ?? 0),
        total: Number(s.quiz_total ?? 0),
      })
    }

    const attemptMap = new Map<string, { score: number; max: number; gradingMeta: ExamGradingMeta | null }>()
    for (const a of attemptRows) {
      const uid = a.user_id
      if (!uid) continue
      const sid = String(a.session_id)
      attemptMap.set(`${uid}::${sid}`, {
        score: Number(a.score ?? 0),
        max: Number(a.max_score ?? 0),
        gradingMeta: parseExamGradingMeta(a.grading_meta),
      })
    }

    const columns: GradebookColumn[] = []
    for (const r of cwRows) {
      const wid = String(r.worksheet_id)
      columns.push({
        key: `w:${wid}`,
        kind: 'worksheet',
        header: topicByWs[wid] ?? '—',
      })
    }
    for (const ex of examRows) {
      const code = String(ex.code ?? '').trim()
      const title = String(ex.title ?? '').trim() || 'Đề thi'
      columns.push({
        key: `e:${ex.id}`,
        kind: 'exam',
        header: code ? `${title} (${code})` : title,
      })
    }

    const rows: GradebookRow[] = students.map((st) => {
      const cells: Record<string, string> = {}
      let total10 = 0
      for (const col of columns) {
        if (col.kind === 'worksheet') {
          const wid = col.key.slice(2)
          const sub = subMap.get(`${st.user_id}::${wid}`)
          if (sub && sub.total > 0) {
            cells[col.key] = `${sub.score}/${sub.total}`
            total10 += pointsOn10(sub.score, sub.total)
          } else {
            cells[col.key] = '—'
          }
        } else {
          const sid = col.key.slice(2)
          const att = attemptMap.get(`${st.user_id}::${sid}`)
          if (att && att.max > 0) {
            cells[col.key] = `${att.score}/${att.max}`
            total10 += examPointsOn10(att.score, att.max, att.gradingMeta)
          } else {
            cells[col.key] = '—'
          }
        }
      }
      return {
        userId: st.user_id,
        displayName: String(st.member_display_name ?? '').trim() || '—',
        dob: formatDobVi(st.birth_date),
        birthIso: st.birth_date,
        cells,
        total10: Math.round(total10 * 100) / 100,
      }
    })

    rows.sort((a, b) => {
      if (a.total10 !== b.total10) return a.total10 - b.total10
      return a.displayName.localeCompare(b.displayName, 'vi')
    })

    return {
      ok: true,
      data: {
        className: String(cls.name ?? '').trim() || 'Lớp',
        columns,
        rows,
      },
    }
  } catch (e) {
    console.error('[class-gradebook] fetchClassGradebookData', e)
    return { ok: false, error: 'db' }
  }
}
