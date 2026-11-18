import { NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { pullPhoneRemoteCommands, pushPhoneRemoteCommands } from '@/lib/curriculum/phone-remote-store'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await getEmailSessionUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  const record = body as { id?: unknown; commands?: unknown }
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const commands = Array.isArray(record.commands) ? record.commands : []
  const accepted = await pushPhoneRemoteCommands({
    id,
    userId: user.id,
    commands: commands.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)),
  })
  if (accepted === 0 && commands.length > 0) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, accepted })
}

export async function GET(req: Request) {
  const user = await getEmailSessionUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 })
  const url = new URL(req.url)
  const id = (url.searchParams.get('id') || '').trim()
  const after = Number(url.searchParams.get('after') || '0')
  const commands = await pullPhoneRemoteCommands({
    id,
    userId: user.id,
    after: Number.isFinite(after) ? after : 0,
  })
  if (!commands) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true, commands })
}
