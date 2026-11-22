import { NextResponse } from 'next/server'
import { answerCardErrorResponse, requireAnswerCardTeacher } from '@/app/api/lop/answer-cards/guard'
import { createAnswerCardRoundPg } from '@/lib/db/answer-card-pg'
import { scanQuestionFromParts, type ScanQuestion } from '@/lib/lop/answer-card'

function readInlineQuestions(value: unknown): ScanQuestion[] {
  if (!Array.isArray(value)) return []
  const out: ScanQuestion[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as { prompt?: unknown; choices?: unknown; correctIndex?: unknown }
    const question = scanQuestionFromParts(row.prompt, row.choices, row.correctIndex)
    if (!question) continue
    out.push(question)
    if (out.length >= 40) break
  }
  return out
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const gate = await requireAnswerCardTeacher(id)
  if ('error' in gate) return gate.error
  let body: { sourceKind?: unknown; sourceId?: unknown; questions?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const sourceKind = body.sourceKind === 'worksheet' ? 'worksheet' : body.sourceKind === 'exam' ? 'exam' : null
  const sourceId = typeof body.sourceId === 'string' ? body.sourceId.trim() : ''
  if (!sourceKind || !sourceId) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const questions = readInlineQuestions(body.questions)
  try {
    const created = await createAnswerCardRoundPg({
      classId: id,
      teacherId: gate.userId,
      sourceKind,
      sourceId,
      questions: questions.length > 0 ? questions : undefined,
    })
    if (created === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (created === 'no_mcq') return NextResponse.json({ error: 'no_mcq' }, { status: 422 })
    if (!created) return NextResponse.json({ error: 'error' }, { status: 503 })
    return NextResponse.json(created)
  } catch (error) {
    return answerCardErrorResponse(error)
  }
}
