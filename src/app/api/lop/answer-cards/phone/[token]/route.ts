import { NextResponse } from 'next/server'
import { answerCardErrorResponse } from '@/app/api/lop/answer-cards/guard'
import { loadAnswerCardPhoneViewPg, saveAnswerCardPicksPg, stepAnswerCardPhonePg } from '@/lib/db/answer-card-pg'
import { isAnswerCardPhoneToken, isAnswerChoice } from '@/lib/lop/answer-card'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!isAnswerCardPhoneToken(token)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  try {
    const view = await loadAnswerCardPhoneViewPg(token)
    if (!view) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(view)
  } catch (error) {
    return answerCardErrorResponse(error)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!isAnswerCardPhoneToken(token)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  let body: { picks?: unknown; action?: unknown; questionIndex?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (body.action === 'next' || body.action === 'prev') {
    try {
      const stepped = await stepAnswerCardPhonePg(token, body.action)
      if (stepped === 'closed') return NextResponse.json({ error: 'closed' }, { status: 409 })
      if (!stepped) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      return NextResponse.json(stepped)
    } catch (error) {
      return answerCardErrorResponse(error)
    }
  }
  if (!Array.isArray(body.picks)) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const picks: Array<{ token: string; choice: 'A' | 'B' | 'C' | 'D' }> = []
  for (const item of body.picks.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue
    const row = item as { token?: unknown; choice?: unknown }
    const cardToken = typeof row.token === 'string' ? row.token : ''
    const choice = typeof row.choice === 'string' ? row.choice : ''
    if (!isAnswerChoice(choice)) continue
    picks.push({ token: cardToken, choice })
  }
  try {
    const postedIndex = typeof body.questionIndex === 'number' && Number.isInteger(body.questionIndex)
      ? body.questionIndex
      : undefined
    const saved = await saveAnswerCardPicksPg(token, picks, postedIndex)
    if (saved === 'closed') return NextResponse.json({ error: 'closed' }, { status: 409 })
    if (!saved) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(saved)
  } catch (error) {
    return answerCardErrorResponse(error)
  }
}
