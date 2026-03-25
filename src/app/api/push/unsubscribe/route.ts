import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Xóa subscription: body { endpoint } hoặc không có endpoint → xóa hết thiết bị của user.
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

    const body = (await req.json().catch(() => ({}))) as { endpoint?: string }
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''

    if (endpoint) {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint)
      if (error) {
        console.error('[push/unsubscribe]', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
      if (error) {
        console.error('[push/unsubscribe]', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[push/unsubscribe]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
