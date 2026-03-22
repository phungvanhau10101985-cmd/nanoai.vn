/**
 * Danh sách câu trắc nghiệm + tự luận gắn với một giáo trình (từ phiếu + worksheet_questions.curriculum_id).
 * Yêu cầu đăng nhập.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { parseExerciseIndex } from '@/lib/worksheet-exercise-sort'
import { getEssayProblem, getEssaySolution } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

const MAX_IDS = 4000
const CHUNK = 120

/** Giới hạn an toàn (một câu cực dài / base64 lạ) — vẫn cho hiển thị gần như toàn bộ. */
const PREVIEW_MAX_LEN = 120_000

/** Loại bỏ tag cũ nằm trong text đề (vd: [Đã verify], [Trung bình], [Bài tập SGK]...). */
function stripLegacyInlineTags(input: string): string {
  let out = String(input ?? '')
    .replace(/\*\*/g, '')
    .trim()
  for (let i = 0; i < 6; i++) {
    const next = out
      .replace(/^\s*\[(?:Đã verify|Chưa verify|Bài tập SGK|Dễ|Trung bình|Khó|Nhận biết|Thông hiểu|Vận dụng thấp|Vận dụng cao|Thực tế)\]\s*/i, '')
      .trim()
    if (next === out) break
    out = next
  }
  return out
}

function previewFromRow(type: string, content_json: unknown): string {
  const normalize = (s: string) =>
    s
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .slice(0, PREVIEW_MAX_LEN)

  if (type === 'quiz') {
    const c = content_json as { question?: string; options?: string[] }
    const stem = stripLegacyInlineTags(String(c?.question ?? '').trim())
    const opts = (c.options ?? []).slice(0, 4)
    if (opts.length === 0) return normalize(stem)
    const optLines = opts.map((o, i) => {
      const text = String(o ?? '')
        .replace(/^[A-D]\.\s*/i, '')
        .trim()
      return `${String.fromCharCode(65 + i)}. ${text}`
    })
    return normalize([stem, ...optLines].filter(Boolean).join('\n'))
  }
  const c = content_json as { problem?: string }
  return normalize(stripLegacyInlineTags(String(c?.problem ?? '')))
}

function detailFromRow(
  type: string,
  contentJson: unknown
): { problem: string; solution: string } {
  if (type === 'quiz') {
    const c = contentJson as {
      question?: unknown
      options?: unknown
      correctIndex?: unknown
      explanation?: unknown
      solution?: unknown
      answer?: unknown
    }
    const question = stripLegacyInlineTags(String(c?.question ?? '').trim())
    const options = Array.isArray(c?.options)
      ? c.options.map((x) => String(x ?? '').replace(/^[A-D]\.\s*/i, '').trim()).filter(Boolean).slice(0, 4)
      : []
    const optionLines = options.map((o, idx) => `${String.fromCharCode(65 + idx)}. ${o}`)
    const ciRaw = typeof c?.correctIndex === 'number' ? c.correctIndex : Number(c?.correctIndex)
    const ci = Number.isFinite(ciRaw) ? Math.max(0, Math.min(3, Math.floor(ciRaw))) : 0
    const answerLabel = options[ci] ? `${String.fromCharCode(65 + ci)}. ${options[ci]}` : String.fromCharCode(65 + ci)
    const explain = String(c?.explanation ?? c?.solution ?? c?.answer ?? '').trim()
    return {
      problem: [question, ...optionLines].filter(Boolean).join('\n').trim(),
      solution: explain ? `Đáp án đúng: ${answerLabel}\n\n${explain}` : `Đáp án đúng: ${answerLabel}`,
    }
  }
  const problem = stripLegacyInlineTags(getEssayProblem(contentJson).trim())
  const solution = getEssaySolution(contentJson).trim()
  return { problem, solution }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function compareCatalogRows(
  a: {
    id: string
    type: string
    topic: string | null
    created_at: string
    order: number
    preview: string
    sheetIndex: number
  },
  b: typeof a
): number {
  const idxA = parseExerciseIndex(a.topic ?? '', a.preview)
  const idxB = parseExerciseIndex(b.topic ?? '', b.preview)
  const orderA = Number(a.order) || 0
  const orderB = Number(b.order) || 0

  if (idxA && idxB) {
    if (idxA.major !== idxB.major) return idxA.major - idxB.major
    if (idxA.minor !== idxB.minor) return idxA.minor - idxB.minor
  } else if (idxA && !idxB) return -1
  else if (!idxA && idxB) return 1

  if (orderA !== orderB) return orderA - orderB

  if (a.sheetIndex !== b.sheetIndex) return a.sheetIndex - b.sheetIndex

  const rank = (t: string) => (t === 'quiz' ? 0 : 1)
  const rA = rank(a.type)
  const rB = rank(b.type)
  if (rA !== rB) return rA - rB

  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { searchParams } = req.nextUrl
    const curriculumId = (searchParams.get('curriculumId') ?? '').trim()
    if (!curriculumId) return NextResponse.json({ error: 'Thiếu curriculumId.' }, { status: 400 })

    const typeParam = (searchParams.get('type') ?? 'all').trim()
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

    const { data: sheets } = await supabase
      .from('worksheet_worksheets')
      .select('question_ids, created_at')
      .eq('curriculum_id', curriculumId)
      .order('created_at', { ascending: false })

    const idSet = new Set<string>()
    /** Thứ tự trên phiếu mới nhất → cũ hơn → câu chỉ có curriculum_id (cuối danh sách). */
    const sheetIndexById = new Map<string, number>()
    let seq = 0
    for (const s of sheets ?? []) {
      for (const id of (s.question_ids ?? []) as string[]) {
        if (!id) continue
        const sid = String(id)
        if (!idSet.has(sid)) {
          idSet.add(sid)
          sheetIndexById.set(sid, seq++)
        }
      }
    }

    const { data: byCurriculum } = await supabase
      .from('worksheet_questions')
      .select('id')
      .eq('curriculum_id', curriculumId)
      .in('type', ['quiz', 'essay'])

    for (const r of byCurriculum ?? []) {
      if (!r.id) continue
      const sid = String(r.id)
      if (!idSet.has(sid)) {
        idSet.add(sid)
        sheetIndexById.set(sid, seq++)
      }
    }

    let allIds = [...sheetIndexById.keys()].sort(
      (a, b) => (sheetIndexById.get(a) ?? 0) - (sheetIndexById.get(b) ?? 0)
    )
    if (allIds.length > MAX_IDS) {
      allIds = allIds.slice(0, MAX_IDS)
    }

    if (allIds.length === 0) {
      return NextResponse.json({ items: [], total: 0, limit, offset, capped: false })
    }

    type QRow = {
      id: string
      type: string
      topic: string | null
      subject_id: string
      grade_level_id: string
      source: string | null
      difficulty: string | null
      order: number
      created_at: string
      verified_at: string | null
      content_json: unknown
    }

    const rows: QRow[] = []
    for (const part of chunk(allIds, CHUNK)) {
      const { data, error } = await supabase
        .from('worksheet_questions')
        .select('id, type, topic, subject_id, grade_level_id, source, difficulty, "order", created_at, verified_at, content_json')
        .in('id', part)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      for (const row of data ?? []) {
        const t = String(row.type)
        if (t !== 'quiz' && t !== 'essay') continue
        const r = row as Record<string, unknown>
        rows.push({
          id: String(r.id),
          type: t,
          topic: (r.topic as string | null) ?? null,
          subject_id: String(r.subject_id ?? ''),
          grade_level_id: String(r.grade_level_id ?? ''),
          source: (r.source as string | null) ?? null,
          difficulty: (r.difficulty as string | null) ?? null,
          order: typeof r.order === 'number' ? r.order : Number(r.order) || 0,
          created_at: String(r.created_at ?? ''),
          verified_at: (r.verified_at as string | null) ?? null,
          content_json: r.content_json,
        })
      }
    }

    const byId = new Map(rows.map((r) => [r.id, r]))
    const list = allIds.map((id) => byId.get(id)).filter(Boolean) as QRow[]

    const withPreview = list.map((row) => ({
      row,
      preview: previewFromRow(row.type, row.content_json),
    }))
    withPreview.sort((x, y) =>
      compareCatalogRows(
        {
          id: x.row.id,
          type: x.row.type,
          topic: x.row.topic,
          created_at: x.row.created_at,
          order: x.row.order,
          preview: x.preview,
          sheetIndex: sheetIndexById.get(x.row.id) ?? 999999,
        },
        {
          id: y.row.id,
          type: y.row.type,
          topic: y.row.topic,
          created_at: y.row.created_at,
          order: y.row.order,
          preview: y.preview,
          sheetIndex: sheetIndexById.get(y.row.id) ?? 999999,
        }
      )
    )

    let ordered = withPreview.map((x) => x.row)

    if (typeParam === 'quiz' || typeParam === 'essay') {
      ordered = ordered.filter((r) => r.type === typeParam)
    }

    const total = ordered.length
    const page = ordered.slice(offset, offset + limit)

    const items = page.map((row) => ({
      ...detailFromRow(row.type, row.content_json),
      id: row.id,
      type: row.type,
      topic: row.topic ?? '',
      subject_id: row.subject_id ?? '',
      grade_level_id: row.grade_level_id ?? '',
      source: row.source ?? '',
      difficulty: row.difficulty ?? '',
      order: row.order,
      created_at: row.created_at,
      verified_at: row.verified_at ?? null,
      preview: previewFromRow(row.type, row.content_json),
    }))

    return NextResponse.json({
      items,
      total,
      limit,
      offset,
      capped: idSet.size > MAX_IDS,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
