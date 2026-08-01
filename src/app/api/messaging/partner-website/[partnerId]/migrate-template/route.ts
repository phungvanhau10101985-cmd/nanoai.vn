import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { migrateLegacyPartnerWebsiteToTemplatePg } from '@/lib/partner-website/migrate-legacy-to-template'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { partnerWebsitePublicPath } from '@/lib/partner-website/partner-website-slug'
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

  const locale = normalizeWebLocale(req.nextUrl.searchParams.get('locale')) ?? 'vi'
  const result = await migrateLegacyPartnerWebsiteToTemplatePg({ partnerId: pid, locale })

  if (!result.website) {
    const status = result.reason === 'not_found' ? 404 : 400
    return NextResponse.json({ error: result.reason ?? 'migrate_failed' }, { status })
  }

  const base = siteBaseUrl(req)
  return NextResponse.json({
    website: result.website,
    migrated: result.migrated,
    reason: result.reason,
    publicUrl: result.website.isPublished
      ? `${base}${partnerWebsitePublicPath(result.website.siteSlug)}`
      : null,
  })
}
