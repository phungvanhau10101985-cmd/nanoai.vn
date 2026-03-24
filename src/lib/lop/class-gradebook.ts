import type { SupabaseClient } from '@supabase/supabase-js'
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

export async function fetchClassGradebookData(
  supabase: SupabaseClient,
  classId: string,
  teacherUserId: string
): Promise<
  | { ok: false; error: 'not_found' | 'forbidden' }
  | { ok: true; data: GradebookPayload }
> {
  const { data: cls, error: clsErr } = await supabase
    .from('classes')
    .select('id, name, teacher_id')
    .eq('id', classId)
    .single()

  if (clsErr || !cls) return { ok: false, error: 'not_found' }
  if (cls.teacher_id !== teacherUserId) return { ok: false, error: 'forbidden' }

  const { data: memberRows } = await supabase
    .from('class_members')
    .select('user_id, member_display_name, birth_date')
    .eq('class_id', classId)

  const students = (memberRows ?? []).filter((m: { user_id: string }) => m.user_id !== cls.teacher_id)

  const { data: cwRows } = await supabase
    .from('class_worksheets')
    .select('worksheet_id, assigned_at')
    .eq('class_id', classId)
    .order('assigned_at', { ascending: true })

  const wsIds = Array.from(new Set((cwRows ?? []).map((r: { worksheet_id: string }) => r.worksheet_id)))
  const { data: wsMetas } = wsIds.length
    ? await supabase.from('worksheet_worksheets').select('id, topic').in('id', wsIds)
    : { data: [] }

  const topicByWs = Object.fromEntries(
    (wsMetas ?? []).map((w: { id: string; topic: string | null }) => [w.id, String(w.topic ?? '').trim() || '—'])
  )

  const { data: examRows } = await supabase
    .from('exam_sessions')
    .select('id, code, title, created_at')
    .eq('class_id', classId)
    .eq('teacher_id', teacherUserId)
    .order('created_at', { ascending: false })

  const { data: subRows } = await supabase
    .from('worksheet_submissions')
    .select('worksheet_id, user_id, quiz_score, quiz_total')
    .eq('class_id', classId)

  const sessionIds = (examRows ?? []).map((s: { id: string }) => s.id)
  const { data: attemptRows } = sessionIds.length
    ? await supabase
        .from('exam_attempts')
        .select('session_id, user_id, score, max_score, grading_meta')
        .in('session_id', sessionIds)
    : { data: [] }

  const subMap = new Map<string, { score: number; total: number }>()
  for (const s of subRows ?? []) {
    const uid = String((s as { user_id: string }).user_id)
    const wid = String((s as { worksheet_id: string }).worksheet_id)
    subMap.set(`${uid}::${wid}`, {
      score: Number((s as { quiz_score: number }).quiz_score ?? 0),
      total: Number((s as { quiz_total: number }).quiz_total ?? 0),
    })
  }

  const attemptMap = new Map<string, { score: number; max: number; gradingMeta: ExamGradingMeta | null }>()
  for (const a of attemptRows ?? []) {
    const uid = (a as { user_id: string | null }).user_id
    if (!uid) continue
    const sid = String((a as { session_id: string }).session_id)
    attemptMap.set(`${uid}::${sid}`, {
      score: Number((a as { score: number }).score ?? 0),
      max: Number((a as { max_score: number }).max_score ?? 0),
      gradingMeta: parseExamGradingMeta((a as { grading_meta?: unknown }).grading_meta),
    })
  }

  const columns: GradebookColumn[] = []
  for (const r of cwRows ?? []) {
    const wid = String((r as { worksheet_id: string }).worksheet_id)
    columns.push({
      key: `w:${wid}`,
      kind: 'worksheet',
      header: topicByWs[wid] ?? '—',
    })
  }
  for (const ex of examRows ?? []) {
    const code = String((ex as { code: string | null }).code ?? '').trim()
    const title = String((ex as { title: string | null }).title ?? '').trim() || 'Đề thi'
    columns.push({
      key: `e:${(ex as { id: string }).id}`,
      kind: 'exam',
      header: code ? `${title} (${code})` : title,
    })
  }

  const rows: GradebookRow[] = students.map((st: { user_id: string; member_display_name: string | null; birth_date: string | null }) => {
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
}
