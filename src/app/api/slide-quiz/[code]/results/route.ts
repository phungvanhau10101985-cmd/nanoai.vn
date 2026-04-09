import { NextRequest, NextResponse } from 'next/server'
import { fetchSlideQuizResultsForOwnerFromPg } from '@/lib/db/slide-quiz-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getUserForAction } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code?.toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'Thiếu mã.' }, { status: 400 })
  }

  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const user = auth.user

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
  }

  const res = await fetchSlideQuizResultsForOwnerFromPg(code, user.id)
  if (res === null) {
    return NextResponse.json({ error: 'Lỗi đọc kết quả.' }, { status: 500 })
  }
  if (res === 'not_found') {
    return NextResponse.json({ error: 'Không tìm thấy phiên.' }, { status: 404 })
  }
  if (res === 'forbidden') {
    return NextResponse.json({ error: 'Chỉ giáo viên tạo phiên mới xem được kết quả.' }, { status: 403 })
  }

  const counts: Record<number, number> = {}
  for (const i of res.answer_indexes) {
    counts[i] = (counts[i] ?? 0) + 1
  }
  const total = res.answer_indexes.length

  return NextResponse.json({
    counts,
    total,
    byIndex: counts,
  })
}
