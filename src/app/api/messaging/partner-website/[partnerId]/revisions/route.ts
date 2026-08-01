import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  listPartnerWebsiteRevisionsPg,
  restorePartnerWebsiteRevisionPg,
} from '@/lib/db/messaging-partner-websites-pg'
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

  const revisions = await listPartnerWebsiteRevisionsPg(pid)
  return NextResponse.json({ revisions })
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

  const body = (await req.json()) as { revisionId?: string }
  const revisionId = String(body.revisionId ?? '').trim()
  if (!revisionId) {
    return NextResponse.json({ error: 'revisionId required' }, { status: 400 })
  }

  const website = await restorePartnerWebsiteRevisionPg({ partnerId: pid, revisionId })
  if (!website) {
    return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
  }

  const base = siteBaseUrl(req)
  return NextResponse.json({
    success: true,
    website,
    publicUrl: website.isPublished ? `${base}${partnerWebsitePublicPath(website.siteSlug)}` : null,
  })
}
