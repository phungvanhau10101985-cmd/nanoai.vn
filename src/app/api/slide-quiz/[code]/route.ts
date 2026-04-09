import { NextRequest, NextResponse } from 'next/server'
import {
  fetchSlideQuizSessionByCodeFromPg,
  updateSlideQuizSessionRevealedForOwnerPg,
} from '@/lib/db/slide-quiz-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getUserForAction } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code?.toUpperCase()
  if (!code) return NextResponse.json({ error: 'Thiếu mã.' }, { status: 400 })

  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const user = auth.user

  const body = await req.json().catch(() => ({}))
  const { status } = body as { status?: string }
  if (status !== 'revealed') return NextResponse.json({ error: 'Trạng thái không hợp lệ.' }, { status: 400 })

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
  }

  const updated = await updateSlideQuizSessionRevealedForOwnerPg(code, user.id)
  if (updated === null) {
    return NextResponse.json({ error: 'Lỗi cập nhật phiên.' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code?.toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'Thiếu mã.' }, { status: 400 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
  }

  const data = await fetchSlideQuizSessionByCodeFromPg(code)
  if (!data) {
    return NextResponse.json({ error: 'Không tìm thấy phiên.' }, { status: 404 })
  }

  const quiz = data.quiz_data as { question: string; options: string[]; correctIndex: number }
  const opts = quiz?.options ?? []
  // Nếu option có chứa "(Đáp án đúng)" thì ưu tiên dùng index đó – tránh lỗi correctIndex sai trong DB
  const idxByMarker = opts.findIndex((o) => /\(Đáp án đúng\)/i.test(String(o ?? '')))
  let correctIndex = quiz?.correctIndex ?? 0
  if (idxByMarker >= 0) correctIndex = idxByMarker

  const payload: {
    sessionId: string
    code: string
    question: string
    options: string[]
    status: string
    correctIndex?: number
  } = {
    sessionId: data.id,
    code: data.code,
    question: quiz?.question ?? '',
    options: opts,
    status: data.status,
  }
  if (data.status === 'revealed') payload.correctIndex = Math.min(correctIndex, opts.length - 1)
  return NextResponse.json(payload)
}
