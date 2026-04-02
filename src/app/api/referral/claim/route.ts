import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { parseReferrerUuid } from '@/lib/referral'
import { createUserNotificationWithEmail } from '@/lib/notifications/create-user-notification-server'

/**
 * POST { "inviterId": "<uuid>" } — gọi khi user đã đăng nhập; idempotent.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { inviterId?: string }
    const inviterId = parseReferrerUuid(body?.inviterId)
    if (!inviterId) {
      return NextResponse.json({ ok: false, error: 'invalid_inviter' }, { status: 400 })
    }

    const supabase = createClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('claim_referral_bonus', { p_inviter: inviterId })

    if (error) {
      console.error('[referral/claim]', error.message)
      return NextResponse.json({ ok: false, error: 'rpc_error', detail: error.message }, { status: 500 })
    }

    const row = data as Record<string, unknown> | null

    if (row?.ok === true && row?.applied === true) {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (url && key) {
          const admin = createSupabaseClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
          await createUserNotificationWithEmail(admin, {
            user_id: inviterId,
            type: 'referral_bonus_inviter',
            title: 'Bạn nhận thưởng giới thiệu',
            body: 'Có người đã tham gia NanoAI qua liên kết giới thiệu của bạn. Tài khoản của bạn được cộng +2 credit. Cảm ơn bạn đã chia sẻ NanoAI.',
            meta: { push_url: '/wallet', bonus_inviter: 2, invitee_user_id: user.id },
          })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[referral/claim] notify:', msg)
      }
    }

    return NextResponse.json(row ?? { ok: false, error: 'empty' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: 'server', detail: msg }, { status: 500 })
  }
}
