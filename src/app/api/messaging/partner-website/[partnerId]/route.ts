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
} from '@/lib/db/messaging-partner-websites-pg'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { composePartnerWebsiteHtmlAsync } from '@/lib/partner-website/compose-partner-website-html'
import { syncPartnerWebsiteFullLandingPg } from '@/lib/partner-website/sync-partner-website-full-landing'
import {
  composeStandaloneHtml,
  extractIndexHtml,
  normalizePartnerWebsiteProject,
} from '@/lib/partner-website/partner-website-project'
import { resolvePartnerWebsitePublicUrl } from '@/lib/partner-website/resolve-partner-website-public-url'
import {
  ensureBrandLogoInHtml,
  ensureBrandLogoInProject,
} from '@/lib/partner-website/partner-website-logo-guard'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { syncTemplateToProject } from '@/lib/partner-website/template/sync-template-project'
import { isFullLandingV1Template } from '@/lib/partner-website/template/upgrade-landing-v1-template'
import { applyFashionHomeCopyToPages, parseFashionHomeCopyPatch } from '@/lib/partner-website/shop/build-fashion-home-copy'
import {
  mergeShopThemeColors,
  parseThemeColorPatch,
  rewriteThemeCssVarsInHtml,
} from '@/lib/partner-website/template/partner-website-theme-tokens'
import { normalizePartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import {
  addVisualCategoryPath,
  addVisualCmsSlug,
  addVisualPageKey,
  addVisualProductId,
  categoryVisualHtmlPath,
  cmsVisualHtmlPath,
  normalizeVisualCategoryPath,
  normalizeVisualCategoryPaths,
  normalizeVisualCmsSlug,
  normalizeVisualCmsSlugs,
  normalizeVisualPageKeys,
  normalizeVisualProductId,
  normalizeVisualProductIds,
  preserveAndRecolorVisualPageFiles,
  productVisualHtmlPath,
  visualEditorHtmlPath,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

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
      refreshHtml: false,
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
      | 'update_floating_cta'
      | 'update_brand'
      | 'update_logo_url'
      | 'update_theme_colors'
      | 'update_shop_home_copy'
      | 'undo_last'
    floatingCta?: unknown
    title?: string
    briefText?: string
    logoUrl?: string | null
    htmlSource?: string | null
    project?: unknown
    theme?: unknown
    visualEdited?: boolean
    visualPageKey?: string
    visualDevice?: 'desktop' | 'mobile'
    visualCategoryPath?: string
    visualProductId?: string
    visualCmsSlug?: string
    fashionHome?: unknown
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

  if (body.action === 'update_brand') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    const title =
      typeof body.title === 'string' && body.title.trim().length >= 2
        ? body.title.trim().slice(0, 120)
        : existing.title
    const logoUrl =
      typeof body.logoUrl === 'string'
        ? body.logoUrl.trim() || null
        : existing.logoUrl
    const nextTheme: PartnerWebsiteTheme = {
      ...existing.theme,
      logoUrl,
    }
    const nextProject = logoUrl
      ? ensureBrandLogoInProject(existing.project, logoUrl, title)
      : existing.project
    const visualHtml = existing.theme?.useVisualHtml
      ? ensureBrandLogoInHtml(
          existing.htmlSource?.trim() || composeStandaloneHtml(nextProject) || '',
          logoUrl,
          title
        )
      : undefined
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      title,
      logoUrl,
      theme: nextTheme,
      project: nextProject,
      htmlSource: visualHtml,
      changeNote: 'update_brand',
    })
    if (!updated) return NextResponse.json({ error: 'Could not save brand' }, { status: 500 })
    const publicUrl = await resolvePartnerWebsitePublicUrl({
      partnerId: pid,
      siteSlug: updated.siteSlug,
      isPublished: updated.isPublished,
      req,
    })
    return NextResponse.json({ success: true, website: updated, publicUrl })
  }

  if (body.action === 'update_logo_url') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : ''
    if (!logoUrl || !/^https?:\/\//i.test(logoUrl)) {
      return NextResponse.json({ error: 'logoUrl required' }, { status: 400 })
    }
    const nextTheme: PartnerWebsiteTheme = {
      ...existing.theme,
      logoUrl,
    }
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      logoUrl,
      theme: nextTheme,
      htmlSource: existing.htmlSource,
      skipRevision: true,
      changeNote: 'update_logo_url',
    })
    if (!updated) return NextResponse.json({ error: 'Could not save logo' }, { status: 500 })
    const publicUrl = await resolvePartnerWebsitePublicUrl({
      partnerId: pid,
      siteSlug: updated.siteSlug,
      isPublished: updated.isPublished,
      req,
    })
    return NextResponse.json({ success: true, website: updated, publicUrl })
  }

  if (body.action === 'update_theme_colors') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    const patch = parseThemeColorPatch(body.theme)
    if (!patch) {
      return NextResponse.json({ error: 'Invalid theme colors' }, { status: 400 })
    }
    const nextTheme: PartnerWebsiteTheme = mergeShopThemeColors(existing.theme, patch)
    const visualHtml = existing.theme?.useVisualHtml
      ? rewriteThemeCssVarsInHtml(
          existing.htmlSource?.trim() || composeStandaloneHtml(existing.project) || '',
          nextTheme
        )
      : undefined
    const syncedProject =
      existing.renderMode === 'template'
        ? syncTemplateToProject({
            templateId: existing.templateId,
            theme: nextTheme,
            pages: existing.pages,
          })
        : existing.project
    const nextProject = preserveAndRecolorVisualPageFiles({
      previous: existing.project,
      next: syncedProject,
      theme: nextTheme,
      visualPageKeys: normalizeVisualPageKeys(existing.theme.visualPageKeys),
      visualMobilePageKeys: normalizeVisualPageKeys(existing.theme.visualMobilePageKeys),
      visualCategoryPaths: normalizeVisualCategoryPaths(existing.theme.visualCategoryPaths),
      visualMobileCategoryPaths: normalizeVisualCategoryPaths(existing.theme.visualMobileCategoryPaths),
      visualProductIds: normalizeVisualProductIds(existing.theme.visualProductIds),
      visualMobileProductIds: normalizeVisualProductIds(existing.theme.visualMobileProductIds),
      visualCmsSlugs: normalizeVisualCmsSlugs(existing.theme.visualCmsSlugs),
      visualMobileCmsSlugs: normalizeVisualCmsSlugs(existing.theme.visualMobileCmsSlugs),
    })
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      theme: nextTheme,
      project: nextProject,
      htmlSource: visualHtml,
      changeNote: 'update_theme_colors',
    })
    if (!updated) return NextResponse.json({ error: 'Could not save theme colors' }, { status: 500 })
    const publicUrl = await resolvePartnerWebsitePublicUrl({
      partnerId: pid,
      siteSlug: updated.siteSlug,
      isPublished: updated.isPublished,
      req,
    })
    return NextResponse.json({ success: true, website: updated, publicUrl })
  }

  if (body.action === 'update_shop_home_copy') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    const patch = parseFashionHomeCopyPatch(body.fashionHome)
    if (!patch) {
      return NextResponse.json({ error: 'Invalid shop home copy' }, { status: 400 })
    }
    const pages = applyFashionHomeCopyToPages(existing.pages, patch)
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      pages,
      changeNote: 'update_shop_home',
    })
    if (!updated) return NextResponse.json({ error: 'Could not save shop home' }, { status: 500 })
    const publicUrl = await resolvePartnerWebsitePublicUrl({
      partnerId: pid,
      siteSlug: updated.siteSlug,
      isPublished: updated.isPublished,
      req,
    })
    return NextResponse.json({ success: true, website: updated, publicUrl })
  }

  // Hoàn tác thao tác gần nhất = restore revision mới nhất.
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
      // React storefront shops: one live site (theme/pages). Do not generate a second HTML homepage.
      if (isFullLandingV1Template(existing)) {
        const updated = await setPartnerWebsitePublishedPg({
          partnerId: pid,
          isPublished: true,
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
  const visualPageKey =
    body.visualEdited === true
      ? normalizePartnerWebsitePageKey(body.visualPageKey ?? 'home')
      : 'home'
  const visualDevice = body.visualDevice === 'mobile' ? 'mobile' : 'desktop'
  const visualCategoryPath =
    body.visualEdited === true && typeof body.visualCategoryPath === 'string'
      ? normalizeVisualCategoryPath(body.visualCategoryPath)
      : ''
  const visualProductId =
    body.visualEdited === true && typeof body.visualProductId === 'string'
      ? normalizeVisualProductId(body.visualProductId)
      : ''
  const visualCmsSlug =
    body.visualEdited === true && typeof body.visualCmsSlug === 'string'
      ? normalizeVisualCmsSlug(body.visualCmsSlug)
      : ''
  const htmlPath = visualProductId
    ? productVisualHtmlPath(visualProductId, visualDevice)
    : visualCmsSlug
      ? cmsVisualHtmlPath(visualCmsSlug, visualDevice)
      : visualCategoryPath
        ? categoryVisualHtmlPath(visualCategoryPath, visualDevice)
        : visualEditorHtmlPath(visualPageKey, visualDevice)
  const isDynamicVisualTarget = Boolean(visualProductId || visualCmsSlug || visualCategoryPath)
  const theme =
    body.visualEdited === true
      ? visualProductId
        ? visualDevice === 'mobile'
          ? {
              ...existing.theme,
              visualMobileProductIds: addVisualProductId(
                normalizeVisualProductIds(existing.theme.visualMobileProductIds),
                visualProductId
              ),
            }
          : {
              ...existing.theme,
              visualProductIds: addVisualProductId(
                normalizeVisualProductIds(existing.theme.visualProductIds),
                visualProductId
              ),
            }
        : visualCmsSlug
          ? visualDevice === 'mobile'
            ? {
                ...existing.theme,
                visualMobileCmsSlugs: addVisualCmsSlug(
                  normalizeVisualCmsSlugs(existing.theme.visualMobileCmsSlugs),
                  visualCmsSlug
                ),
              }
            : {
                ...existing.theme,
                visualCmsSlugs: addVisualCmsSlug(
                  normalizeVisualCmsSlugs(existing.theme.visualCmsSlugs),
                  visualCmsSlug
                ),
              }
          : visualCategoryPath
            ? visualDevice === 'mobile'
              ? {
                  ...existing.theme,
                  visualMobileCategoryPaths: addVisualCategoryPath(
                    normalizeVisualCategoryPaths(existing.theme.visualMobileCategoryPaths),
                    visualCategoryPath
                  ),
                }
              : {
                  ...existing.theme,
                  visualCategoryPaths: addVisualCategoryPath(
                    normalizeVisualCategoryPaths(existing.theme.visualCategoryPaths),
                    visualCategoryPath
                  ),
                }
            : visualDevice === 'mobile'
              ? visualPageKey === 'home'
                ? { ...existing.theme, useVisualMobileHtml: true as const }
                : {
                    ...existing.theme,
                    visualMobilePageKeys: addVisualPageKey(
                      normalizeVisualPageKeys(existing.theme.visualMobilePageKeys),
                      visualPageKey
                    ),
                  }
              : visualPageKey === 'home'
                ? { ...existing.theme, useVisualHtml: true as const }
                : {
                    ...existing.theme,
                    visualPageKeys: addVisualPageKey(
                      normalizeVisualPageKeys(existing.theme.visualPageKeys),
                      visualPageKey
                    ),
                  }
      : undefined
  const visualHtmlExact =
    body.visualEdited === true &&
    !isDynamicVisualTarget &&
    visualPageKey === 'home' &&
    visualDevice === 'desktop'
      ? typeof body.htmlSource === 'string' && body.htmlSource.trim().length >= 40
        ? body.htmlSource.trim()
        : extractIndexHtml(project ?? existing.project)?.trim() || existing.htmlSource
      : undefined
  const pageHtmlExact =
    body.visualEdited === true &&
    (isDynamicVisualTarget || !(visualPageKey === 'home' && visualDevice === 'desktop'))
      ? typeof body.htmlSource === 'string' && body.htmlSource.trim().length >= 40
        ? body.htmlSource.trim()
        : project?.files.find((f) => f.path === htmlPath && f.kind === 'html')?.content
      : undefined
  const projectToSave =
    pageHtmlExact && project
      ? {
          ...project,
          files: project.files.some((f) => f.path === htmlPath && f.kind === 'html')
            ? project.files.map((f) =>
                f.path === htmlPath && f.kind === 'html' ? { ...f, content: pageHtmlExact } : f
              )
            : [...project.files, { path: htmlPath, kind: 'html' as const, content: pageHtmlExact }],
        }
      : project

  const updated = await updatePartnerWebsiteDraftPg({
    partnerId: pid,
    title: body.title,
    briefText: body.briefText,
    logoUrl: body.logoUrl,
    theme,
    project: projectToSave ?? undefined,
    htmlSource:
      visualHtmlExact !== undefined
        ? visualHtmlExact
        : body.visualEdited === true
          ? existing.htmlSource
          : body.htmlSource !== undefined
            ? body.htmlSource
            : projectToSave
              ? composeStandaloneHtml(projectToSave)
              : undefined,
    changeNote: body.visualEdited === true ? 'visual_edit' : undefined,
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
