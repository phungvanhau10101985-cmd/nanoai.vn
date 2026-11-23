import { NextResponse } from 'next/server'
import { answerCardErrorResponse, requireAnswerCardTeacher } from '@/app/api/lop/answer-cards/guard'
import { findAnswerCardShotClassPg, loadAnswerCardShotImagePg } from '@/lib/db/answer-card-pg'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roundId: string; shotId: string }> }
) {
  const { roundId, shotId } = await params
  try {
    const classId = await findAnswerCardShotClassPg(roundId, shotId)
    if (!classId) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const auth = await requireAnswerCardTeacher(classId)
    if ('error' in auth) return auth.error
    const owned = await loadAnswerCardShotImagePg(roundId, auth.userId, shotId)
    if (!owned) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return new NextResponse(new Uint8Array(owned.image), {
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'private, max-age=86400',
      },
    })
  } catch (error) {
    return answerCardErrorResponse(error)
  }
}
