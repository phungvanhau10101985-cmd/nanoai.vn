import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { markNotificationReadForUser } from '@/lib/db/notifications-repo'

/** Đánh dấu thông báo đã đọc */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })

    const out = await markNotificationReadForUser(id, authResult.user!.id)
    if (!out.ok) return NextResponse.json({ error: out.error || 'update_failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[notifications/read]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
