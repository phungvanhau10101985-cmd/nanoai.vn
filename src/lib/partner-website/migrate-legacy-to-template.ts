import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
  upsertPartnerWebsitePg,
} from '@/lib/db/messaging-partner-websites-pg'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { buildDefaultLandingV1Site } from '@/lib/partner-website/template/default-landing-v1'
import { syncTemplateToProject } from '@/lib/partner-website/template/sync-template-project'

/**
 * Converts a legacy HTML project site to landing-v1 template mode.
 * Preserves publish state, slug, title, logo; replaces UI with full default template.
 */
export async function migrateLegacyPartnerWebsiteToTemplatePg(input: {
  partnerId: string
  locale: WebLocale
}): Promise<{ website: PartnerWebsiteRow | null; migrated: boolean; reason?: string }> {
  const pid = input.partnerId.trim()
  if (!pid) return { website: null, migrated: false, reason: 'missing_partner' }

  const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
  if (!existing) return { website: null, migrated: false, reason: 'not_found' }
  if (existing.renderMode === 'template' && existing.pages?.length) {
    return { website: existing, migrated: false, reason: 'already_template' }
  }

  const partner = await fetchPartnerProfileForWebsitePg(pid)
  if (!partner) return { website: null, migrated: false, reason: 'partner_not_found' }

  const title =
    existing.title?.trim() ||
    partner.brandName?.trim() ||
    partner.displayName?.trim() ||
    'Shop'
  const templateSite = buildDefaultLandingV1Site({
    locale: input.locale,
    title,
    briefText: existing.briefText?.trim() || title,
    logoUrl: existing.logoUrl ?? partner.logoUrl,
  })
  const project = syncTemplateToProject(templateSite)
  const chatPath = `/messaging/p/${encodeURIComponent(partner.slug)}`

  const saved = await upsertPartnerWebsitePg({
    partnerId: pid,
    siteSlug: existing.siteSlug,
    title,
    briefText: existing.briefText?.trim() || title,
    logoUrl: existing.logoUrl ?? partner.logoUrl,
    referenceImageUrls: existing.referenceImageUrls,
    renderMode: 'template',
    templateId: templateSite.templateId,
    theme: templateSite.theme,
    pages: templateSite.pages,
    project,
    locale: input.locale,
    changeNote: 'migrate_legacy_to_template',
    chatPath,
  })

  return { website: saved, migrated: Boolean(saved) }
}
