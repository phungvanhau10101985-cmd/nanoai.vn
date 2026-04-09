import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchScreenLiveSignalsAfterPg,
  insertScreenLiveSignalPg,
  isValidScreenLiveRoomCode,
  pruneScreenLiveSignalsOlderThanPg,
} from '@/lib/db/screen-live-pg'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const code = params.code?.trim() ?? ''
  if (!isValidScreenLiveRoomCode(code)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }
  const afterRaw = req.nextUrl.searchParams.get('after')
  const after = afterRaw != null ? parseInt(afterRaw, 10) : 0
  const safeAfter = Number.isFinite(after) && after >= 0 ? Math.floor(after) : 0
  const signals = await fetchScreenLiveSignalsAfterPg(code, safeAfter)
  void pruneScreenLiveSignalsOlderThanPg(30).catch(() => {})
  return NextResponse.json({ signals })
}

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const code = params.code?.trim() ?? ''
  if (!isValidScreenLiveRoomCode(code)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }
  let body: { event?: string; payload?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const event = String(body.event ?? '')
  const ins = await insertScreenLiveSignalPg(code, event, body.payload ?? {})
  if (ins.error) {
    return NextResponse.json({ error: ins.error }, { status: 400 })
  }
  void pruneScreenLiveSignalsOlderThanPg(30).catch(() => {})
  return NextResponse.json({ ok: true })
}
