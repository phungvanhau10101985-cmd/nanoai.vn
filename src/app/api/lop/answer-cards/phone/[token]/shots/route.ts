import { NextResponse } from 'next/server'
import { answerCardErrorResponse } from '@/app/api/lop/answer-cards/guard'
import { saveAnswerCardShotPg } from '@/lib/db/answer-card-pg'
import { isAnswerCardPhoneToken } from '@/lib/lop/answer-card'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!isAnswerCardPhoneToken(token)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const type = req.headers.get('content-type') ?? ''
  if (!type.includes('image/jpeg') && !type.includes('application/octet-stream')) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const bytes = Buffer.from(await req.arrayBuffer())
  const rawIndex = req.headers.get('x-question-index')
  const questionIndex = rawIndex != null && /^-?\d+$/.test(rawIndex) ? Number(rawIndex) : undefined
  try {
    const saved = await saveAnswerCardShotPg(token, bytes, questionIndex)
    if (!saved) return NextResponse.json({ error: 'invalid' }, { status: 400 })
    return NextResponse.json(saved)
  } catch (error) {
    return answerCardErrorResponse(error)
  }
}
