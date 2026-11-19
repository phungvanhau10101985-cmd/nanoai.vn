import { NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { isRateLimited } from '@/lib/api/simple-ip-rate-limit'
import {
  createPhoneRemoteSession,
  readPhoneRemoteForUser,
  updatePhoneRemoteFromDesktop,
} from '@/lib/curriculum/phone-remote-store'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export async function POST(req: Request) {
  const user = await getEmailSessionUser()
  if (!user?.id || !user.email) {
    return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  const record = asRecord(body)
  if (!record) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const index = typeof record.index === 'number' ? record.index : undefined
  const snapshot = asRecord(record.snapshot) ?? undefined
  const whiteboard = asRecord(record.whiteboard) ?? undefined
  const phoneReady = record.phoneReady === true

  if (id) {
    const state = await updatePhoneRemoteFromDesktop({
      id,
      userId: user.id,
      index,
      seenGen: typeof record.seenGen === 'number' ? record.seenGen : undefined,
      snapshot,
      seenRevision: typeof record.seenRevision === 'number' ? record.seenRevision : undefined,
      seenWhiteboardGen: typeof record.seenWhiteboardGen === 'number' ? record.seenWhiteboardGen : undefined,
      whiteboard,
      phoneReady,
    })
    if (!state) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, ...state })
  }

  if (!snapshot) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  if (isRateLimited(`phone-remote-create:${user.id}`, 30, 60 * 60_000)) {
    return NextResponse.json({ ok: false, error: 'rate' }, { status: 429 })
  }
  const created = await createPhoneRemoteSession({
    userId: user.id,
    email: user.email,
    snapshot,
    index: index ?? 0,
  })
  if ('error' in created) return NextResponse.json({ ok: false, error: created.error }, { status: 413 })
  return NextResponse.json({ ok: true, id: created.id, secret: created.secret })
}

export async function GET(req: Request) {
  const user = await getEmailSessionUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 })
  const url = new URL(req.url)
  const id = (url.searchParams.get('id') || '').trim()
  const row = await readPhoneRemoteForUser(id, user.id)
  if (!row) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const live = url.searchParams.get('live') === '1'
  return NextResponse.json({
    ok: true,
    index: row.index,
    indexGen: row.indexGen ?? 0,
    revision: row.revision,
    whiteboardGen: row.whiteboardGen ?? 0,
    phoneReady: row.phoneReady === true,
    ...(live ? {} : { snapshot: row.snapshot }),
  })
}
