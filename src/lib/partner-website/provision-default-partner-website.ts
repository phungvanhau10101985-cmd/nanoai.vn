import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
  upsertPartnerWebsitePg,
} from '@/lib/db/messaging-partner-websites-pg'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { buildDefaultLandingV1Site } from '@/lib/partner-website/template/default-landing-v1'
import { syncTemplateToProject } from '@/lib/partner-website/template/sync-template-project'
import { validatePartnerWebsiteSlug } from '@/lib/partner-website/partner-website-slug'
import { syncPartnerWebsiteFullLandingPg } from '@/lib/partner-website/sync-partner-website-full-landing'
import { isFullLandingV1Template } from '@/lib/partner-website/template/upgrade-landing-v1-template'

/**
 * Ensures each messaging partner has a full template landing (landing-v1) ready to use.
 * Idempotent: returns existing row if already provisioned.
 */
export async function ensureDefaultPartnerWebsitePg(input: {
  partnerId: string
  locale: WebLocale
}): Promise<{ website: PartnerWebsiteRow | null; created: boolean }> {
  const pid = input.partnerId.trim()
  if (!pid) return { website: null, created: false }

  const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
  if (existing?.pages?.length && existing.renderMode === 'template') {
    if (isFullLandingV1Template(existing)) {
      const synced = await syncPartnerWebsiteFullLandingPg({
        partnerId: pid,
        locale: input.locale,
        refreshHtml: true,
      })
      if (synced.website) return { website: synced.website, created: false }
    }
    return { website: existing, created: false }
  }
  if (existing?.project?.files?.length && existing.renderMode === 'legacy') {
    return { website: existing, created: false }
  }

  const partner = await fetchPartnerProfileForWebsitePg(pid)
  if (!partner) return { website: null, created: false }

  const title = partner.brandName?.trim() || partner.displayName?.trim() || 'Shop'
  const siteSlugRaw = partner.slug.trim().toLowerCase()
  if (validatePartnerWebsiteSlug(siteSlugRaw)) {
    return { website: existing, created: false }
  }

  const templateSite = buildDefaultLandingV1Site({
    locale: input.locale,
    title,
    briefText: title,
    logoUrl: partner.logoUrl,
  })
  const project = syncTemplateToProject(templateSite)
  const chatPath = `/messaging/p/${encodeURIComponent(partner.slug)}`

  const saved = await upsertPartnerWebsitePg({
    partnerId: pid,
    siteSlug: siteSlugRaw,
    title,
    briefText: title,
    logoUrl: partner.logoUrl,
    referenceImageUrls: [],
    renderMode: 'template',
    templateId: templateSite.templateId,
    theme: templateSite.theme,
    pages: templateSite.pages,
    project,
    locale: input.locale,
    skipRevision: true,
    changeNote: 'auto_provision_default_landing',
    chatPath,
  })

  return { website: saved, created: Boolean(saved) }
}
