import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchExamAttachMetaOccupiedFromPg } from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'

/** Danh sách class_id đã có phiên thuộc cùng lineage với phiên nguồn (đã gắn rồi). */
export async function GET(req: NextRequest) {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const sourceSessionId = String(req.nextUrl.searchParams.get('sourceSessionId') ?? '').trim()
    if (!sourceSessionId) {
      return NextResponse.json({ error: 'Thiếu phiên nguồn.' }, { status: 400 })
    }

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const res = await fetchExamAttachMetaOccupiedFromPg(sourceSessionId, user.id)
    if (res === null) {
      return NextResponse.json({ error: 'Lỗi đọc dữ liệu bài thi.' }, { status: 500 })
    }
    if (res === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    return NextResponse.json({
      lineageRootId: res.lineageRootId,
      occupiedClassIds: res.occupiedClassIds,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
