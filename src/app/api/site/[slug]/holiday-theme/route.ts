import { NextRequest, NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { resolvePartnerHolidayPublicState } from '@/lib/partner-website/promotions/partner-holiday-theme'
import { normalizeWebLocale } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const previewToken = request.nextUrl.searchParams.get('preview_token') || request.nextUrl.searchParams.get('previewToken')
  const previewCode = request.nextUrl.searchParams.get('preview_holiday') || request.nextUrl.searchParams.get('previewHoliday')
  const sessionUser = await getEmailSessionUser()
  let canSeeAdminPreview = false
  if (sessionUser?.id) {
    const access = await assertPartnerDashboardAccess(sessionUser.id, shop.partnerId, 'website_promotions')
    canSeeAdminPreview = access.ok
  }
  const state = await resolvePartnerHolidayPublicState({
    partnerId: shop.partnerId,
    locale: normalizeWebLocale(shop.site.locale) ?? 'vi',
    previewToken,
    previewCode,
    canSeeAdminPreview,
  })
  return NextResponse.json({ ok: true, ...state })
}
