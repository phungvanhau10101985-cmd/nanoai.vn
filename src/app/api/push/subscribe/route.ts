import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { upsertPushSubscription } from '@/lib/db/push-subscriptions-repo'

/**
 * Lưu PushSubscription sau khi user bật thông báo trên PWA/trình duyệt.
 */
export async function POST(req: Request) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    } | null

    if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 })
    }

    const out = await upsertPushSubscription({
      userId: auth.user.id,
      endpoint: String(body.endpoint),
      p256dh: String(body.keys.p256dh),
      auth: String(body.keys.auth),
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    })

    if (!out.ok) {
      console.error('[push/subscribe]', out.error)
      return NextResponse.json({ error: out.error || 'save_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[push/subscribe]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
