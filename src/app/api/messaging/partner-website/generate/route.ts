import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchPartnerProfileForWebsitePg,
  upsertPartnerWebsitePg,
} from '@/lib/db/messaging-partner-websites-pg'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { generatePartnerWebsiteProject } from '@/lib/partner-website/partner-website-ai-generator'
import { composePartnerWebsiteHtmlAsync } from '@/lib/partner-website/compose-partner-website-html'
import { partnerWebsitePublicPath, validatePartnerWebsiteSlug } from '@/lib/partner-website/partner-website-slug'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

export const maxDuration = 120

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
      partnerId?: string
      title?: string
      briefText?: string
      logoUrl?: string | null
      referenceImageUrls?: string[]
      siteSlug?: string
      locale?: string
      sourceThreadId?: string | null
    }

    const partnerId = String(body.partnerId ?? '').trim()
    if (!partnerId) {
      return NextResponse.json({ error: 'partnerId required' }, { status: 400 })
    }

    const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'website')
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const partner = await fetchPartnerProfileForWebsitePg(partnerId)
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const briefText = String(body.briefText ?? '').trim()
    if (briefText.length < 8) {
      return NextResponse.json({ error: 'briefText too short' }, { status: 400 })
    }

    const locale = normalizeWebLocale(body.locale) ?? ('vi' as WebLocale)
    const title =
      String(body.title ?? '').trim() ||
      partner.brandName?.trim() ||
      partner.displayName?.trim() ||
      'Website'
    const siteSlugRaw = body.siteSlug?.trim() || partner.slug
    const slugError = validatePartnerWebsiteSlug(siteSlugRaw)
    if (slugError) {
      return NextResponse.json({ error: slugError }, { status: 400 })
    }
    const siteSlug = siteSlugRaw.trim().toLowerCase()

    const logoUrl = body.logoUrl?.trim() || partner.logoUrl?.trim() || null
    const referenceImageUrls = Array.isArray(body.referenceImageUrls)
      ? body.referenceImageUrls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 8)
      : []

    const chatPath = `/messaging/p/${encodeURIComponent(partner.slug)}`
    const { project, source, renderMode, templateId, theme, pages, htmlSource } =
      await generatePartnerWebsiteProject({
      locale,
      title,
      briefText,
      logoUrl,
      referenceImageUrls,
      chatPath,
      userId: auth.user.id,
      userMessage: briefText,
      renderMode: 'template',
    })

    const composedHtml =
      htmlSource ??
      (await composePartnerWebsiteHtmlAsync(
        {
          renderMode: renderMode ?? 'template',
          templateId: templateId ?? 'landing-v1',
          theme: theme!,
          pages: pages ?? [],
          project,
          htmlSource: null,
          locale,
          title,
          logoUrl,
          partnerId,
          siteSlug,
        },
        { chatPath, hydrateInventory: true }
      ))

    const saved = await upsertPartnerWebsitePg({
      partnerId,
      siteSlug,
      title,
      briefText,
      logoUrl,
      referenceImageUrls,
      renderMode: renderMode ?? 'template',
      templateId: templateId ?? 'landing-v1',
      theme,
      pages,
      project,
      htmlSource: composedHtml,
      locale,
      sourceThreadId: body.sourceThreadId?.trim() || null,
      chatPath,
    })

    if (!saved) {
      return NextResponse.json({ error: 'Could not save website project' }, { status: 500 })
    }

    const base = siteBaseUrl(req)
    return NextResponse.json({
      success: true,
      source,
      website: saved,
      previewPath: partnerWebsitePublicPath(siteSlug),
      publicUrl: saved.isPublished ? `${base}${partnerWebsitePublicPath(siteSlug)}` : null,
      fileCount: project.files.length,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
