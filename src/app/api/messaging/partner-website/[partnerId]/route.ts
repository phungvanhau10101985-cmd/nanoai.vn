import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
  setPartnerWebsitePublishedPg,
  updatePartnerWebsiteDraftPg,
} from '@/lib/db/messaging-partner-websites-pg'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { composePartnerWebsiteHtmlAsync } from '@/lib/partner-website/compose-partner-website-html'
import { syncPartnerWebsiteFullLandingPg } from '@/lib/partner-website/sync-partner-website-full-landing'
import {
  composeStandaloneHtml,
  normalizePartnerWebsiteProject,
} from '@/lib/partner-website/partner-website-project'
import { resolvePartnerWebsitePublicUrl } from '@/lib/partner-website/resolve-partner-website-public-url'

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

  const locale = normalizeWebLocale(req.nextUrl.searchParams.get('locale')) ?? 'vi'
  let website = await fetchPartnerWebsiteByPartnerIdPg(pid)

  if (website?.renderMode === 'template') {
    const synced = await syncPartnerWebsiteFullLandingPg({
      partnerId: pid,
      locale,
      refreshHtml: true,
    })
    if (synced.website) website = synced.website
  }

  const publicUrl = website
    ? await resolvePartnerWebsitePublicUrl({
        partnerId: pid,
        siteSlug: website.siteSlug,
        isPublished: website.isPublished,
        req,
      })
    : null
  return NextResponse.json({
    website,
    autoProvisioned: false,
    creationInProgress: website
      ? !website.creationJournals?.journals?.home ||
        website.creationJournals.journals.home.phase !== 'built'
      : true,
    homeBuilt: Boolean(
      website?.creationJournals?.journals?.home?.phase === 'built'
    ),
    publicUrl,
  })
}

export async function PATCH(
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

  const body = (await req.json()) as {
    action?: 'publish' | 'unpublish' | 'save_draft'
    title?: string
    briefText?: string
    logoUrl?: string | null
    htmlSource?: string | null
    project?: unknown
    theme?: unknown
    visualEdited?: boolean
  }

  if (body.action === 'publish' || body.action === 'unpublish') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) {
      return NextResponse.json({ error: 'Website not found — generate first' }, { status: 404 })
    }
    if (body.action === 'publish') {
      const locale = normalizeWebLocale(req.nextUrl.searchParams.get('locale')) ?? existing.locale ?? 'vi'
      const synced = await syncPartnerWebsiteFullLandingPg({
        partnerId: pid,
        locale,
        refreshHtml: true,
      })
      const draft = synced.website ?? existing
      const profile = await fetchPartnerProfileForWebsitePg(pid)
      const chatPath = profile ? `/messaging/p/${encodeURIComponent(profile.slug)}` : undefined
      const html =
        draft.renderMode === 'template'
          ? (await composePartnerWebsiteHtmlAsync(
              { ...draft, partnerId: pid, siteSlug: draft.siteSlug },
              { chatPath, hydrateInventory: true }
            )) ||
            draft.htmlSource?.trim() ||
            ''
          : composeStandaloneHtml(draft.project) || draft.htmlSource?.trim() || ''
      if (!html || html.length < 20) {
        return NextResponse.json(
          { error: 'Website has no HTML content — generate again before publish' },
          { status: 400 }
        )
      }
      const savedHtml = await updatePartnerWebsiteDraftPg({
        partnerId: pid,
        pages: draft.pages,
        project: draft.project,
        htmlSource: html,
        chatPath,
      })
      if (!savedHtml) {
        return NextResponse.json({ error: 'Could not save website HTML before publish' }, { status: 500 })
      }
    }
    const updated = await setPartnerWebsitePublishedPg({
      partnerId: pid,
      isPublished: body.action === 'publish',
    })
    if (!updated) {
      return NextResponse.json({ error: 'Could not update publish state' }, { status: 500 })
    }
    const publicUrl = await resolvePartnerWebsitePublicUrl({
      partnerId: pid,
      siteSlug: updated.siteSlug,
      isPublished: updated.isPublished,
      req,
    })
    return NextResponse.json({
      success: true,
      website: updated,
      publicUrl,
    })
  }

  const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
  if (!existing) {
    return NextResponse.json({ error: 'Website not found or save failed' }, { status: 404 })
  }

  const project = body.project ? normalizePartnerWebsiteProject(body.project) : null
  const theme =
    body.visualEdited === true ? { ...existing.theme, useVisualHtml: true as const } : undefined

  const updated = await updatePartnerWebsiteDraftPg({
    partnerId: pid,
    title: body.title,
    briefText: body.briefText,
    logoUrl: body.logoUrl,
    theme,
    project: project ?? undefined,
    htmlSource:
      body.htmlSource !== undefined
        ? body.htmlSource
        : project
          ? composeStandaloneHtml(project)
          : undefined,
  })

  if (!updated) {
    return NextResponse.json({ error: 'Website not found or save failed' }, { status: 404 })
  }

  const publicUrl = await resolvePartnerWebsitePublicUrl({
    partnerId: pid,
    siteSlug: updated.siteSlug,
    isPublished: updated.isPublished,
    req,
  })
  return NextResponse.json({
    success: true,
    website: updated,
    publicUrl,
  })
}
