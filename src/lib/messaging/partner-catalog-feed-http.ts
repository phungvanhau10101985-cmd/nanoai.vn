import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { fetchPartnerWebsiteConfiguredSiteOriginPg } from '@/lib/db/messaging-partner-custom-domains-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { fetchInventoryProductTypeBreadcrumbsFromPg } from '@/lib/db/messaging-partner-categories-pg'
import { listPartnerInventoryRows } from '@/lib/messaging/partner-inventory-upsert-batch'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'
import type { CatalogFeedBuildContext } from '@/lib/messaging/catalog-feed-enrichment'
import type { CatalogFeedInventoryRow, CatalogFeedShopLanding } from '@/lib/messaging/catalog-feed-shared'

function secureTokenEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}

export type PartnerCatalogFeedContext = CatalogFeedBuildContext & {
  partnerId: string
  rows: CatalogFeedInventoryRow[]
}

export async function loadPartnerCatalogFeedContext(
  request: NextRequest,
  slug: string
): Promise<PartnerCatalogFeedContext | NextResponse> {
  if (isReservedMessagingGuestSlug(slug)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }

  const partner = await resolveActiveMessagingPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const key = url.searchParams.get('key')?.trim() ?? ''
  const embed = (partner.embed_key ?? '').trim()
  if (!embed || !key || !secureTokenEqual(key, embed)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const listed = await listPartnerInventoryRows(partner.id)
  if (!listed.ok) {
    return NextResponse.json({ error: listed.error }, { status: 500 })
  }

  const platformOrigin = getPublicAppUrlForServer(request).replace(/\/$/, '')
  const website = await fetchPartnerWebsiteByPartnerIdPg(partner.id)
  const siteSlug = website?.isPublished && website.siteSlug?.trim() ? website.siteSlug.trim() : null
  let shop: CatalogFeedShopLanding | null = null
  if (siteSlug) {
    const customOrigin = await fetchPartnerWebsiteConfiguredSiteOriginPg(partner.id)
    shop = customOrigin
      ? { siteSlug, origin: customOrigin.replace(/\/$/, ''), customDomain: true }
      : { siteSlug, origin: platformOrigin, customDomain: false }
  }

  const breadcrumbs = await fetchInventoryProductTypeBreadcrumbsFromPg(partner.id)
  const productTypeByInventoryId: Record<string, string> = {}
  for (const [id, breadcrumb] of breadcrumbs) {
    productTypeByInventoryId[id] = breadcrumb
  }

  return {
    partnerId: partner.id,
    partnerSlug: slug,
    brand: (partner.display_name ?? '').trim() || 'Shop',
    platformOrigin,
    shop,
    industryKey: partner.industry_key,
    productTypeByInventoryId,
    rows: listed.rows,
  }
}

export function catalogFeedFileResponse(
  buf: Buffer,
  contentType: string,
  filename: string
): NextResponse {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, max-age=120',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

export function catalogFeedBuildArgs(loaded: PartnerCatalogFeedContext): CatalogFeedBuildContext {
  return {
    platformOrigin: loaded.platformOrigin,
    partnerSlug: loaded.partnerSlug,
    brand: loaded.brand,
    shop: loaded.shop,
    industryKey: loaded.industryKey,
    productTypeByInventoryId: loaded.productTypeByInventoryId,
  }
}
