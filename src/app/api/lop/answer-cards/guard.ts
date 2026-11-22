import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { AnswerCardSchemaError, teacherMayScanClassPg } from '@/lib/db/answer-card-pg'
import { tutoringClassFeatureBlock } from '@/lib/db/tutoring-package-pg'

export function answerCardErrorResponse(error: unknown) {
  if (error instanceof AnswerCardSchemaError) {
    return NextResponse.json({ error: 'schema' }, { status: 503 })
  }
  console.error('[answer-cards]', error)
  return NextResponse.json({ error: 'error' }, { status: 500 })
}

export async function requireAnswerCardTeacher(classId: string) {
  const auth = await getUserForAction()
  if ('error' in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: 401 }) }
  }
  const block = await tutoringClassFeatureBlock(classId)
  if (block === 'grace') {
    return { error: NextResponse.json({ error: 'grace' }, { status: 403 }) }
  }
  if (block === 'dissolved' || block === 'missing') {
    return { error: NextResponse.json({ error: 'missing' }, { status: 404 }) }
  }
  const allowed = await teacherMayScanClassPg(classId, auth.user.id)
  if (allowed == null) {
    return { error: NextResponse.json({ error: 'error' }, { status: 503 }) }
  }
  if (!allowed) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }
  return { userId: auth.user.id }
}
