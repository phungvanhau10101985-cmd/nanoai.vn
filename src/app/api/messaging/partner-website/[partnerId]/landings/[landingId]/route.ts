import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  deletePartnerLandingPagePg,
  fetchPartnerLandingPageByIdPg,
  setPartnerLandingPublishedPg,
  updatePartnerLandingPagePg,
} from '@/lib/db/messaging-partner-landing-pages-pg'
import { listLandingSectionsPg } from '@/lib/db/messaging-partner-landing-sections-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { PARTNER_LANDING_MAX_PRODUCTS } from '@/lib/partner-website/landing/partner-landing-types'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  normalizePartnerLandingSlug,
  validatePartnerLandingSlug,
} from '@/lib/partner-website/partner-website-slug'
import { partnerSiteLandingPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

function siteBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto}://${host}`.replace(/\/$/, '')
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')
  if (process.env.NODE_ENV === 'production') return defaultPublicOrigin().replace(/\/$/, '')
  return req.nextUrl.origin
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; landingId: string }> }
) {
  const { partnerId, landingId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId.trim(), 'website')
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const landing = await fetchPartnerLandingPageByIdPg(partnerId.trim(), landingId.trim())
  if (!landing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId.trim())
  const base = siteBaseUrl(req)
  const sections = await listLandingSectionsPg(landing.id)
  return NextResponse.json({
    landing,
    sections,
    publicUrl:
      website && landing.isPublished
        ? `${base}${partnerSiteLandingPath(website.siteSlug, landing.landingSlug)}`
        : null,
  })
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; landingId: string }> }
) {
  const { partnerId, landingId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  const pid = partnerId.trim()
  const lid = landingId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const body = (await req.json()) as {
    action?: 'publish' | 'unpublish' | 'save'
    title?: string
    briefText?: string
    landingSlug?: string
    inventoryIds?: unknown
    locale?: string
    sourceType?: string
    categoryId?: string | null
    productsLimit?: number
    materialFilter?: string | null
    metaTitle?: string | null
    metaDescription?: string | null
  }

  if (body.action === 'publish' || body.action === 'unpublish') {
    const existing = await fetchPartnerLandingPageByIdPg(pid, lid)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (body.action === 'publish') {
      // L3.6/L3.8 — landing dùng engine Ladipage AI mới (có section) chỉ cần hero đã "ready";
      // landing cũ (chưa có section nào) giữ nguyên điều kiện cũ (đã build HTML tự do).
      const sections = await listLandingSectionsPg(lid)
      const hasReadySections = sections.some((s) => s.sectionType === 'hero' && s.status === 'ready')
      const hasLegacyBuild = Boolean(existing.htmlSource?.trim() || existing.project.files.length)
      if (!hasReadySections && !hasLegacyBuild) {
        return NextResponse.json({ error: 'Build landing (or generate hero section) before publishing' }, { status: 400 })
      }
    }
    const landing = await setPartnerLandingPublishedPg({
      partnerId: pid,
      landingId: lid,
      published: body.action === 'publish',
    })
    if (!landing) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    const website = await fetchPartnerWebsiteByPartnerIdPg(pid)
    const base = siteBaseUrl(req)
    return NextResponse.json({
      success: true,
      landing,
      publicUrl:
        website && landing.isPublished
          ? `${base}${partnerSiteLandingPath(website.siteSlug, landing.landingSlug)}`
          : null,
    })
  }

  const existingForUpdate = await fetchPartnerLandingPageByIdPg(pid, lid)
  const effectiveSourceType =
    body.sourceType === 'category' || body.sourceType === 'products'
      ? body.sourceType
      : existingForUpdate?.sourceType ?? 'products'

  const inventoryIds = Array.isArray(body.inventoryIds)
    ? body.inventoryIds.map((x) => String(x ?? '').trim()).filter(Boolean)
    : undefined
  if (
    effectiveSourceType === 'products' &&
    inventoryIds &&
    (inventoryIds.length < 1 || inventoryIds.length > PARTNER_LANDING_MAX_PRODUCTS)
  ) {
    return NextResponse.json(
      { error: `Select 1–${PARTNER_LANDING_MAX_PRODUCTS} products` },
      { status: 400 }
    )
  }

  let landingSlug: string | undefined
  if (body.landingSlug !== undefined) {
    landingSlug = normalizePartnerLandingSlug(body.landingSlug)
    const slugErr = validatePartnerLandingSlug(landingSlug)
    if (slugErr) return NextResponse.json({ error: slugErr }, { status: 400 })
  }

  const landing = await updatePartnerLandingPagePg({
    partnerId: pid,
    landingId: lid,
    title: body.title,
    briefText: body.briefText,
    landingSlug,
    inventoryIds,
    locale: normalizeWebLocale(body.locale) ?? undefined,
    sourceType: body.sourceType === 'category' || body.sourceType === 'products' ? body.sourceType : undefined,
    categoryId: body.categoryId,
    productsLimit: body.productsLimit,
    materialFilter: body.materialFilter,
    metaTitle: body.metaTitle,
    metaDescription: body.metaDescription,
  })
  if (!landing) {
    return NextResponse.json({ error: 'Update failed' }, { status: 400 })
  }
  return NextResponse.json({ success: true, landing })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; landingId: string }> }
) {
  const { partnerId, landingId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId.trim(), 'website')
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  const ok = await deletePartnerLandingPagePg(partnerId.trim(), landingId.trim())
  if (!ok) return NextResponse.json({ error: 'Delete failed' }, { status: 404 })
  return NextResponse.json({ success: true })
}
