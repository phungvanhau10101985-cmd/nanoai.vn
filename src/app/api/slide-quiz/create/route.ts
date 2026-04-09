import { NextRequest, NextResponse } from 'next/server'
import { insertSlideQuizSessionFromPg } from '@/lib/db/slide-quiz-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getUserForAction } from '@/lib/auth'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  const arr = new Uint8Array(6)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
    for (let i = 0; i < 6; i++) code += chars[arr[i]! % chars.length]
  } else {
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function POST(req: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  const user = auth.user

  const body = await req.json()
  const { curriculumId, slideIndex, blockIndex, quizData } = body as {
    curriculumId: string
    slideIndex: number
    blockIndex: number
    quizData: { question: string; options: string[]; correctIndex: number }
  }

  if (
    !curriculumId ||
    typeof slideIndex !== 'number' ||
    typeof blockIndex !== 'number' ||
    !quizData?.question ||
    !Array.isArray(quizData.options)
  ) {
    return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
  }

  let code = generateCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await insertSlideQuizSessionFromPg({
      code,
      curriculumId,
      slideIndex,
      blockIndex,
      quizData,
      createdBy: user.id,
    })
    if (r && typeof r === 'object' && 'id' in r) {
      return NextResponse.json({ success: true, code: r.code, sessionId: r.id })
    }
    if (r === 'duplicate_code') {
      code = generateCode()
      continue
    }
    return NextResponse.json({ error: 'Không tạo được phiên quiz.' }, { status: 500 })
  }
  return NextResponse.json({ error: 'Không tạo được mã.' }, { status: 500 })
}
