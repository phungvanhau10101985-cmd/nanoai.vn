import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Lưu PushSubscription sau khi user bật thông báo trên PWA/trình duyệt.
 */
export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    } | null

    if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 })
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: String(body.endpoint),
        p256dh: String(body.keys.p256dh),
        auth: String(body.keys.auth),
        user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    )

    if (error) {
      console.error('[push/subscribe]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[push/subscribe]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
