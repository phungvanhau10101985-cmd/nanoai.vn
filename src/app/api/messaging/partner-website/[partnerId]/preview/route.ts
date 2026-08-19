import { NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
} from '@/lib/db/messaging-partner-websites-pg'
import { composePartnerWebsiteHtmlAsync } from '@/lib/partner-website/compose-partner-website-html'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { renderPartnerWebsiteHtml } from '@/lib/partner-website/partner-website-render'
import { renderPartnerVisualHtmlForPublic } from '@/lib/partner-website/shop/render-partner-visual-html'
import { syncPartnerWebsiteFullLandingPg } from '@/lib/partner-website/sync-partner-website-full-landing'
import { parseVisualDeviceQuery } from '@/lib/partner-website/visual-editor/visual-editor-pages'

export async function GET(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) {
    return new NextResponse('Database not configured', { status: 503 })
  }

  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) {
    return new NextResponse(access.error, { status: access.status })
  }

  const website = await fetchPartnerWebsiteByPartnerIdPg(pid)
  if (!website) {
    return new NextResponse('Website not found — generate first', { status: 404 })
  }

  const profile = await fetchPartnerProfileForWebsitePg(pid)
  const chatPath = profile ? `/messaging/p/${encodeURIComponent(profile.slug)}` : undefined

  const { searchParams } = new URL(req.url)
  const previewDevice = parseVisualDeviceQuery(searchParams.get('pw-device'))
  const skipHtmlRefresh = Boolean(website.theme?.useVisualHtml)
  if (skipHtmlRefresh) {
    const visualHtml = renderPartnerVisualHtmlForPublic(
      { ...website, siteSlug: website.siteSlug, locale: website.locale },
      { kind: 'page', pageKey: 'home' },
      { device: previewDevice }
    )
    if (visualHtml.length >= 40) {
      return new NextResponse(visualHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }
  }

  const synced = skipHtmlRefresh
    ? { website }
    : await syncPartnerWebsiteFullLandingPg({
        partnerId: pid,
        locale: website.locale,
        refreshHtml: true,
      })
  const draft = synced.website ?? website

  const htmlSource =
    (await composePartnerWebsiteHtmlAsync(
      { ...draft, partnerId: pid, siteSlug: draft.siteSlug },
      { chatPath, hydrateInventory: !skipHtmlRefresh }
    )) ||
    draft.htmlSource?.trim() ||
    ''
  if (!htmlSource) {
    return new NextResponse('No HTML content — generate website first', { status: 404 })
  }

  const html = renderPartnerWebsiteHtml({
    project: draft.project,
    htmlSource,
    chatPath,
    siteSlug: draft.siteSlug,
    locale: draft.locale,
    enablePersonalization: false,
    preferHtmlSource: (htmlSource.trim().length >= 40),
  })

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
