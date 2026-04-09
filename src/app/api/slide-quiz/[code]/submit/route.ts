import { NextRequest, NextResponse } from 'next/server'
import {
  fetchSlideQuizSessionIdByCodeFromPg,
  insertSlideQuizResponseFromPg,
} from '@/lib/db/slide-quiz-pg'
import { isPgConfigured } from '@/lib/db/pool'

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code?.toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'Thiếu mã.' }, { status: 400 })
  }

  const body = await req.json()
  const { answerIndex, deviceId, userId } = body as {
    answerIndex: number
    deviceId?: string
    userId?: string
  }

  if (typeof answerIndex !== 'number' || answerIndex < 0) {
    return NextResponse.json({ error: 'Đáp án không hợp lệ.' }, { status: 400 })
  }
  const did = deviceId || (userId ? `user-${userId}` : null)
  if (!did) {
    return NextResponse.json({ error: 'Cần deviceId.' }, { status: 400 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
  }

  const sessionId = await fetchSlideQuizSessionIdByCodeFromPg(code)
  if (!sessionId) {
    return NextResponse.json({ error: 'Không tìm thấy phiên.' }, { status: 404 })
  }

  const inserted = await insertSlideQuizResponseFromPg({
    sessionId,
    answerIndex,
    userId: userId || null,
    deviceId: did,
  })

  if (inserted === null) {
    return NextResponse.json({ error: 'Lỗi lưu đáp án.' }, { status: 500 })
  }
  if (inserted === 'duplicate') {
    return NextResponse.json({ success: false, error: 'Bạn đã gửi rồi. Chỉ được gửi 1 lần.' })
  }
  return NextResponse.json({ success: true })
}
