import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  insertPartnerLandingPagePg,
  listPartnerLandingPagesPg,
} from '@/lib/db/messaging-partner-landing-pages-pg'
import { ensureDefaultLandingSectionsPg } from '@/lib/db/messaging-partner-landing-sections-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { defaultLandingSectionPlan } from '@/lib/partner-website/landing/landing-ai-types'
import {
  PARTNER_LANDING_CATEGORY_LIMIT_MAX,
  PARTNER_LANDING_MAX_PRODUCTS,
  landingAiKindOf,
  type LandingAiKind,
} from '@/lib/partner-website/landing/partner-landing-types'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  normalizePartnerLandingSlug,
  validatePartnerLandingSlug,
} from '@/lib/partner-website/partner-website-slug'
import { partnerSiteLandingPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

export const maxDuration = 60

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
  ctx: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const website = await fetchPartnerWebsiteByPartnerIdPg(pid)
  const all = await listPartnerLandingPagesPg(pid)
  const kindRaw = String(req.nextUrl.searchParams.get('kind') ?? '').trim()
  const kind: LandingAiKind | '' =
    kindRaw === 'single' || kindRaw === 'category' || kindRaw === 'multi' ? kindRaw : ''
  const landings = kind ? all.filter((lp) => landingAiKindOf(lp) === kind) : all
  const base = siteBaseUrl(req)

  const kindStats = (k: LandingAiKind) => {
    const rows = all.filter((lp) => landingAiKindOf(lp) === k)
    return {
      total: rows.length,
      published: rows.filter((lp) => lp.isPublished).length,
    }
  }

  return NextResponse.json({
    websiteExists: Boolean(website),
    siteSlug: website?.siteSlug ?? null,
    stats: {
      single: kindStats('single'),
      category: kindStats('category'),
      multi: kindStats('multi'),
    },
    landings: landings.map((lp) => ({
      ...lp,
      kind: landingAiKindOf(lp),
      publicUrl:
        website && lp.isPublished
          ? `${base}${partnerSiteLandingPath(website.siteSlug, lp.landingSlug)}`
          : null,
      previewPath: website
        ? `/api/messaging/partner-website/${encodeURIComponent(pid)}/landings/${encodeURIComponent(lp.id)}/preview`
        : null,
    })),
  })
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const website = await fetchPartnerWebsiteByPartnerIdPg(pid)
  if (!website) {
    return NextResponse.json(
      { error: 'Create the main website first before landing pages.' },
      { status: 400 }
    )
  }

  const body = (await req.json()) as {
    title?: string
    briefText?: string
    landingSlug?: string
    inventoryIds?: unknown
    locale?: string
    /** L3.2/L3.6 — "products" | "category". */
    sourceType?: string
    categoryId?: string
    productsLimit?: number
    materialFilter?: string
    includeMaterial?: boolean
    includeFaq?: boolean
  }

  const title = String(body.title ?? '').trim()
  if (title.length < 2) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  const sourceType = body.sourceType === 'category' ? 'category' : 'products'
  const inventoryIds = Array.isArray(body.inventoryIds)
    ? body.inventoryIds.map((x) => String(x ?? '').trim()).filter(Boolean)
    : []
  if (sourceType === 'products' && (inventoryIds.length < 1 || inventoryIds.length > PARTNER_LANDING_MAX_PRODUCTS)) {
    return NextResponse.json(
      { error: `Select 1–${PARTNER_LANDING_MAX_PRODUCTS} products` },
      { status: 400 }
    )
  }
  if (sourceType === 'category' && !String(body.categoryId ?? '').trim()) {
    return NextResponse.json({ error: 'categoryId required for category landing' }, { status: 400 })
  }
  const includeMaterial = body.includeMaterial !== false
  const includeFaq = body.includeFaq !== false
  const materialFilter = String(body.materialFilter ?? '').trim()
  if (sourceType === 'category' && includeMaterial && !materialFilter) {
    return NextResponse.json({ error: 'materialFilter required when material section is enabled' }, { status: 400 })
  }
  const productsLimit = Math.max(
    1,
    Math.min(PARTNER_LANDING_CATEGORY_LIMIT_MAX, Number(body.productsLimit ?? 12) || 12)
  )

  const landingSlug = normalizePartnerLandingSlug(
    body.landingSlug?.trim() || title.replace(/\s+/g, '-').slice(0, 48)
  )
  const slugErr = validatePartnerLandingSlug(landingSlug)
  if (slugErr) {
    return NextResponse.json({ error: slugErr }, { status: 400 })
  }

  const locale = normalizeWebLocale(body.locale) ?? website.locale
  const landing = await insertPartnerLandingPagePg({
    partnerId: pid,
    websiteId: website.id,
    landingSlug,
    title,
    briefText: String(body.briefText ?? '').trim(),
    locale,
    inventoryIds,
    sourceType,
    categoryId: sourceType === 'category' ? String(body.categoryId).trim() : null,
    productsLimit,
    materialFilter: materialFilter || null,
  })

  if (!landing) {
    return NextResponse.json(
      { error: 'Could not create landing (slug may already exist)' },
      { status: 409 }
    )
  }

  // L3.1/L3.6 — landing mới luôn dùng engine Ladipage AI (section cố định) từ đầu.
  await ensureDefaultLandingSectionsPg(landing.id, defaultLandingSectionPlan({ includeMaterial, includeFaq }))

  return NextResponse.json({ success: true, landing })
}
