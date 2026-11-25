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

function readDisplayedChoices(value: unknown): Array<{ id: string; choices: string[] }> {
  if (!Array.isArray(value)) return []
  const out: Array<{ id: string; choices: string[] }> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as { id?: unknown; choices?: unknown }
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    const choices = Array.isArray(row.choices)
      ? row.choices.map((choice) => String(choice ?? '').trim()).filter((choice) => choice.length > 0)
      : []
    if (!id || choices.length < 2 || choices.length > 4) continue
    out.push({ id, choices })
    if (out.length >= 200) break
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
  let body: { sourceKind?: unknown; sourceId?: unknown; questions?: unknown; displayedChoices?: unknown }
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
  const displayedChoices = sourceKind === 'exam' ? readDisplayedChoices(body.displayedChoices) : []
  const questions = displayedChoices.length > 0 ? [] : readInlineQuestions(body.questions)
  try {
    const created = await createAnswerCardRoundPg({
      classId: id,
      teacherId: gate.userId,
      sourceKind,
      sourceId,
      questions: questions.length > 0 ? questions : undefined,
      displayedChoices: displayedChoices.length > 0 ? displayedChoices : undefined,
    })
    if (created === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (created === 'no_mcq') return NextResponse.json({ error: 'no_mcq' }, { status: 422 })
    if (created === 'mismatch') return NextResponse.json({ error: 'mismatch' }, { status: 400 })
    if (!created) return NextResponse.json({ error: 'error' }, { status: 503 })
    return NextResponse.json(created)
  } catch (error) {
    return answerCardErrorResponse(error)
  }
}
