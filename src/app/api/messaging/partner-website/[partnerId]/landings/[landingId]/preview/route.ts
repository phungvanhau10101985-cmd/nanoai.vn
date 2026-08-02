import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { fetchPartnerLandingPageByIdPg } from '@/lib/db/messaging-partner-landing-pages-pg'
import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
} from '@/lib/db/messaging-partner-websites-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { loadPartnerLandingProductSnapshots } from '@/lib/partner-website/landing/partner-landing-products'
import { renderPartnerLandingHtml } from '@/lib/partner-website/landing/render-partner-landing-html'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; landingId: string }> }
) {
  const { partnerId, landingId } = await ctx.params
  if (!isPgConfigured()) {
    return new NextResponse('Database not configured', { status: 503 })
  }

  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return new NextResponse(auth.error, { status: 401 })
  }

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) {
    return new NextResponse(access.error, { status: access.status })
  }

  const website = await fetchPartnerWebsiteByPartnerIdPg(pid)
  const landing = await fetchPartnerLandingPageByIdPg(pid, landingId.trim())
  if (!website || !landing) {
    return new NextResponse('Not found', { status: 404 })
  }

  const partner = await fetchPartnerProfileForWebsitePg(pid)
  const chatPath = partner
    ? `/messaging/p/${encodeURIComponent(partner.slug)}`
    : `/messaging/p/${encodeURIComponent(website.siteSlug)}`

  const products = await loadPartnerLandingProductSnapshots({
    partnerId: pid,
    siteSlug: website.siteSlug,
    inventoryIds: landing.inventoryIds,
  })

  const html = renderPartnerLandingHtml({
    project: landing.project,
    htmlSource: landing.htmlSource,
    chatPath,
    siteSlug: website.siteSlug,
    locale: landing.locale,
    products,
  })

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
