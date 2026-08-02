import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  insertPartnerLandingPagePg,
  listPartnerLandingPagesPg,
} from '@/lib/db/messaging-partner-landing-pages-pg'
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
  const landings = await listPartnerLandingPagesPg(pid)
  const base = siteBaseUrl(req)

  return NextResponse.json({
    websiteExists: Boolean(website),
    siteSlug: website?.siteSlug ?? null,
    landings: landings.map((lp) => ({
      ...lp,
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
  }

  const title = String(body.title ?? '').trim()
  if (title.length < 2) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  const inventoryIds = Array.isArray(body.inventoryIds)
    ? body.inventoryIds.map((x) => String(x ?? '').trim()).filter(Boolean)
    : []
  if (inventoryIds.length < 1 || inventoryIds.length > PARTNER_LANDING_MAX_PRODUCTS) {
    return NextResponse.json(
      { error: `Select 1–${PARTNER_LANDING_MAX_PRODUCTS} products` },
      { status: 400 }
    )
  }

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
  })

  if (!landing) {
    return NextResponse.json(
      { error: 'Could not create landing (slug may already exist)' },
      { status: 409 }
    )
  }

  return NextResponse.json({ success: true, landing })
}
