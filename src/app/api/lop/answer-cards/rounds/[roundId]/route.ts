import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { answerCardErrorResponse } from '@/app/api/lop/answer-cards/guard'
import { loadAnswerCardRoundForTeacherPg, patchAnswerCardRoundPg } from '@/lib/db/answer-card-pg'
import { tutoringClassFeatureBlock } from '@/lib/db/tutoring-package-pg'

async function teacherId() {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: NextResponse.json({ error: auth.error }, { status: 401 }) }
  return { userId: auth.user.id }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params
  const auth = await teacherId()
  if ('error' in auth) return auth.error
  try {
    const view = await loadAnswerCardRoundForTeacherPg(roundId, auth.userId)
    if (!view) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const block = await tutoringClassFeatureBlock(view.classId)
    if (block === 'grace') return NextResponse.json({ error: 'grace' }, { status: 403 })
    if (block === 'dissolved' || block === 'missing') return NextResponse.json({ error: 'missing' }, { status: 404 })
    return NextResponse.json(view)
  } catch (error) {
    return answerCardErrorResponse(error)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params
  const auth = await teacherId()
  if ('error' in auth) return auth.error
  let body: { action?: unknown; questionIndex?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const action = body.action
  const focusIndex = action === 'focus' && typeof body.questionIndex === 'number' && Number.isInteger(body.questionIndex)
    ? body.questionIndex
    : null
  if (
    action !== 'show'
    && action !== 'hide'
    && action !== 'next'
    && action !== 'prev'
    && action !== 'end'
    && focusIndex == null
  ) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  try {
    const existing = await loadAnswerCardRoundForTeacherPg(roundId, auth.userId)
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const block = await tutoringClassFeatureBlock(existing.classId)
    if (block === 'grace') return NextResponse.json({ error: 'grace' }, { status: 403 })
    if (block === 'dissolved' || block === 'missing') return NextResponse.json({ error: 'missing' }, { status: 404 })
    const view = focusIndex == null
      ? await patchAnswerCardRoundPg(roundId, auth.userId, action as 'show' | 'hide' | 'next' | 'prev' | 'end')
      : await patchAnswerCardRoundPg(roundId, auth.userId, 'focus', focusIndex)
    if (!view) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(view)
  } catch (error) {
    return answerCardErrorResponse(error)
  }
}
