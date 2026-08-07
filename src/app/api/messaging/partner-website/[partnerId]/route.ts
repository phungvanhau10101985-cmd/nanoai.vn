import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
  listPartnerWebsiteRevisionsPg,
  restorePartnerWebsiteRevisionPg,
  setPartnerWebsitePublishedPg,
  updatePartnerWebsiteDraftPg,
  updatePartnerWebsiteNavFooterPg,
} from '@/lib/db/messaging-partner-websites-pg'
import {
  DEFAULT_PARTNER_SITE_FOOTER_LINKS,
  DEFAULT_PARTNER_SITE_NAV_LINKS,
  normalizePartnerSiteNavLinks,
} from '@/lib/partner-website/shop/partner-site-nav-footer'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { composePartnerWebsiteHtmlAsync } from '@/lib/partner-website/compose-partner-website-html'
import { syncPartnerWebsiteFullLandingPg } from '@/lib/partner-website/sync-partner-website-full-landing'
import {
  composeStandaloneHtml,
  normalizePartnerWebsiteProject,
} from '@/lib/partner-website/partner-website-project'
import { resolvePartnerWebsitePublicUrl } from '@/lib/partner-website/resolve-partner-website-public-url'
import { applyTemplateEditPayload } from '@/lib/partner-website/template/apply-template-edits'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'

/** W2.3 — 5 token màu chỉnh trực tiếp qua UI (không qua chat AI). fontFamily/logoUrl/useVisualHtml giữ nguyên. */
const EDITABLE_THEME_COLOR_KEYS = ['primaryColor', 'accentColor', 'backgroundColor', 'textColor', 'mutedColor'] as const
type EditableThemeColorKey = (typeof EDITABLE_THEME_COLOR_KEYS)[number]

function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim())
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
    action?:
      | 'publish'
      | 'unpublish'
      | 'save_draft'
      | 'reorder_sections'
      | 'update_theme_colors'
      | 'update_floating_cta'
      | 'update_nav_footer'
      | 'undo_last'
    floatingCta?: unknown
    navJson?: unknown
    footerJson?: unknown
    title?: string
    briefText?: string
    logoUrl?: string | null
    htmlSource?: string | null
    project?: unknown
    theme?: unknown
    visualEdited?: boolean
    // W2.4 — sắp xếp lại section (không qua chat AI).
    pageSlug?: string
    sectionIds?: unknown
    // W2.3 — đổi màu theme trực tiếp (không qua chat AI, không đụng useVisualHtml).
    themeColors?: unknown
  }

  if (body.action === 'reorder_sections') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    if (existing.renderMode !== 'template') {
      return NextResponse.json({ error: 'NOT_TEMPLATE_MODE' }, { status: 400 })
    }
    if (existing.theme.useVisualHtml) {
      return NextResponse.json({ error: 'VISUAL_HTML_LOCKED' }, { status: 409 })
    }
    const pageSlug = String(body.pageSlug ?? '').trim()
    const sectionIds = Array.isArray(body.sectionIds)
      ? body.sectionIds.filter((x): x is string => typeof x === 'string')
      : []
    if (!pageSlug || sectionIds.length === 0) {
      return NextResponse.json({ error: 'Missing pageSlug/sectionIds' }, { status: 400 })
    }
    const result = applyTemplateEditPayload(
      { templateId: existing.templateId, theme: existing.theme, pages: existing.pages },
      { sectionOps: [{ op: 'reorder', pageSlug, sectionIds }] },
      []
    )
    if (result.errors.length > 0) {
      return NextResponse.json({ error: result.errors.join('; ') }, { status: 400 })
    }
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      pages: result.site.pages,
      changeNote: 'reorder_sections',
    })
    if (!updated) return NextResponse.json({ error: 'Could not save section order' }, { status: 500 })
    return NextResponse.json({ success: true, website: updated })
  }

  if (body.action === 'update_theme_colors') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    if (existing.theme.useVisualHtml) {
      return NextResponse.json({ error: 'VISUAL_HTML_LOCKED' }, { status: 409 })
    }
    const raw = (body.themeColors && typeof body.themeColors === 'object' ? body.themeColors : {}) as Record<string, unknown>
    const patch: Partial<Record<EditableThemeColorKey, string>> = {}
    for (const key of EDITABLE_THEME_COLOR_KEYS) {
      if (isHexColor(raw[key])) patch[key] = (raw[key] as string).trim()
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid color provided (expects #rrggbb)' }, { status: 400 })
    }
    const nextTheme: PartnerWebsiteTheme = { ...existing.theme, ...patch }
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      theme: nextTheme,
      changeNote: 'update_theme_colors',
    })
    if (!updated) return NextResponse.json({ error: 'Could not save theme colors' }, { status: 500 })
    return NextResponse.json({ success: true, website: updated })
  }

  if (body.action === 'update_floating_cta') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    const raw =
      body.floatingCta && typeof body.floatingCta === 'object'
        ? (body.floatingCta as Record<string, unknown>)
        : {}
    const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 80) : ''
    const href = typeof raw.href === 'string' ? raw.href.trim().slice(0, 2000) : ''
    const imageUrl =
      typeof raw.imageUrl === 'string' && raw.imageUrl.trim()
        ? raw.imageUrl.trim().slice(0, 2000)
        : null
    const enabled = raw.enabled === true
    if (enabled && !href) {
      return NextResponse.json({ error: 'href required when enabled' }, { status: 400 })
    }
    const nextTheme: PartnerWebsiteTheme = {
      ...existing.theme,
      floatingCta: {
        enabled,
        label: label || 'CTA',
        href: href || '#',
        imageUrl,
      },
    }
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      theme: nextTheme,
      changeNote: 'update_floating_cta',
    })
    if (!updated) return NextResponse.json({ error: 'Could not save floating CTA' }, { status: 500 })
    return NextResponse.json({ success: true, website: updated })
  }

  if (body.action === 'update_nav_footer') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    if (existing.theme.useVisualHtml) {
      return NextResponse.json({ error: 'VISUAL_HTML_LOCKED' }, { status: 409 })
    }
    const navJson = normalizePartnerSiteNavLinks(body.navJson, DEFAULT_PARTNER_SITE_NAV_LINKS)
    const footerJson = normalizePartnerSiteNavLinks(body.footerJson, DEFAULT_PARTNER_SITE_FOOTER_LINKS)
    const updated = await updatePartnerWebsiteNavFooterPg({ partnerId: pid, navJson, footerJson })
    if (!updated) return NextResponse.json({ error: 'Could not save nav/footer' }, { status: 500 })
    return NextResponse.json({ success: true, website: updated })
  }

  // W2.4 — hoàn tác thao tác gần nhất = restore revision mới nhất.
  if (body.action === 'undo_last') {
    const revs = await listPartnerWebsiteRevisionsPg(pid, 1)
    const latest = revs[0]
    if (!latest) {
      return NextResponse.json({ error: 'NO_REVISION' }, { status: 404 })
    }
    const restored = await restorePartnerWebsiteRevisionPg({ partnerId: pid, revisionId: latest.id })
    if (!restored) return NextResponse.json({ error: 'Could not restore revision' }, { status: 500 })
    return NextResponse.json({ success: true, website: restored })
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
