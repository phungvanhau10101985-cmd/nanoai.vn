import { NextRequest, NextResponse } from 'next/server'
import { resolveActivePartnerCustomDomainByHostPg } from '@/lib/db/messaging-partner-custom-domains-pg'
import { isPlatformAppHostname } from '@/lib/messaging/partner-custom-domain-platform-host'
import { partnerCustomDomainSeoHostname } from '@/lib/messaging/partner-custom-domain-hostname'

export const dynamic = 'force-dynamic'

function buildRewriteRootPath(row: NonNullable<Awaited<ReturnType<typeof resolveActivePartnerCustomDomainByHostPg>>>): string {
  if (row.use_for_site && row.site_published && row.site_slug) {
    return `/site/${encodeURIComponent(row.site_slug)}`
  }
  if (row.use_for_chat && row.partner_slug) {
    return `/messaging/p/${encodeURIComponent(row.partner_slug)}`
  }
  if (row.site_slug) return `/site/${encodeURIComponent(row.site_slug)}`
  return `/messaging/p/${encodeURIComponent(row.partner_slug)}`
}

/** Resolve verified custom domain → internal rewrite path (middleware + edge). */
export async function GET(request: NextRequest) {
  const hostRaw =
    request.nextUrl.searchParams.get('host')?.trim().toLowerCase() ||
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase() ||
    request.headers.get('host')?.split(',')[0]?.trim().toLowerCase() ||
    ''

  const host = hostRaw.split(':')[0]
  if (!host || isPlatformAppHostname(host)) {
    return NextResponse.json({ found: false })
  }

  const row = await resolveActivePartnerCustomDomainByHostPg(host)
  if (!row) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({
    found: true,
    hostname: host,
    canonicalHostname: partnerCustomDomainSeoHostname(host),
    partnerId: row.partner_id,
    partnerSlug: row.partner_slug,
    siteSlug: row.site_slug,
    useForSite: row.use_for_site,
    sitePublished: row.site_published,
    rewriteRootPath: buildRewriteRootPath(row),
  })
}
