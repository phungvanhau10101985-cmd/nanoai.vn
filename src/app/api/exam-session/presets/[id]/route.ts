import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchExamPresetDetailPg } from '@/lib/db/exam-preset-pg'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }
    const { id } = await params
    const sessionId = String(id ?? '').trim()
    if (!UUID_RE.test(sessionId)) {
      return NextResponse.json({ error: 'Đề không hợp lệ.' }, { status: 400 })
    }
    const detail = await fetchExamPresetDetailPg(sessionId)
    if (detail === null) {
      return NextResponse.json({ error: 'Không đọc được đề.' }, { status: 500 })
    }
    if (detail === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy đề.' }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
