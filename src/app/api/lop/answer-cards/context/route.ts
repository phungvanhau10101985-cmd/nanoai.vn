import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { teacherMayScanClassPg } from '@/lib/db/answer-card-pg'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ClassChoice = { id: string; name: string }

async function classesTeacherCanUse(
  rows: Array<{ id: string; name: string | null }>,
  teacherId: string
): Promise<ClassChoice[]> {
  const out: ClassChoice[] = []
  for (const row of rows) {
    if (!UUID_RE.test(row.id)) continue
    const allowed = await teacherMayScanClassPg(row.id, teacherId)
    if (!allowed) continue
    out.push({ id: row.id, name: String(row.name ?? '').trim() || row.id })
  }
  return out
}

/** Lớp gắn với đề, phiếu hoặc giáo trình để mở buổi quét thẻ. */
export async function GET(req: Request) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  if (!isPgConfigured()) return NextResponse.json({ error: 'error' }, { status: 503 })

  const url = new URL(req.url)
  const examCode = (url.searchParams.get('examCode') ?? '').trim().toUpperCase()
  const worksheetId = (url.searchParams.get('worksheetId') ?? '').trim()
  const curriculumId = (url.searchParams.get('curriculumId') ?? '').trim()

  try {
    if (examCode) {
      const session = await pgQueryOne<{ id: string; class_id: string | null }>(
        `select id::text, class_id::text
         from public.exam_sessions
         where code = $1 and teacher_id = $2::uuid
         limit 1`,
        [examCode, auth.user.id]
      )
      if (!session?.id || !session.class_id) return NextResponse.json({ none: true })
      const allowed = await teacherMayScanClassPg(session.class_id, auth.user.id)
      if (!allowed) return NextResponse.json({ none: true })
      return NextResponse.json({
        classId: session.class_id,
        sourceKind: 'exam',
        sourceId: session.id,
      })
    }

    if (worksheetId && UUID_RE.test(worksheetId)) {
      const rows = await pgQuery<{ id: string; name: string | null }>(
        `select c.id::text as id, c.name
         from public.class_worksheets cw
         join public.classes c on c.id = cw.class_id
         where cw.worksheet_id = $1::uuid
         order by c.name asc`,
        [worksheetId]
      )
      const classes = await classesTeacherCanUse(rows, auth.user.id)
      const only = classes.length === 1 ? classes[0] : null
      if (classes.length === 0) return NextResponse.json({ none: true })
      if (only) {
        return NextResponse.json({
          classId: only.id,
          sourceKind: 'worksheet',
          sourceId: worksheetId,
        })
      }
      return NextResponse.json({ classes, sourceKind: 'worksheet', sourceId: worksheetId })
    }

    if (curriculumId && UUID_RE.test(curriculumId)) {
      const rows = await pgQuery<{ id: string; name: string | null }>(
        `select c.id::text as id, c.name
         from public.class_teacher_curricula s
         join public.classes c on c.id = s.class_id
         where s.curriculum_id = $1::uuid and s.teacher_id = $2::uuid
         order by c.name asc`,
        [curriculumId, auth.user.id]
      )
      let classes = await classesTeacherCanUse(rows, auth.user.id)
      if (classes.length === 0) {
        const taught = await pgQuery<{ id: string; name: string | null }>(
          `select distinct c.id::text as id, c.name
           from public.class_taught_lessons t
           join public.classes c on c.id = t.class_id
           where t.curriculum_id = $1::uuid and t.teacher_id = $2::uuid
           order by c.name asc`,
          [curriculumId, auth.user.id]
        )
        classes = await classesTeacherCanUse(taught, auth.user.id)
      }
      const only = classes.length === 1 ? classes[0] : null
      if (classes.length === 0) return NextResponse.json({ none: true })
      if (only) {
        return NextResponse.json({
          classId: only.id,
          sourceKind: 'worksheet',
          sourceId: curriculumId,
        })
      }
      return NextResponse.json({ classes, sourceKind: 'worksheet', sourceId: curriculumId })
    }

    return NextResponse.json({ none: true })
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : ''
    if (code === '42P01' || code === '42703') return NextResponse.json({ none: true })
    console.error('[answer-cards/context]', error)
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}
