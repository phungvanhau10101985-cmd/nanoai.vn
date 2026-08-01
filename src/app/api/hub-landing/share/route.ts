import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { insertHubLandingPageSharePg } from '@/lib/db/hub-landing-page-share-pg'
import { getUserForCreditAction } from '@/lib/auth'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import type { LandingPageSection } from '@/lib/hub-chat/landing-page-sections'
import {
  HUB_LANDING_SHARE_EXPIRY_DAYS,
  buildHubLandingShareUrl,
  generateHubLandingShareToken,
} from '@/lib/hub-chat/landing-page-share-utils'

export async function POST(req: NextRequest) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const auth = await getUserForCreditAction()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = (await req.json()) as {
      title?: string
      logoUrl?: string | null
      sections?: LandingPageSection[]
      htmlSource?: string | null
      threadId?: string | null
      locale?: string
    }

    const sections = Array.isArray(body.sections)
      ? body.sections.filter(
          (s) =>
            s &&
            typeof s.key === 'string' &&
            typeof s.url === 'string' &&
            s.url.trim().length > 0
        )
      : []

    const htmlSource = body.htmlSource !== undefined ? String(body.htmlSource) : undefined
    const hasHtml = Boolean(htmlSource?.trim() && htmlSource.trim().length > 20)

    if (!sections.length && !hasHtml) {
      return NextResponse.json({ error: 'sections or htmlSource required' }, { status: 400 })
    }

    const locale = normalizeWebLocale(body.locale) ?? ('vi' as WebLocale)
    const shareToken = generateHubLandingShareToken()
    const expiresAt = new Date(
      Date.now() + HUB_LANDING_SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    )

    const ok = await insertHubLandingPageSharePg({
      shareToken,
      userId: auth.user.id,
      threadId: body.threadId?.trim() || null,
      payload: {
        title: String(body.title ?? 'Landing Page').trim() || 'Landing Page',
        logoUrl: body.logoUrl ?? null,
        sections,
        htmlSource: htmlSource ?? null,
      },
      locale,
      expiresAtIso: expiresAt.toISOString(),
    })

    if (ok !== true) {
      return NextResponse.json({ error: 'Could not create share link' }, { status: 500 })
    }

    const shareUrl = buildHubLandingShareUrl(req, shareToken)
    return NextResponse.json({
      success: true,
      shareToken,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
