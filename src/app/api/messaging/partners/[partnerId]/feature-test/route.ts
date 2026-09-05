import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { fetchBirthdayPromoForPartnerFromPg } from '@/lib/db/messaging-partner-birthday-promo-pg'
import {
  fetchPartnerFeatureTestSettingsFromPg,
  upsertPartnerBirthdayFeatureTestFromPg,
  upsertPartnerSiteSaleFeatureTestFromPg,
} from '@/lib/db/messaging-partner-feature-test-pg'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { fetchPartnerProfileForWebsitePg } from '@/lib/db/messaging-partner-websites-pg'
import { pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { emailCustomerBirthdayPromo } from '@/lib/messaging/email-customer-birthday-promo'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  birthdayPercentForFeatureTest,
  isBirthdayPromoTestActive,
  isSiteSaleTestActive,
  normalizeFeatureTestEmail,
  normalizeSiteSaleTestPhase,
  PARTNER_FEATURE_TEST_DURATION_MINUTES,
} from '@/lib/partner-website/promotions/partner-feature-test'
import {
  buildPartnerSiteSaleTestState,
  partnerSalePercentForMonth,
} from '@/lib/partner-website/promotions/partner-sale-calendar'
import { partnerSiteCartPath, partnerSiteHomePath } from '@/lib/partner-website/shop/partner-site-shop-paths'

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error }
  const access = await assertPartnerDashboardAccess(
    auth.user.id,
    partnerId,
    'marketing_campaigns'
  )
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error }
  return {
    ok: true as const,
    actorId: auth.user.id,
    adminEmail: auth.user.email?.trim().toLowerCase() || null,
  }
}

async function siteSlugForPartner(partnerId: string): Promise<string | null> {
  const row = await pgQueryOne<{ site_slug: string | null }>(
    `select site_slug from public.messaging_partner_websites
     where partner_id = $1::uuid
     limit 1`,
    [partnerId]
  ).catch(() => null)
  return row?.site_slug?.trim() || null
}

function payloadFor(
  row: Awaited<ReturnType<typeof fetchPartnerFeatureTestSettingsFromPg>>,
  adminEmail: string | null,
  extras: {
    birthdayPercent: number
    siteSalePercent: number
    siteSlug: string | null
  }
) {
  const testEmail = row?.testEmail || adminEmail
  const birthdayEnabled = isBirthdayPromoTestActive(row)
  const siteSaleEnabled = isSiteSaleTestActive(row)
  return {
    ok: true,
    testEmail: testEmail || '',
    adminEmail,
    testDurationMinutes: PARTNER_FEATURE_TEST_DURATION_MINUTES,
    siteSlug: extras.siteSlug,
    homePath: extras.siteSlug ? partnerSiteHomePath(extras.siteSlug) : null,
    cartPath: extras.siteSlug ? partnerSiteCartPath(extras.siteSlug) : null,
    birthday: {
      enabled: birthdayEnabled,
      expiresAt: birthdayEnabled ? row?.birthdayPromoExpiresAt ?? null : null,
      canApplyOnWeb: Boolean(testEmail),
      discountPercent: extras.birthdayPercent,
    },
    siteSale: {
      enabled: siteSaleEnabled,
      expiresAt: siteSaleEnabled ? row?.siteSaleTestExpiresAt ?? null : null,
      phase: row?.siteSaleTestPhase ?? 'active',
      canApplyOnWeb: Boolean(testEmail),
      discountPercent: extras.siteSalePercent,
    },
  }
}

async function extrasForPartner(partnerId: string) {
  const [promo, saleConfig, siteSlug] = await Promise.all([
    fetchBirthdayPromoForPartnerFromPg(partnerId),
    fetchPartnerSaleCalendarConfigFromPg(partnerId),
    siteSlugForPartner(partnerId),
  ])
  const testSale = buildPartnerSiteSaleTestState({ settings: saleConfig, phase: 'active' })
  return {
    birthdayPercent: birthdayPercentForFeatureTest(promo?.discount_percent),
    siteSalePercent:
      partnerSalePercentForMonth(saleConfig, Number(testSale.localDate.slice(5, 7))) ||
      testSale.discountPercent,
    siteSlug,
  }
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const [row, extras] = await Promise.all([
    fetchPartnerFeatureTestSettingsFromPg({
      partnerId,
      actorUserId: access.actorId,
    }),
    extrasForPartner(partnerId),
  ])
  return NextResponse.json(payloadFor(row, access.adminEmail, extras))
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = (await request.json().catch(() => null)) as {
    kind?: string
    enabled?: boolean
    testEmail?: string | null
    phase?: string
  } | null
  const kind = body?.kind === 'site-sale' ? 'site-sale' : body?.kind === 'birthday' ? 'birthday' : null
  if (!kind || typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const testEmail = normalizeFeatureTestEmail(body.testEmail || access.adminEmail)
  if (body.enabled && !testEmail) {
    return NextResponse.json({ error: 'test_email_required' }, { status: 400 })
  }

  const previous = await fetchPartnerFeatureTestSettingsFromPg({
    partnerId,
    actorUserId: access.actorId,
  })
  const wasBirthdayOn = isBirthdayPromoTestActive(previous)

  const row =
    kind === 'birthday'
      ? await upsertPartnerBirthdayFeatureTestFromPg({
          partnerId,
          actorUserId: access.actorId,
          enabled: body.enabled,
          testEmail,
        })
      : await upsertPartnerSiteSaleFeatureTestFromPg({
          partnerId,
          actorUserId: access.actorId,
          enabled: body.enabled,
          phase: normalizeSiteSaleTestPhase(body.phase),
          testEmail,
        })

  if (!row) return NextResponse.json({ error: 'save_failed' }, { status: 500 })

  const extras = await extrasForPartner(partnerId)
  const out = payloadFor(row, access.adminEmail, extras) as ReturnType<typeof payloadFor> & {
    birthday: ReturnType<typeof payloadFor>['birthday'] & {
      testEmailSent?: boolean
      testEmailError?: string | null
    }
  }
  out.birthday.testEmailSent = false
  out.birthday.testEmailError = null

  if (kind === 'birthday' && body.enabled && !wasBirthdayOn && testEmail) {
    const partner = await fetchPartnerProfileForWebsitePg(partnerId)
    const origin = getPublicAppUrlForServer().replace(/\/$/, '')
    const shopUrl = extras.siteSlug
      ? `${origin}${partnerSiteHomePath(extras.siteSlug)}`
      : partner?.slug
        ? `${origin}/messaging/p/${encodeURIComponent(partner.slug)}`
        : origin
    const today = new Date()
    const nextBirthdayLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const mail = await emailCustomerBirthdayPromo({
      toEmail: testEmail,
      shopDisplayName: partner?.displayName || 'Cửa hàng',
      chatUrl: shopUrl,
      discountPercent: extras.birthdayPercent,
      nextBirthdayLabel,
    })
    out.birthday.testEmailSent = mail.ok
    out.birthday.testEmailError = mail.ok ? null : mail.error
  }

  return NextResponse.json(out)
}
