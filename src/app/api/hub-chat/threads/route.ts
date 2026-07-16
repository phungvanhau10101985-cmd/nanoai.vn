import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { pgDeleteHubChatThread, pgListHubChatThreads } from '@/lib/db/hub-chat-pg'

export async function GET(request: NextRequest) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const limitRaw = request.nextUrl.searchParams.get('limit')
  const limit = limitRaw ? Number(limitRaw) : undefined
  const threads = await pgListHubChatThreads(auth.user.id, {
    limit: Number.isFinite(limit) ? limit : undefined,
  })

  return NextResponse.json({ ok: true, threads })
}

export async function DELETE(request: NextRequest) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const threadId = request.nextUrl.searchParams.get('threadId')?.trim()
  if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 })

  const deleted = await pgDeleteHubChatThread(auth.user.id, threadId)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}