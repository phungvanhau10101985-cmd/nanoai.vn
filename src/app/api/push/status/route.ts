import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Có ít nhất một subscription push cho user hiện tại không. */
export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ subscribed: false }, { status: 401 })
    }

    const { count, error } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (error) {
      console.error('[push/status]', error.message)
      return NextResponse.json({ subscribed: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ subscribed: (count ?? 0) > 0 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ subscribed: false, error: msg }, { status: 500 })
  }
}
