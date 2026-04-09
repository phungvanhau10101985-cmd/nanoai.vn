import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { deletePushSubscriptionsForUser } from '@/lib/db/push-subscriptions-repo'

/**
 * Xóa subscription: body { endpoint } hoặc không có endpoint → xóa hết thiết bị của user.
 */
export async function POST(req: Request) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { endpoint?: string }
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''

    const out = await deletePushSubscriptionsForUser(auth.user.id, endpoint || undefined)
    if (!out.ok) {
      console.error('[push/unsubscribe]', out.error)
      return NextResponse.json({ error: out.error || 'delete_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[push/unsubscribe]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
