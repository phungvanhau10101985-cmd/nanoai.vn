import { NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { setPhoneRemoteStudentOpen } from '@/lib/curriculum/phone-remote-store'

export const dynamic = 'force-dynamic'

/** Slide học sinh báo còn mở hoặc vừa đóng. Mã QR sống theo slide học sinh. */
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
  const record = body as { id?: unknown; alive?: unknown }
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const alive = record.alive !== false
  const ok = await setPhoneRemoteStudentOpen({ id, userId: user.id, alive })
  if (!ok) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
