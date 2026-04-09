import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { markAllNotificationsReadForUser } from '@/lib/db/notifications-repo'

/** Đánh dấu mọi thông báo chưa đọc của user là đã đọc (mở chuông = đã xem). */
export async function POST() {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })

    const out = await markAllNotificationsReadForUser(authResult.user!.id)
    if (!out.ok) return NextResponse.json({ error: out.error || 'update_failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[notifications/read-all]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
