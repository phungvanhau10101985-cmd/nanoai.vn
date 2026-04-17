import { NextRequest, NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { resolveCanonicalUserIdByEmail } from '@/lib/auth/resolve-canonical-email-user'
import { resolveActiveBirthdayDiscountPercentForLinkedUser } from '@/lib/db/messaging-partner-birthday-promo-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'

export const dynamic = 'force-dynamic'

/**
 * Phiên đăng nhập email: trả % giảm CMSN đang hiệu lực (theo ngày sinh + cấu hình shop), hoặc null.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }
  const partner = await resolveActiveMessagingPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  const loginUser = await getEmailSessionUser()
  if (!loginUser?.email?.trim()) {
    return NextResponse.json({ ok: true, authenticated: false, discountPercent: null })
  }
  const realUserId =
    (await resolveCanonicalUserIdByEmail(loginUser.email.trim())) ?? loginUser.id.trim()
  const discountPercent = await resolveActiveBirthdayDiscountPercentForLinkedUser(partner.id, realUserId)
  return NextResponse.json({
    ok: true,
    authenticated: true,
    discountPercent: discountPercent != null && discountPercent > 0 ? discountPercent : null,
  })
}
