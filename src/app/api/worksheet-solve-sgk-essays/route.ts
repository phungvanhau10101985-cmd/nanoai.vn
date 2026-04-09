import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { insertWorksheetJobFromPg } from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'

/** Endpoint 2: chỉ giải các bài tự luận SGK còn thiếu lời giải. */
export async function POST(req: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const userId = auth.user?.id

    const body = await req.json().catch(() => ({}))
    const worksheetId = String(body?.worksheetId ?? '').trim()
    const curriculumMarkdown = String(body?.curriculumMarkdown ?? '').trim()
    if (!worksheetId) return NextResponse.json({ error: 'Thiếu worksheetId.' }, { status: 400 })

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const params = { worksheetId, curriculumMarkdown }
    const jobId = await insertWorksheetJobFromPg({
      userId: userId!,
      type: 'solve_sgk_essays',
      params,
    })
    if (!jobId) {
      return NextResponse.json({ error: 'Lỗi tạo job.' }, { status: 500 })
    }

    return NextResponse.json({ jobId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
