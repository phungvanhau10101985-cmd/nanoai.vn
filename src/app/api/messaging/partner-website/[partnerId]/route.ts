import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
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
import { clearMessagingPartnerLogoUrlPg } from '@/lib/db/messaging-partners-pg'
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
  clearBrandLogoInHtml,
  clearBrandLogoInProject,
  ensureBrandLogoInHtml,
  ensureBrandLogoInProject,
} from '@/lib/partner-website/partner-website-logo-guard'
import {
  applyFirstImageLogoToHtml,
  applyFirstImageLogoToProject,
} from '@/lib/partner-website/visual-editor/apply-first-image-logo'
import {
  applyChatIconLogoToHtml,
  applyChatIconLogoToProject,
} from '@/lib/partner-website/visual-editor/apply-chat-icon-logo'
import {
  applySlotLogoToHtml,
  applySlotLogoToProject,
  isPersistableLogoUrl,
} from '@/lib/partner-website/visual-editor/apply-slot-logo'
import type { PartnerWebsiteFileKind } from '@/lib/partner-website/partner-website-types'
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
  applyVisualEditThemeFlag,
  categoryVisualHtmlPath,
  cmsVisualHtmlPath,
  normalizeVisualCategoryPath,
  normalizeVisualCategoryPaths,
  normalizeVisualCmsSlug,
  normalizeVisualCmsSlugs,
  normalizeVisualPageKeys,
  normalizeVisualProductId,
  normalizeVisualProductIds,
  parseVisualDeviceVariant,
  preserveAndRecolorVisualPageFiles,
  productVisualHtmlPath,
  visualEditorHtmlPath,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { sanitizeVisualHtmlForStore } from '@/lib/partner-website/visual-editor/serialize-visual-editor-html'
import { normalizeVisualCoordinateContract } from '@/lib/partner-website/visual-editor/normalize-visual-coordinate-contract'
import { seedVisualPageHtmlWithChrome } from '@/lib/partner-website/visual-editor/copy-element-across-pages'
import {
  finalizeVisualEditorSave,
  visualHomeHtmlSourceAfterSave,
} from '@/lib/partner-website/visual-editor/finalize-visual-editor-save'
import {
  publishVisualInfoPageToCms,
  shouldPublishVisualPageToCms,
} from '@/lib/partner-website/pages/sync-info-page-cms'
import { bumpSiteCache, hashShopCachePayload } from '@/lib/cache/partner-shop-cache'
import { fillMissingShopVisualDeviceFiles } from '@/lib/partner-website/shop/seed-shop-template-visual-website'
import {
  resolvePartnerVisualHtmlVariantsForTarget,
  selectPartnerVisualHtmlDevice,
  type PartnerVisualHtmlTarget,
} from '@/lib/partner-website/shop/render-partner-visual-html'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'

type VisualLiveGateSelection = {
  hash: string
  sourceDevice: 'desktop' | 'laptop' | 'tablet' | 'mobile'
}

function resolveVisualLiveGateSelection(
  website: {
    theme?: PartnerWebsiteTheme | null
    project?: { entryPath: string; files: Array<{ path: string; kind: PartnerWebsiteFileKind; content: string }> } | null
    htmlSource?: string | null
  },
  target: PartnerVisualHtmlTarget,
  device: 'desktop' | 'laptop' | 'tablet' | 'mobile'
): VisualLiveGateSelection | null {
  const variants = resolvePartnerVisualHtmlVariantsForTarget(website, target)
  const selected = selectPartnerVisualHtmlDevice(variants, device)
  const html = selected?.html?.trim() || ''
  if (!selected || html.length < 40) return null
  return {
    hash: hashShopCachePayload(html),
    sourceDevice: selected.sourceDevice,
  }
}

async function persistFilledVisualDeviceFiles(
  existing: PartnerWebsiteRow,
  partnerId: string
): Promise<PartnerWebsiteRow> {
  if (existing.renderMode !== 'template') return existing
  const profile = await fetchPartnerProfileForWebsitePg(partnerId)
  const chatPath = profile ? `/messaging/p/${encodeURIComponent(profile.slug)}` : undefined
  const filled = fillMissingShopVisualDeviceFiles({
    project: existing.project,
    theme: existing.theme,
    pages: existing.pages,
    locale: existing.locale,
    siteSlug: existing.siteSlug,
    brand: existing.title,
    logoUrl: existing.logoUrl,
    templateId: existing.templateId,
    chatPath,
    htmlSource: existing.htmlSource,
  })
  if (!filled.changed) return existing
  return (
    (await updatePartnerWebsiteDraftPg({
      partnerId,
      project: filled.project,
      theme: filled.theme,
      htmlSource: filled.htmlSource || existing.htmlSource,
      chatPath,
      changeNote: 'publish_fill_device_html',
    })) ?? existing
  )
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

  type PartnerWebsitePatchBody = {
    action?:
      | 'publish'
      | 'unpublish'
      | 'save_draft'
      | 'update_floating_cta'
      | 'update_chat_launcher'
      | 'update_chat_icon_logo'
      | 'update_logo_slot'
      | 'update_brand'
      | 'update_logo_url'
      | 'clear_logo'
      | 'update_theme_colors'
      | 'update_shop_home_copy'
      | 'undo_last'
    floatingCta?: unknown
    hideChatLauncher?: unknown
    chatIconLogoUrl?: string | null
    logoSlot?: 'favicon' | 'header' | 'footer' | 'chat'
    title?: string
    briefText?: string
    logoUrl?: string | null
    htmlSource?: string | null
    project?: unknown
    theme?: unknown
    visualEdited?: boolean
    visualPageKey?: string
    visualDevice?: 'desktop' | 'laptop' | 'tablet' | 'mobile'
    visualCategoryPath?: string
    visualProductId?: string
    visualCmsSlug?: string
    fashionHome?: unknown
  }

  let body: PartnerWebsitePatchBody
  try {
    body = (await req.json()) as PartnerWebsitePatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid or too large save payload' }, { status: 400 })
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

  if (body.action === 'update_chat_launcher') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    const hidden = body.hideChatLauncher === true
    const nextTheme: PartnerWebsiteTheme = { ...existing.theme }
    if (hidden) nextTheme.hideChatLauncher = true
    else nextTheme.hideChatLauncher = false
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      theme: nextTheme,
      changeNote: 'update_chat_launcher',
    })
    if (!updated) return NextResponse.json({ error: 'Could not save chat launcher' }, { status: 500 })
    return NextResponse.json({ success: true, website: updated })
  }

  if (body.action === 'update_chat_icon_logo') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    const chatIconLogoUrl = typeof body.chatIconLogoUrl === 'string' ? body.chatIconLogoUrl.trim() : ''
    if (!chatIconLogoUrl || !/^https?:\/\//i.test(chatIconLogoUrl)) {
      return NextResponse.json({ error: 'chatIconLogoUrl required' }, { status: 400 })
    }
    const nextTheme: PartnerWebsiteTheme = {
      ...existing.theme,
      chatIconLogoUrl,
    }
    const nextProject = applyChatIconLogoToProject(existing.project, chatIconLogoUrl)
    const nextHtmlSource = existing.htmlSource
      ? applyChatIconLogoToHtml(existing.htmlSource, chatIconLogoUrl)
      : existing.htmlSource
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      theme: nextTheme,
      project: nextProject,
      htmlSource: nextHtmlSource,
      skipRevision: true,
      changeNote: 'update_chat_icon_logo',
    })
    if (!updated) return NextResponse.json({ error: 'Could not save chat icon logo' }, { status: 500 })
    return NextResponse.json({ success: true, website: updated })
  }

  if (body.action === 'update_logo_slot') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    const slot = body.logoSlot
    if (slot !== 'favicon' && slot !== 'header' && slot !== 'footer' && slot !== 'chat') {
      return NextResponse.json({ error: 'logoSlot required' }, { status: 400 })
    }
    const rawUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : ''
    const clear = body.logoUrl === null || body.logoUrl === ''
    if (!clear && !isPersistableLogoUrl(rawUrl)) {
      return NextResponse.json({ error: 'logoUrl required' }, { status: 400 })
    }
    const logoUrl = clear ? '' : rawUrl

    if (slot === 'favicon') {
      const nextTheme: PartnerWebsiteTheme = {
        ...existing.theme,
        faviconUrl: logoUrl || null,
      }
      const updated = await updatePartnerWebsiteDraftPg({
        partnerId: pid,
        theme: nextTheme,
        skipRevision: true,
        changeNote: 'update_logo_slot:favicon',
      })
      if (!updated) return NextResponse.json({ error: 'Could not save favicon' }, { status: 500 })
      return NextResponse.json({ success: true, website: updated })
    }

    if (slot === 'chat') {
      const htmlLogo =
        logoUrl ||
        (typeof existing.logoUrl === 'string' ? existing.logoUrl.trim() : '') ||
        (typeof existing.theme.logoUrl === 'string' ? existing.theme.logoUrl.trim() : '')
      const nextTheme: PartnerWebsiteTheme = {
        ...existing.theme,
        chatIconLogoUrl: logoUrl || null,
      }
      const nextProject = isPersistableLogoUrl(htmlLogo)
        ? applyChatIconLogoToProject(existing.project, htmlLogo)
        : existing.project
      const nextHtmlSource =
        existing.htmlSource && isPersistableLogoUrl(htmlLogo)
          ? applyChatIconLogoToHtml(existing.htmlSource, htmlLogo)
          : existing.htmlSource
      const updated = await updatePartnerWebsiteDraftPg({
        partnerId: pid,
        theme: nextTheme,
        project: nextProject,
        htmlSource: nextHtmlSource,
        skipRevision: true,
        changeNote: 'update_logo_slot:chat',
      })
      if (!updated) return NextResponse.json({ error: 'Could not save logo' }, { status: 500 })
      return NextResponse.json({ success: true, website: updated })
    }

    const device = parseVisualDeviceVariant(body.visualDevice)
    const nextProject = applySlotLogoToProject(
      existing.project,
      slot,
      logoUrl,
      device,
      existing.title
    )
    const sourceHtml = existing.htmlSource?.trim() || ''
    const sourceDevice = parseVisualDeviceVariant(
      sourceHtml.match(/data-pw-edit-device=["']([^"']+)["']/i)?.[1]
    )
    const nextHtmlSource =
      sourceHtml && sourceDevice === device
        ? applySlotLogoToHtml(sourceHtml, slot, logoUrl, existing.title)
        : existing.htmlSource
    const nextTheme: PartnerWebsiteTheme = existing.theme
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      theme: nextTheme,
      project: nextProject,
      htmlSource: nextHtmlSource,
      skipRevision: true,
      changeNote: `update_logo_slot:${slot}:${device}`,
    })
    if (!updated) return NextResponse.json({ error: 'Could not save logo' }, { status: 500 })
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
      body.logoUrl === null || body.logoUrl === ''
        ? null
        : typeof body.logoUrl === 'string'
          ? body.logoUrl.trim() || null
          : existing.logoUrl
    const nextTheme: PartnerWebsiteTheme = {
      ...existing.theme,
      logoUrl,
    }
    const nextProject = logoUrl
      ? ensureBrandLogoInProject(existing.project, logoUrl, title)
      : clearBrandLogoInProject(existing.project)
    const visualHtml = existing.theme?.useVisualHtml
      ? logoUrl
        ? ensureBrandLogoInHtml(
            existing.htmlSource?.trim() || composeStandaloneHtml(nextProject) || '',
            logoUrl,
            title
          )
        : clearBrandLogoInHtml(
            existing.htmlSource?.trim() || composeStandaloneHtml(nextProject) || ''
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
    if (!logoUrl) await clearMessagingPartnerLogoUrlPg(pid)
    const publicUrl = await resolvePartnerWebsitePublicUrl({
      partnerId: pid,
      siteSlug: updated.siteSlug,
      isPublished: updated.isPublished,
      req,
    })
    return NextResponse.json({ success: true, website: updated, publicUrl })
  }

  if (body.action === 'clear_logo') {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!existing) return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    const nextTheme: PartnerWebsiteTheme = {
      ...existing.theme,
      logoUrl: null,
    }
    const nextProject = clearBrandLogoInProject(existing.project)
    const visualHtml = clearBrandLogoInHtml(
      existing.htmlSource?.trim() || composeStandaloneHtml(nextProject) || ''
    )
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      logoUrl: null,
      theme: nextTheme,
      project: nextProject,
      htmlSource: visualHtml,
      changeNote: 'clear_logo',
    })
    if (!updated) return NextResponse.json({ error: 'Could not remove logo' }, { status: 500 })
    await clearMessagingPartnerLogoUrlPg(pid)
    const publicUrl = await resolvePartnerWebsitePublicUrl({
      partnerId: pid,
      siteSlug: updated.siteSlug,
      isPublished: updated.isPublished,
      req,
    })
    return NextResponse.json({ success: true, website: { ...updated, logoUrl: null }, publicUrl })
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
    const nextProject = applyFirstImageLogoToProject(existing.project, logoUrl, existing.title)
    const nextHtmlSource = existing.htmlSource
      ? applyFirstImageLogoToHtml(existing.htmlSource, logoUrl, existing.title)
      : existing.htmlSource
    const updated = await updatePartnerWebsiteDraftPg({
      partnerId: pid,
      logoUrl,
      theme: nextTheme,
      project: nextProject,
      htmlSource: nextHtmlSource,
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
      previousTheme: existing.theme,
      visualPageKeys: normalizeVisualPageKeys(existing.theme.visualPageKeys),
      visualMobilePageKeys: normalizeVisualPageKeys(existing.theme.visualMobilePageKeys),
      visualTabletPageKeys: normalizeVisualPageKeys(existing.theme.visualTabletPageKeys),
      visualLaptopPageKeys: normalizeVisualPageKeys(existing.theme.visualLaptopPageKeys),
      visualCategoryPaths: normalizeVisualCategoryPaths(existing.theme.visualCategoryPaths),
      visualMobileCategoryPaths: normalizeVisualCategoryPaths(existing.theme.visualMobileCategoryPaths),
      visualTabletCategoryPaths: normalizeVisualCategoryPaths(existing.theme.visualTabletCategoryPaths),
      visualLaptopCategoryPaths: normalizeVisualCategoryPaths(existing.theme.visualLaptopCategoryPaths),
      visualProductIds: normalizeVisualProductIds(existing.theme.visualProductIds),
      visualMobileProductIds: normalizeVisualProductIds(existing.theme.visualMobileProductIds),
      visualTabletProductIds: normalizeVisualProductIds(existing.theme.visualTabletProductIds),
      visualLaptopProductIds: normalizeVisualProductIds(existing.theme.visualLaptopProductIds),
      visualCmsSlugs: normalizeVisualCmsSlugs(existing.theme.visualCmsSlugs),
      visualMobileCmsSlugs: normalizeVisualCmsSlugs(existing.theme.visualMobileCmsSlugs),
      visualTabletCmsSlugs: normalizeVisualCmsSlugs(existing.theme.visualTabletCmsSlugs),
      visualLaptopCmsSlugs: normalizeVisualCmsSlugs(existing.theme.visualLaptopCmsSlugs),
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
      const ready = await persistFilledVisualDeviceFiles(existing, pid)
      // React storefront shops: one live site (theme/pages). Do not generate a second HTML homepage.
      if (isFullLandingV1Template(ready)) {
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
      const locale = normalizeWebLocale(req.nextUrl.searchParams.get('locale')) ?? ready.locale ?? 'vi'
      const synced = await syncPartnerWebsiteFullLandingPg({
        partnerId: pid,
        locale,
        refreshHtml: true,
      })
      const draft = synced.website ?? ready
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
  const visualDevice = parseVisualDeviceVariant(body.visualDevice)
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
  const visualTarget: PartnerVisualHtmlTarget | null =
    body.visualEdited === true
      ? visualProductId
        ? { kind: 'product', productId: visualProductId }
        : visualCmsSlug
          ? { kind: 'cms', cmsSlug: visualCmsSlug }
          : visualCategoryPath
            ? { kind: 'category', categoryPath: visualCategoryPath }
            : { kind: 'page', pageKey: visualPageKey }
      : null
  const liveBeforeSelection =
    visualTarget && body.visualEdited === true
      ? resolveVisualLiveGateSelection(existing, visualTarget, visualDevice)
      : null
  const theme =
    body.visualEdited === true
      ? applyVisualEditThemeFlag(existing.theme, {
          pageKey: visualPageKey,
          variant: visualDevice,
          categoryPath: visualCategoryPath,
          productId: visualProductId,
          cmsSlug: visualCmsSlug,
        })
      : undefined
  const incomingHtml =
    typeof body.htmlSource === 'string' ? sanitizeVisualHtmlForStore(body.htmlSource).trim() : ''
  const visualHtmlExact =
    body.visualEdited === true &&
    !isDynamicVisualTarget &&
    visualPageKey === 'home' &&
    visualDevice === 'desktop'
      ? incomingHtml.length >= 40
        ? incomingHtml
        : extractIndexHtml(project ?? existing.project)?.trim() || existing.htmlSource
      : undefined
  const pageHtmlExact =
    body.visualEdited === true &&
    (isDynamicVisualTarget || !(visualPageKey === 'home' && visualDevice === 'desktop'))
      ? incomingHtml.length >= 40
        ? incomingHtml
        : project?.files.find((f) => f.path === htmlPath && f.kind === 'html')?.content
      : undefined
  const targetVisualHtml = normalizeVisualCoordinateContract(
    sanitizeVisualHtmlForStore(visualHtmlExact || pageHtmlExact || '').trim(),
    { variant: visualDevice, writeCanonicalOnly: true }
  )
  if (body.visualEdited === true && targetVisualHtml.length < 40) {
    return NextResponse.json({ error: 'Visual HTML is empty — cannot save' }, { status: 400 })
  }
  let htmlForVisualSave = targetVisualHtml
  if (
    body.visualEdited === true &&
    htmlForVisualSave.length >= 40 &&
    shouldPublishVisualPageToCms({ pageKey: visualPageKey, cmsSlug: visualCmsSlug })
  ) {
    htmlForVisualSave = await publishVisualInfoPageToCms({
      partnerId: pid,
      html: htmlForVisualSave,
      pageKey: visualPageKey,
      cmsSlug: visualCmsSlug,
    })
  }
  const finalizedVisual =
    body.visualEdited === true && htmlForVisualSave.length >= 40
      ? finalizeVisualEditorSave({
          project: existing.project,
          theme: theme || existing.theme,
          htmlPath,
          sourceHtml: htmlForVisualSave,
          visualDevice,
          visualProductId,
          htmlSource: existing.htmlSource,
          seedMissingHtml: (_path, pageKey) =>
            seedVisualPageHtmlWithChrome({
              pageKey,
              variant: visualDevice,
              locale: existing.locale,
              siteSlug: existing.siteSlug,
              brand: existing.title || existing.siteSlug,
              chromeSourceHtml: htmlForVisualSave,
            }),
        })
      : null
  const themeForSave = finalizedVisual?.theme ?? theme
  const projectToSave = finalizedVisual?.project ?? project
  const visualHtmlToPersist =
    body.visualEdited === true && (finalizedVisual?.canonicalHtml.length ?? 0) >= 40
      ? finalizedVisual?.canonicalHtml || ''
      : htmlForVisualSave
  const htmlSourceFromSharedChrome = finalizedVisual
    ? visualHomeHtmlSourceAfterSave(finalizedVisual, existing.htmlSource)
    : existing.htmlSource

  const updated = await updatePartnerWebsiteDraftPg({
    partnerId: pid,
    title: body.title,
    briefText: body.briefText,
    logoUrl: body.logoUrl,
    theme: themeForSave,
    project: projectToSave ?? undefined,
    htmlSource:
      body.visualEdited === true
        ? htmlSourceFromSharedChrome
        : visualHtmlExact !== undefined
          ? htmlForVisualSave
          : body.htmlSource !== undefined
            ? body.htmlSource == null
              ? body.htmlSource
              : sanitizeVisualHtmlForStore(body.htmlSource)
            : projectToSave
              ? composeStandaloneHtml(projectToSave)
              : undefined,
    changeNote: body.visualEdited === true ? 'visual_edit' : undefined,
  })

  if (!updated) {
    return NextResponse.json({ error: 'Could not save website HTML' }, { status: 500 })
  }

  if (body.visualEdited === true) {
    revalidatePath('/dashboard/messaging/website')
    revalidatePath('/dashboard/messaging/p')
    if (updated.siteSlug?.trim()) {
      revalidatePath(`/dashboard/messaging/p/${updated.siteSlug}/website`)
      revalidatePath(`/site/${updated.siteSlug}`)
      await bumpSiteCache(updated.siteSlug)
    }
  }

  const publicUrl = await resolvePartnerWebsitePublicUrl({
    partnerId: pid,
    siteSlug: updated.siteSlug,
    isPublished: updated.isPublished,
    req,
  })
  const canonicalPersistedHtml =
    body.visualEdited === true
      ? updated.project?.files
          .find((file) => file.kind === 'html' && file.path === htmlPath)
          ?.content?.trim() ||
        (htmlPath === 'index.html' ? updated.htmlSource?.trim() : '') ||
        visualHtmlToPersist
      : ''
  if (body.visualEdited === true && visualTarget) {
    const persistedHash = hashShopCachePayload(canonicalPersistedHtml)
    const liveAfterSelection = resolveVisualLiveGateSelection(updated, visualTarget, visualDevice)
    if (!liveAfterSelection) {
      return NextResponse.json(
        {
          error: 'Visual save rejected: live target is missing after save',
          code: 'VISUAL_LIVE_TARGET_MISSING',
          runtimeGate: {
            htmlPath,
            device: visualDevice,
            persistedHash,
            liveBeforeHash: liveBeforeSelection?.hash || '',
          },
        },
        { status: 409 }
      )
    }
    if (liveAfterSelection.sourceDevice !== visualDevice) {
      return NextResponse.json(
        {
          error: 'Visual save rejected: live resolved to a different device',
          code: 'VISUAL_LIVE_DEVICE_MISMATCH',
          runtimeGate: {
            htmlPath,
            device: visualDevice,
            sourceDevice: liveAfterSelection.sourceDevice,
            persistedHash,
            liveBeforeHash: liveBeforeSelection?.hash || '',
            liveAfterHash: liveAfterSelection.hash,
          },
        },
        { status: 409 }
      )
    }
  }
  return NextResponse.json({
    success: true,
    website: updated,
    publicUrl,
    ...(body.visualEdited === true
      ? {
          canonicalVisual: {
            html: canonicalPersistedHtml,
            htmlPath,
            device: visualDevice,
            revision: updated.updatedAt,
            sourceHash: hashShopCachePayload(canonicalPersistedHtml),
          },
        }
      : {}),
  })
}
