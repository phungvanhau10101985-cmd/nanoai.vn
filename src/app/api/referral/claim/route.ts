import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { parseReferrerUuid } from '@/lib/referral'
import { createUserNotificationWithEmail } from '@/lib/notifications/create-user-notification-server'
import { claimReferralBonusServerPg } from '@/lib/db/referral-claim-pg'
import { isPgConfigured } from '@/lib/db/pool'

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

    const auth = await getUserForAction()
    if ('error' in auth) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
    const user = auth.user

    if (!isPgConfigured()) {
      return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 503 })
    }

    const row = await claimReferralBonusServerPg(inviterId, user.id)
    if (row === null) {
      console.error('[referral/claim] claimReferralBonusServerPg failed')
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }

    if (row?.ok === true && row?.applied === true) {
      try {
        await createUserNotificationWithEmail({
          user_id: inviterId,
          type: 'referral_bonus_inviter',
          title: 'Bạn nhận thưởng giới thiệu',
          body: 'Có người đã tham gia NanoAI qua liên kết giới thiệu của bạn. Tài khoản của bạn được cộng +2 credit. Cảm ơn bạn đã chia sẻ NanoAI.',
          meta: { push_url: '/wallet', bonus_inviter: 2, invitee_user_id: user.id },
        })
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
