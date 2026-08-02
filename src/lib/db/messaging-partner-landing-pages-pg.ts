import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import {
  PARTNER_LANDING_MAX_PRODUCTS,
  type PartnerLandingPagePublicRow,
  type PartnerLandingPageRow,
} from '@/lib/partner-website/landing/partner-landing-types'
import {
  parseProjectFilesFromDb,
  projectFilesToJson,
} from '@/lib/partner-website/partner-website-project'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

function asUuidArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .slice(0, PARTNER_LANDING_MAX_PRODUCTS)
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
}

type LandingDbRow = {
  id: string
  partner_id: string
  website_id: string
  landing_slug: string
  title: string | null
  brief_text: string | null
  locale: string | null
  inventory_ids: unknown
  project_files_json: unknown
  html_source: string | null
  reference_image_urls: unknown
  mockup_url: string | null
  is_published: boolean | null
  published_at: unknown
  created_at: unknown
  updated_at: unknown
  [key: string]: unknown
}

function mapLandingRow(r: LandingDbRow): PartnerLandingPageRow {
  return {
    id: r.id,
    partnerId: r.partner_id,
    websiteId: r.website_id,
    landingSlug: r.landing_slug,
    title: r.title?.trim() || '',
    briefText: r.brief_text?.trim() || '',
    locale: normalizeWebLocale(r.locale) ?? 'vi',
    inventoryIds: asUuidArray(r.inventory_ids),
    project: parseProjectFilesFromDb(r.project_files_json),
    htmlSource: r.html_source?.trim() || null,
    referenceImageUrls: asStringArray(r.reference_image_urls),
    mockupUrl: r.mockup_url?.trim() || null,
    isPublished: Boolean(r.is_published),
    publishedAt: r.published_at ? String(r.published_at) : null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

const SELECT_COLS = `id::text, partner_id::text, website_id::text, landing_slug, title, brief_text,
  locale, inventory_ids, project_files_json, html_source, reference_image_urls, mockup_url,
  is_published, published_at, created_at, updated_at`

export async function listPartnerLandingPagesPg(
  partnerId: string
): Promise<PartnerLandingPageRow[]> {
  if (!isPgConfigured()) return []
  const pid = partnerId.trim()
  if (!pid) return []
  try {
    const rows = await pgQuery<LandingDbRow>(
      `select ${SELECT_COLS}
       from public.messaging_partner_landing_pages
       where partner_id = $1::uuid
       order by created_at desc`,
      [pid]
    )
    return rows.map(mapLandingRow)
  } catch (e) {
    console.error('[messaging-partner-landing-pages-pg] listPartnerLandingPagesPg', e)
    return []
  }
}

export async function fetchPartnerLandingPageByIdPg(
  partnerId: string,
  landingId: string
): Promise<PartnerLandingPageRow | null> {
  if (!isPgConfigured()) return null
  const pid = partnerId.trim()
  const lid = landingId.trim()
  if (!pid || !lid) return null
  try {
    const row = await pgQueryOne<LandingDbRow>(
      `select ${SELECT_COLS}
       from public.messaging_partner_landing_pages
       where partner_id = $1::uuid and id = $2::uuid
       limit 1`,
      [pid, lid]
    )
    return row ? mapLandingRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-landing-pages-pg] fetchPartnerLandingPageByIdPg', e)
    return null
  }
}

export async function fetchPublishedPartnerLandingBySiteAndSlugPg(
  siteSlug: string,
  landingSlug: string
): Promise<PartnerLandingPagePublicRow | null> {
  if (!isPgConfigured()) return null
  const site = siteSlug.trim().toLowerCase()
  const lp = landingSlug.trim().toLowerCase()
  if (!site || !lp) return null
  try {
    const row = await pgQueryOne<
      LandingDbRow & {
        site_slug: string
        partner_slug: string
        logo_url: string | null
      }
    >(
      `select lp.id::text, lp.partner_id::text, lp.website_id::text, lp.landing_slug, lp.title,
              lp.brief_text, lp.locale, lp.inventory_ids, lp.project_files_json, lp.html_source,
              lp.reference_image_urls, lp.mockup_url, lp.is_published, lp.published_at,
              lp.created_at, lp.updated_at,
              w.site_slug, p.slug as partner_slug, coalesce(nullif(trim(w.logo_url), ''), p.logo_url) as logo_url
       from public.messaging_partner_landing_pages lp
       inner join public.messaging_partner_websites w on w.id = lp.website_id
       inner join public.messaging_partners p on p.id = lp.partner_id
       where w.site_slug = $1
         and lp.landing_slug = $2
         and lp.is_published = true
         and w.is_published = true
         and p.is_active = true
         and p.purge_at is null
       limit 1`,
      [site, lp]
    )
    if (!row) return null
    const base = mapLandingRow(row)
    return {
      ...base,
      siteSlug: row.site_slug,
      partnerSlug: row.partner_slug,
      chatPath: `/messaging/p/${encodeURIComponent(row.partner_slug)}`,
      logoUrl: row.logo_url?.trim() || null,
    }
  } catch (e) {
    console.error('[messaging-partner-landing-pages-pg] fetchPublishedPartnerLandingBySiteAndSlugPg', e)
    return null
  }
}

export async function insertPartnerLandingPagePg(input: {
  partnerId: string
  websiteId: string
  landingSlug: string
  title: string
  briefText: string
  locale: WebLocale
  inventoryIds: string[]
}): Promise<PartnerLandingPageRow | null> {
  if (!isPgConfigured()) return null
  const ids = asUuidArray(input.inventoryIds)
  if (ids.length < 1) return null
  try {
    const row = await pgQueryOne<LandingDbRow>(
      `insert into public.messaging_partner_landing_pages (
         partner_id, website_id, landing_slug, title, brief_text, locale, inventory_ids
       ) values (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid[]
       )
       returning ${SELECT_COLS}`,
      [
        input.partnerId,
        input.websiteId,
        input.landingSlug.trim().toLowerCase(),
        input.title.trim().slice(0, 200),
        input.briefText.trim().slice(0, 4000),
        input.locale,
        ids,
      ]
    )
    return row ? mapLandingRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-landing-pages-pg] insertPartnerLandingPagePg', e)
    return null
  }
}

export async function updatePartnerLandingPagePg(input: {
  partnerId: string
  landingId: string
  title?: string
  briefText?: string
  landingSlug?: string
  inventoryIds?: string[]
  locale?: WebLocale
  project?: PartnerWebsiteProject
  htmlSource?: string | null
  referenceImageUrls?: string[]
  mockupUrl?: string | null
}): Promise<PartnerLandingPageRow | null> {
  if (!isPgConfigured()) return null
  const existing = await fetchPartnerLandingPageByIdPg(input.partnerId, input.landingId)
  if (!existing) return null

  const title = input.title !== undefined ? input.title.trim().slice(0, 200) : existing.title
  const briefText =
    input.briefText !== undefined ? input.briefText.trim().slice(0, 4000) : existing.briefText
  const landingSlug =
    input.landingSlug !== undefined
      ? input.landingSlug.trim().toLowerCase()
      : existing.landingSlug
  const inventoryIds =
    input.inventoryIds !== undefined ? asUuidArray(input.inventoryIds) : existing.inventoryIds
  if (inventoryIds.length < 1) return null
  const locale = input.locale ?? existing.locale
  const project = input.project ?? existing.project
  const htmlSource =
    input.htmlSource !== undefined ? input.htmlSource?.trim() || null : existing.htmlSource
  const referenceImageUrls =
    input.referenceImageUrls !== undefined
      ? asStringArray(input.referenceImageUrls)
      : existing.referenceImageUrls
  const mockupUrl =
    input.mockupUrl !== undefined ? input.mockupUrl?.trim() || null : existing.mockupUrl

  try {
    const row = await pgQueryOne<LandingDbRow>(
      `update public.messaging_partner_landing_pages set
         title = $3,
         brief_text = $4,
         landing_slug = $5,
         inventory_ids = $6::uuid[],
         locale = $7,
         project_files_json = $8::jsonb,
         html_source = $9,
         reference_image_urls = $10::jsonb,
         mockup_url = $11,
         updated_at = timezone('utc', now())
       where partner_id = $1::uuid and id = $2::uuid
       returning ${SELECT_COLS}`,
      [
        input.partnerId,
        input.landingId,
        title,
        briefText,
        landingSlug,
        inventoryIds,
        locale,
        JSON.stringify(projectFilesToJson(project)),
        htmlSource,
        JSON.stringify(referenceImageUrls),
        mockupUrl,
      ]
    )
    return row ? mapLandingRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-landing-pages-pg] updatePartnerLandingPagePg', e)
    return null
  }
}

export async function setPartnerLandingPublishedPg(input: {
  partnerId: string
  landingId: string
  published: boolean
}): Promise<PartnerLandingPageRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<LandingDbRow>(
      `update public.messaging_partner_landing_pages set
         is_published = $3,
         published_at = case when $3 then coalesce(published_at, timezone('utc', now())) else null end,
         updated_at = timezone('utc', now())
       where partner_id = $1::uuid and id = $2::uuid
       returning ${SELECT_COLS}`,
      [input.partnerId, input.landingId, input.published]
    )
    return row ? mapLandingRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-landing-pages-pg] setPartnerLandingPublishedPg', e)
    return null
  }
}

export async function deletePartnerLandingPagePg(
  partnerId: string,
  landingId: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const rows = await pgQuery<{ id: string }>(
      `delete from public.messaging_partner_landing_pages
       where partner_id = $1::uuid and id = $2::uuid
       returning id::text`,
      [partnerId.trim(), landingId.trim()]
    )
    return rows.length > 0
  } catch (e) {
    console.error('[messaging-partner-landing-pages-pg] deletePartnerLandingPagePg', e)
    return false
  }
}
