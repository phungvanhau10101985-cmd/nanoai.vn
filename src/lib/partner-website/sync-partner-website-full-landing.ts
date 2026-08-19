import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
  updatePartnerWebsiteDraftPg,
} from '@/lib/db/messaging-partner-websites-pg'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { syncTemplateToProject } from '@/lib/partner-website/template/sync-template-project'
import {
  normalizeVisualCategoryPaths,
  normalizeVisualCmsSlugs,
  normalizeVisualPageKeys,
  normalizeVisualProductIds,
  preserveAndRecolorVisualPageFiles,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import {
  isFullLandingV1Template,
  upgradeLandingV1Pages,
} from '@/lib/partner-website/template/upgrade-landing-v1-template'

export type SyncPartnerWebsiteFullLandingResult = {
  website: PartnerWebsiteRow | null
  upgraded: boolean
  htmlRefreshed: boolean
}

/**
 * Ensures landing-v1 has personalization sections + fresh composed HTML (inventory + scripts).
 */
export async function syncPartnerWebsiteFullLandingPg(input: {
  partnerId: string
  locale: WebLocale
  refreshHtml?: boolean
}): Promise<SyncPartnerWebsiteFullLandingResult> {
  const pid = input.partnerId.trim()
  if (!pid) return { website: null, upgraded: false, htmlRefreshed: false }

  const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
  if (!existing || !isFullLandingV1Template(existing)) {
    return { website: existing, upgraded: false, htmlRefreshed: false }
  }

  // Visual «Sửa nhanh» owns HTML — do not regenerate project from template pages.
  if (existing.theme?.useVisualHtml) {
    return { website: existing, upgraded: false, htmlRefreshed: false }
  }

  const { pages, changed: upgraded } = upgradeLandingV1Pages({
    pages: existing.pages,
    locale: input.locale ?? existing.locale,
  })

  const shouldWrite = upgraded || input.refreshHtml === true
  if (!shouldWrite) {
    return { website: existing, upgraded: false, htmlRefreshed: false }
  }

  const profile = await fetchPartnerProfileForWebsitePg(pid)
  const chatPath = profile ? `/messaging/p/${encodeURIComponent(profile.slug)}` : undefined
  const synced = syncTemplateToProject({
    templateId: existing.templateId,
    theme: existing.theme,
    pages,
  })
  const project = preserveAndRecolorVisualPageFiles({
    previous: existing.project,
    next: synced,
    theme: existing.theme,
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

  const saved = await updatePartnerWebsiteDraftPg({
    partnerId: pid,
    pages,
    project,
    chatPath,
  })

  return {
    website: saved,
    upgraded,
    htmlRefreshed: Boolean(saved),
  }
}
