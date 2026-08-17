import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import {
  composeStandaloneHtml,
  parseProjectFilesFromDb,
  projectFilesToJson,
  resolvePartnerWebsiteDisplayHtml,
} from '@/lib/partner-website/partner-website-project'
import { composePartnerWebsiteHtmlAsync, resolveExactVisualHomepageHtml } from '@/lib/partner-website/compose-partner-website-html'
import { syncPartnerWebsiteFullLandingPg } from '@/lib/partner-website/sync-partner-website-full-landing'
import {
  isFullLandingV1Template,
  upgradeLandingV1Pages,
} from '@/lib/partner-website/template/upgrade-landing-v1-template'
import {
  PARTNER_WEBSITE_REVISION_RETENTION_DAYS,
  isRevisionExpired,
  shouldCoalesceRevisionSession,
} from '@/lib/partner-website/partner-website-revision-policy'
import {
  mapTemplateFieldsFromDb,
  type PartnerWebsitePage,
  type PartnerWebsiteProject,
  type PartnerWebsitePublicRow,
  type PartnerWebsiteRenderMode,
  type PartnerWebsiteRevisionRow,
  type PartnerWebsiteRow,
  type PartnerWebsiteTheme,
} from '@/lib/partner-website/partner-website-types'
import type {
  PartnerWebsiteCreationJournal,
  PartnerWebsiteCreationJournalsV2,
} from '@/lib/partner-website/partner-website-creation-journal'
import {
  normalizeCreationJournals,
  primaryJournalFromRaw,
  upsertJournalInBag,
} from '@/lib/partner-website/partner-website-creation-journal'
import { ensurePartnerWebsiteSystemPages } from '@/lib/partner-website/partner-website-system-pages'

function mapRow(r: {
  id: string
  partner_id: string
  site_slug: string
  title: string | null
  brief_text: string | null
  logo_url: string | null
  reference_image_urls: unknown
  render_mode?: string | null
  template_id?: string | null
  theme_json?: unknown
  pages_json?: unknown
  nav_json?: unknown
  footer_json?: unknown
  project_files_json: unknown
  html_source: string | null
  locale: string | null
  is_published: boolean | null
  published_at: unknown
  source_thread_id: string | null
  creation_journal_json?: unknown
  created_at: unknown
  updated_at: unknown
}): PartnerWebsiteRow {
  const refs = Array.isArray(r.reference_image_urls)
    ? r.reference_image_urls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : []
  const templateFields = mapTemplateFieldsFromDb(r)
  const locale = normalizeWebLocale(r.locale) ?? 'vi'
  const defaultBrandName = r.title?.trim() || undefined
  const websiteBuilt = Boolean(
    r.pages_json && Array.isArray(r.pages_json) && (r.pages_json as unknown[]).length > 0
  )
  const creationJournals = normalizeCreationJournals(r.creation_journal_json, {
    websiteBuilt,
    defaultBrandName,
    locale,
  })
  const title = r.title?.trim() || ''
  const project = ensurePartnerWebsiteSystemPages(parseProjectFilesFromDb(r.project_files_json), {
    shopTitle: title || 'Shop',
    locale,
    homeHref: '/',
  })
  return {
    id: r.id,
    partnerId: r.partner_id,
    siteSlug: r.site_slug,
    title,
    briefText: r.brief_text?.trim() || '',
    logoUrl: r.logo_url?.trim() || null,
    referenceImageUrls: refs,
    renderMode: templateFields.renderMode,
    templateId: templateFields.templateId,
    theme: templateFields.theme,
    pages: templateFields.pages,
    project,
    htmlSource: r.html_source?.trim() || null,
    locale,
    navJson: r.nav_json ?? null,
    footerJson: r.footer_json ?? null,
    isPublished: Boolean(r.is_published),
    publishedAt: r.published_at ? String(r.published_at) : null,
    sourceThreadId: r.source_thread_id,
    creationJournal: primaryJournalFromRaw(r.creation_journal_json, {
      websiteBuilt,
      defaultBrandName,
      locale,
    }),
    creationJournals,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

export async function fetchPartnerProfileForWebsitePg(partnerId: string): Promise<{
  id: string
  slug: string
  displayName: string
  brandName: string | null
  logoUrl: string | null
  /** W2.2 — dùng cho gợi ý sửa nhanh theo ngành. */
  industryKey: 'fashion' | 'hotel' | 'food' | 'other' | null
} | null> {
  if (!isPgConfigured()) return null
  const pid = partnerId.trim()
  if (!pid) return null
  try {
    const row = await pgQueryOne<{
      id: string
      slug: string
      display_name: string | null
      brand_name: string | null
      logo_url: string | null
      industry_key: string | null
    }>(
      `select id::text, slug,
              coalesce(nullif(trim(display_name), ''), slug) as display_name,
              nullif(trim(brand_name), '') as brand_name,
              nullif(trim(logo_url), '') as logo_url,
              nullif(trim(industry_key::text), '') as industry_key
       from public.messaging_partners
       where id = $1::uuid
       limit 1`,
      [pid]
    )
    if (!row) return null
    const rawIndustry = row.industry_key?.trim() || null
    const industryKey =
      rawIndustry === 'fashion' ||
      rawIndustry === 'hotel' ||
      rawIndustry === 'food' ||
      rawIndustry === 'other'
        ? rawIndustry
        : null
    return {
      id: row.id,
      slug: row.slug,
      displayName: row.display_name?.trim() || row.slug,
      brandName: row.brand_name?.trim() || null,
      logoUrl: row.logo_url?.trim() || null,
      industryKey,
    }
  } catch (e) {
    console.error('[messaging-partner-websites-pg] fetchPartnerProfileForWebsitePg', e)
    return null
  }
}

export async function fetchPartnerWebsiteByPartnerIdPg(
  partnerId: string
): Promise<PartnerWebsiteRow | null> {
  if (!isPgConfigured()) return null
  const pid = partnerId.trim()
  if (!pid) return null
  try {
    const row = await pgQueryOne<Parameters<typeof mapRow>[0]>(
      `select id::text, partner_id::text, site_slug, title, brief_text, logo_url,
              reference_image_urls, render_mode, template_id, theme_json, pages_json, nav_json, footer_json,
              project_files_json, html_source, locale,
              is_published, published_at, source_thread_id::text,
              creation_journal_json,
              created_at, updated_at
       from public.messaging_partner_websites
       where partner_id = $1::uuid
       limit 1`,
      [pid]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-websites-pg] fetchPartnerWebsiteByPartnerIdPg', e)
    return null
  }
}

/** S0.5 — published shop site slugs for root sitemap index (no /lp). */
export async function listPublishedPartnerWebsiteSlugsFromPg(limit = 500): Promise<string[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ site_slug: string }>(
      `select site_slug
       from public.messaging_partner_websites
       where is_published = true
         and coalesce(nullif(trim(site_slug), ''), '') <> ''
       order by published_at desc nulls last, updated_at desc
       limit $1`,
      [Math.max(1, Math.min(2000, limit))]
    )
    return rows.map((r) => String(r.site_slug).trim().toLowerCase()).filter(Boolean)
  } catch (e) {
    console.warn('[listPublishedPartnerWebsiteSlugsFromPg]', e)
    return []
  }
}

/** Public site homepage — published only. Shop APIs may use allowDraft. */
export async function fetchPublishedPartnerWebsiteBySlugPg(
  siteSlug: string,
  options?: { allowDraft?: boolean }
): Promise<PartnerWebsitePublicRow | null> {
  if (!isPgConfigured()) return null
  const slug = siteSlug.trim().toLowerCase()
  if (!slug) return null
  const allowDraft = Boolean(options?.allowDraft)
  try {
    const row = await pgQueryOne<{
      partner_id: string
      site_slug: string
      title: string | null
      logo_url: string | null
      html_source: string | null
      project_files_json: unknown
      render_mode: string | null
      template_id: string | null
      theme_json: unknown
      pages_json: unknown
      locale: string | null
      partner_slug: string
      partner_display_name: string | null
      facebook_pixel_id: string | null
      ga4_measurement_id: string | null
      google_ads_id: string | null
      tiktok_pixel_id: string | null
      gtm_container_id: string | null
      default_currency: string | null
      nav_json: unknown
      footer_json: unknown
    }>(
      `select w.partner_id::text, w.site_slug, w.title, w.logo_url, w.html_source, w.project_files_json,
              w.render_mode, w.template_id, w.theme_json, w.pages_json, w.locale,
              w.nav_json, w.footer_json,
              p.slug as partner_slug,
              coalesce(nullif(trim(p.brand_name), ''), nullif(trim(p.display_name), ''), p.slug) as partner_display_name,
              nullif(trim(coalesce(p.facebook_pixel_id, '')), '') as facebook_pixel_id,
              nullif(trim(coalesce(p.ga4_measurement_id, '')), '') as ga4_measurement_id,
              nullif(trim(coalesce(p.google_ads_id, '')), '') as google_ads_id,
              nullif(trim(coalesce(p.tiktok_pixel_id, '')), '') as tiktok_pixel_id,
              nullif(trim(coalesce(p.gtm_container_id, '')), '') as gtm_container_id,
              coalesce(nullif(trim(p.default_currency), ''), 'VND') as default_currency
       from public.messaging_partner_websites w
       inner join public.messaging_partners p on p.id = w.partner_id
       where w.site_slug = $1
         and ($2::boolean or w.is_published = true)
         and coalesce(p.is_active, true) = true
         and p.purge_at is null
       limit 1`,
      [slug, allowDraft]
    )
    if (!row) return null
    const templateFields = mapTemplateFieldsFromDb(row)
    const project = parseProjectFilesFromDb(row.project_files_json)
    const locale = normalizeWebLocale(row.locale) ?? 'vi'
    const partnerSlug = row.partner_slug.trim()
    const chatPath = `/messaging/p/${encodeURIComponent(partnerSlug)}`
    const publicMeta = {
      siteSlug: row.site_slug,
      title: row.title?.trim() || row.partner_display_name?.trim() || 'Website',
      logoUrl: row.logo_url?.trim() || null,
      renderMode: templateFields.renderMode,
      templateId: templateFields.templateId,
      theme: templateFields.theme,
      pages: templateFields.pages,
      project,
      locale,
      navJson: row.nav_json ?? null,
      footerJson: row.footer_json ?? null,
      partnerSlug,
      partnerDisplayName: row.partner_display_name?.trim() || partnerSlug,
      chatPath,
      facebookPixelId: row.facebook_pixel_id,
      ga4MeasurementId: row.ga4_measurement_id,
      googleAdsId: row.google_ads_id,
      tiktokPixelId: row.tiktok_pixel_id,
      gtmContainerId: row.gtm_container_id,
      defaultCurrency: String(row.default_currency ?? 'VND').trim().toUpperCase() || 'VND',
    }

    const visualHtml = resolveExactVisualHomepageHtml({
      theme: templateFields.theme,
      project,
      htmlSource: row.html_source,
    })
    if (visualHtml.length >= 40) {
      return { ...publicMeta, htmlSource: visualHtml }
    }

    let pages = templateFields.pages

    if (isFullLandingV1Template(templateFields)) {
      const upgraded = upgradeLandingV1Pages({ pages, locale })
      pages = upgraded.pages
      if (upgraded.changed) {
        await syncPartnerWebsiteFullLandingPg({
          partnerId: row.partner_id,
          locale,
          refreshHtml: true,
        }).catch((e) => console.warn('[fetchPublishedPartnerWebsiteBySlugPg] sync landing', e))
      }
    }

    const websiteForCompose = {
      renderMode: templateFields.renderMode,
      templateId: templateFields.templateId,
      theme: templateFields.theme,
      pages,
      project,
      htmlSource: row.html_source,
      locale,
      title: row.title?.trim() || row.partner_display_name?.trim() || 'Website',
      logoUrl: row.logo_url?.trim() || null,
    }
    const htmlSource =
      templateFields.renderMode === 'template'
        ? (await composePartnerWebsiteHtmlAsync(
            {
              ...websiteForCompose,
              partnerId: row.partner_id,
              siteSlug: row.site_slug,
            },
            { chatPath, hydrateInventory: true }
          )) ||
          row.html_source?.trim() ||
          composeStandaloneHtml(project) ||
          ''
        : resolvePartnerWebsiteDisplayHtml({ project, htmlSource: row.html_source }) ||
          (await composePartnerWebsiteHtmlAsync(
            {
              ...websiteForCompose,
              partnerId: row.partner_id,
              siteSlug: row.site_slug,
            },
            { chatPath, hydrateInventory: true }
          )) ||
          ''
    if (!htmlSource) return null
    return { ...publicMeta, pages, htmlSource }
  } catch (e) {
    const err = e as { code?: string; message?: string } | null
    if (err?.code === '42703' && String(err.message ?? '').includes('default_currency')) {
      console.warn(
        '[fetchPublishedPartnerWebsiteBySlugPg] default_currency missing — run migration 20260806160000'
      )
    }
    console.error('[messaging-partner-websites-pg] fetchPublishedPartnerWebsiteBySlugPg', e)
    return null
  }
}

export async function upsertPartnerWebsitePg(input: {
  partnerId: string
  siteSlug: string
  title: string
  briefText: string
  logoUrl?: string | null
  referenceImageUrls?: string[]
  renderMode?: PartnerWebsiteRenderMode
  templateId?: string
  theme?: PartnerWebsiteTheme
  pages?: PartnerWebsitePage[]
  project: PartnerWebsiteProject
  htmlSource?: string | null
  locale: WebLocale
  sourceThreadId?: string | null
  changeNote?: string | null
  skipRevision?: boolean
  chatPath?: string
  creationJournal?: PartnerWebsiteCreationJournal
}): Promise<PartnerWebsiteRow | null> {
  if (!isPgConfigured()) return null
  const renderMode = input.renderMode ?? 'legacy'
  const templateId = input.templateId ?? 'landing-v1'
  const theme = input.theme ?? mapTemplateFieldsFromDb({ logo_url: input.logoUrl }).theme
  const pages = input.pages ?? []
  const project = ensurePartnerWebsiteSystemPages(input.project, {
    shopTitle: input.title,
    locale: input.locale,
    homeHref: '/',
  })
  const html =
    input.htmlSource?.trim() ||
    (await composePartnerWebsiteHtmlAsync(
      {
        renderMode,
        templateId,
        theme,
        pages,
        project,
        htmlSource: input.htmlSource ?? null,
        locale: input.locale,
        title: input.title,
        logoUrl: input.logoUrl ?? null,
        partnerId: input.partnerId,
        siteSlug: input.siteSlug,
      },
      { chatPath: input.chatPath, hydrateInventory: true }
    )) ||
    null
  try {
    if (!input.skipRevision) {
      const existing = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
      if (existing) {
        await savePartnerWebsiteRevisionPg({
          website: existing,
          changeNote: input.changeNote ?? null,
        })
      }
    }

    const row = await pgQueryOne<Parameters<typeof mapRow>[0]>(
      `insert into public.messaging_partner_websites (
         partner_id, site_slug, title, brief_text, logo_url,
         reference_image_urls, render_mode, template_id, theme_json, pages_json, nav_json, footer_json,
         project_files_json, html_source, locale, source_thread_id, creation_journal_json
       ) values (
         $1::uuid, $2, $3, $4, $5,
         $6::jsonb, $7, $8, $9::jsonb, $10::jsonb,
         $11::jsonb, $12::jsonb, $13::jsonb, $14, $15, $16::uuid, $17::jsonb
       )
       on conflict (partner_id) do update set
         site_slug = excluded.site_slug,
         title = excluded.title,
         brief_text = excluded.brief_text,
         logo_url = excluded.logo_url,
         reference_image_urls = excluded.reference_image_urls,
         render_mode = excluded.render_mode,
         template_id = excluded.template_id,
         theme_json = excluded.theme_json,
         pages_json = excluded.pages_json,
         project_files_json = excluded.project_files_json,
         html_source = excluded.html_source,
         locale = excluded.locale,
         source_thread_id = coalesce(excluded.source_thread_id, messaging_partner_websites.source_thread_id),
         creation_journal_json = coalesce(excluded.creation_journal_json, messaging_partner_websites.creation_journal_json),
         updated_at = timezone('utc'::text, now())
       returning id::text, partner_id::text, site_slug, title, brief_text, logo_url,
                 reference_image_urls, render_mode, template_id, theme_json, pages_json, nav_json, footer_json,
                 project_files_json, html_source, locale,
                 is_published, published_at, source_thread_id::text,
                 creation_journal_json,
                 created_at, updated_at`,
      [
        input.partnerId,
        input.siteSlug,
        input.title.slice(0, 200),
        input.briefText.slice(0, 8000),
        input.logoUrl?.trim() || null,
        JSON.stringify(input.referenceImageUrls ?? []),
        renderMode,
        templateId,
        JSON.stringify(theme),
        JSON.stringify(pages),
        null,
        null,
        JSON.stringify(projectFilesToJson(project)),
        html,
        input.locale,
        input.sourceThreadId?.trim() || null,
        input.creationJournal
          ? JSON.stringify(
              upsertJournalInBag(
                normalizeCreationJournals(null, {
                  defaultBrandName: input.title,
                  locale: input.locale,
                }),
                input.creationJournal
              )
            )
          : null,
      ]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-websites-pg] upsertPartnerWebsitePg', e)
    return null
  }
}

export async function updatePartnerWebsiteDraftPg(input: {
  partnerId: string
  title?: string
  briefText?: string
  logoUrl?: string | null
  referenceImageUrls?: string[]
  renderMode?: PartnerWebsiteRenderMode
  templateId?: string
  theme?: PartnerWebsiteTheme
  pages?: PartnerWebsitePage[]
  project?: PartnerWebsiteProject
  htmlSource?: string | null
  chatPath?: string
  /** Snapshot trước khi ghi (theme…). */
  changeNote?: string | null
  skipRevision?: boolean
}): Promise<PartnerWebsiteRow | null> {
  if (!isPgConfigured()) return null
  const existing = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
  if (!existing) return null

  const project = input.project ?? existing.project
  const renderMode = input.renderMode ?? existing.renderMode
  const templateId = input.templateId ?? existing.templateId
  const theme = input.theme ?? existing.theme
  const pages = input.pages ?? existing.pages
  const title = input.title ?? existing.title
  const locale = existing.locale
  const htmlSource =
    input.htmlSource !== undefined
      ? input.htmlSource
      : await composePartnerWebsiteHtmlAsync(
          {
            renderMode,
            templateId,
            theme,
            pages,
            project,
            htmlSource: existing.htmlSource,
            locale,
            title,
            logoUrl: input.logoUrl !== undefined ? input.logoUrl : existing.logoUrl,
            partnerId: input.partnerId,
            siteSlug: existing.siteSlug,
          },
          { chatPath: input.chatPath, hydrateInventory: true }
        ) || existing.htmlSource

  try {
    if (!input.skipRevision && (input.theme || input.pages || input.project || input.htmlSource !== undefined)) {
      await savePartnerWebsiteRevisionPg({
        website: existing,
        changeNote: input.changeNote ?? null,
      })
    }

    const row = await pgQueryOne<Parameters<typeof mapRow>[0]>(
      `update public.messaging_partner_websites set
         title = coalesce($2, title),
         brief_text = coalesce($3, brief_text),
         logo_url = case when $12::boolean then nullif(trim(coalesce($4, '')), '') else logo_url end,
         reference_image_urls = coalesce($5::jsonb, reference_image_urls),
         render_mode = coalesce($6, render_mode),
         template_id = coalesce($7, template_id),
         theme_json = coalesce($8::jsonb, theme_json),
         pages_json = coalesce($9::jsonb, pages_json),
         project_files_json = coalesce($10::jsonb, project_files_json),
         html_source = $11,
         updated_at = timezone('utc'::text, now())
       where partner_id = $1::uuid
       returning id::text, partner_id::text, site_slug, title, brief_text, logo_url,
                 reference_image_urls, render_mode, template_id, theme_json, pages_json, nav_json, footer_json,
                 project_files_json, html_source, locale,
                 is_published, published_at, source_thread_id::text,
                 creation_journal_json,
                 created_at, updated_at`,
      [
        input.partnerId,
        input.title?.slice(0, 200) ?? null,
        input.briefText?.slice(0, 8000) ?? null,
        input.logoUrl !== undefined ? input.logoUrl?.trim() || null : null,
        input.referenceImageUrls ? JSON.stringify(input.referenceImageUrls) : null,
        input.renderMode ?? null,
        input.templateId ?? null,
        input.theme ? JSON.stringify(theme) : null,
        input.pages ? JSON.stringify(pages) : null,
        input.project ? JSON.stringify(projectFilesToJson(project)) : null,
        htmlSource?.replace(/\u0000/g, '').trim() || null,
        input.logoUrl !== undefined,
      ]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-websites-pg] updatePartnerWebsiteDraftPg', e)
    return null
  }
}

/** W2.3 — lưu nav/footer JSON (không đụng html/theme). */
export async function updatePartnerWebsiteNavFooterPg(input: {
  partnerId: string
  navJson: unknown
  footerJson: unknown
}): Promise<PartnerWebsiteRow | null> {
  if (!isPgConfigured()) return null
  const existing = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
  if (!existing) return null
  try {
    await savePartnerWebsiteRevisionPg({
      website: existing,
      changeNote: 'update_nav_footer',
    })
    const row = await pgQueryOne<Parameters<typeof mapRow>[0]>(
      `update public.messaging_partner_websites set
         nav_json = $2::jsonb,
         footer_json = $3::jsonb,
         updated_at = timezone('utc'::text, now())
       where partner_id = $1::uuid
       returning id::text, partner_id::text, site_slug, title, brief_text, logo_url,
                 reference_image_urls, render_mode, template_id, theme_json, pages_json, nav_json, footer_json,
                 project_files_json, html_source, locale,
                 is_published, published_at, source_thread_id::text,
                 creation_journal_json,
                 created_at, updated_at`,
      [input.partnerId, JSON.stringify(input.navJson ?? null), JSON.stringify(input.footerJson ?? null)]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-websites-pg] updatePartnerWebsiteNavFooterPg', e)
    return null
  }
}

export async function setPartnerWebsitePublishedPg(input: {
  partnerId: string
  isPublished: boolean
}): Promise<PartnerWebsiteRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Parameters<typeof mapRow>[0]>(
      `update public.messaging_partner_websites set
         is_published = $2,
         published_at = case when $2 then coalesce(published_at, timezone('utc'::text, now()))
                             else null end,
         updated_at = timezone('utc'::text, now())
       where partner_id = $1::uuid
       returning id::text, partner_id::text, site_slug, title, brief_text, logo_url,
                 reference_image_urls, render_mode, template_id, theme_json, pages_json, nav_json, footer_json,
                 project_files_json, html_source, locale,
                 is_published, published_at, source_thread_id::text,
                 creation_journal_json,
                 created_at, updated_at`,
      [input.partnerId, input.isPublished]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-websites-pg] setPartnerWebsitePublishedPg', e)
    return null
  }
}

export async function listPartnerWebsitesForPartnersPg(
  partnerIds: string[]
): Promise<Map<string, PartnerWebsiteRow>> {
  const out = new Map<string, PartnerWebsiteRow>()
  if (!isPgConfigured() || !partnerIds.length) return out
  const ids = [...new Set(partnerIds.map((id) => id.trim()).filter(Boolean))]
  if (!ids.length) return out
  try {
    const rows = await pgQuery<Parameters<typeof mapRow>[0]>(
      `select id::text, partner_id::text, site_slug, title, brief_text, logo_url,
              reference_image_urls, render_mode, template_id, theme_json, pages_json, nav_json, footer_json,
              project_files_json, html_source, locale,
              is_published, published_at, source_thread_id::text,
              creation_journal_json,
              created_at, updated_at
       from public.messaging_partner_websites
       where partner_id = any($1::uuid[])`,
      [ids]
    )
    for (const row of rows) {
      const mapped = mapRow(row)
      out.set(mapped.partnerId, mapped)
    }
  } catch (e) {
    console.error('[messaging-partner-websites-pg] listPartnerWebsitesForPartnersPg', e)
  }
  return out
}

function mapRevisionRow(r: {
  id: string
  partner_id: string
  website_id: string
  title: string | null
  brief_text: string | null
  logo_url: string | null
  reference_image_urls: unknown
  render_mode?: string | null
  template_id?: string | null
  theme_json?: unknown
  pages_json?: unknown
  project_files_json: unknown
  html_source: string | null
  locale: string | null
  change_note: string | null
  created_at: unknown
}): PartnerWebsiteRevisionRow {
  const refs = Array.isArray(r.reference_image_urls)
    ? r.reference_image_urls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : []
  const templateFields = mapTemplateFieldsFromDb(r)
  return {
    id: r.id,
    partnerId: r.partner_id,
    websiteId: r.website_id,
    title: r.title?.trim() || '',
    briefText: r.brief_text?.trim() || '',
    logoUrl: r.logo_url?.trim() || null,
    referenceImageUrls: refs,
    renderMode: templateFields.renderMode,
    templateId: templateFields.templateId,
    theme: templateFields.theme,
    pages: templateFields.pages,
    project: parseProjectFilesFromDb(r.project_files_json),
    htmlSource: r.html_source?.trim() || null,
    locale: normalizeWebLocale(r.locale) ?? 'vi',
    changeNote: r.change_note?.trim() || null,
    createdAt: String(r.created_at ?? ''),
  }
}

async function pruneExpiredPartnerWebsiteRevisionsPg(partnerId: string): Promise<void> {
  await pgQuery(
    `delete from public.messaging_partner_website_revisions
     where partner_id = $1::uuid
       and created_at < timezone('utc'::text, now()) - ($2::int * interval '1 day')`,
    [partnerId, PARTNER_WEBSITE_REVISION_RETENTION_DAYS]
  )
}

export async function savePartnerWebsiteRevisionPg(input: {
  website: PartnerWebsiteRow
  changeNote?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pruneExpiredPartnerWebsiteRevisionsPg(input.website.partnerId)
    const last = await pgQueryOne<{ change_note: string | null; created_at: string | Date }>(
      `select change_note, created_at
       from public.messaging_partner_website_revisions
       where partner_id = $1::uuid
       order by created_at desc
       limit 1`,
      [input.website.partnerId]
    )
    const lastCreatedAtIso =
      last?.created_at instanceof Date ? last.created_at.toISOString() : last?.created_at ?? null
    if (
      shouldCoalesceRevisionSession({
        lastChangeNote: last?.change_note,
        lastCreatedAtIso,
        nextChangeNote: input.changeNote,
      })
    ) {
      return
    }
    await pgQuery(
      `insert into public.messaging_partner_website_revisions (
         partner_id, website_id, title, brief_text, logo_url,
         reference_image_urls, render_mode, template_id, theme_json, pages_json,
         project_files_json, html_source, locale, change_note
       ) values ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14)`,
      [
        input.website.partnerId,
        input.website.id,
        input.website.title.slice(0, 200),
        input.website.briefText.slice(0, 8000),
        input.website.logoUrl,
        JSON.stringify(input.website.referenceImageUrls),
        input.website.renderMode,
        input.website.templateId,
        JSON.stringify(input.website.theme),
        JSON.stringify(input.website.pages),
        JSON.stringify(projectFilesToJson(input.website.project)),
        input.website.htmlSource,
        input.website.locale,
        input.changeNote?.slice(0, 500) ?? null,
      ]
    )
  } catch (e) {
    console.error('[messaging-partner-websites-pg] savePartnerWebsiteRevisionPg', e)
  }
}

export async function listPartnerWebsiteRevisionsPg(
  partnerId: string,
  limit = 50
): Promise<PartnerWebsiteRevisionRow[]> {
  if (!isPgConfigured()) return []
  const pid = partnerId.trim()
  if (!pid) return []
  try {
    await pruneExpiredPartnerWebsiteRevisionsPg(pid)
    const rows = await pgQuery<Parameters<typeof mapRevisionRow>[0]>(
      `select id::text, partner_id::text, website_id::text, title, brief_text, logo_url,
              reference_image_urls, render_mode, template_id, theme_json, pages_json,
              project_files_json, html_source, locale, change_note, created_at
       from public.messaging_partner_website_revisions
       where partner_id = $1::uuid
         and created_at >= timezone('utc'::text, now()) - ($3::int * interval '1 day')
       order by created_at desc
       limit $2`,
      [pid, limit, PARTNER_WEBSITE_REVISION_RETENTION_DAYS]
    )
    return rows.map(mapRevisionRow)
  } catch (e) {
    console.error('[messaging-partner-websites-pg] listPartnerWebsiteRevisionsPg', e)
    return []
  }
}

export async function restorePartnerWebsiteRevisionPg(input: {
  partnerId: string
  revisionId: string
}): Promise<PartnerWebsiteRow | null> {
  if (!isPgConfigured()) return null
  const pid = input.partnerId.trim()
  const rid = input.revisionId.trim()
  if (!pid || !rid) return null

  const revision = await pgQueryOne<Parameters<typeof mapRevisionRow>[0]>(
    `select id::text, partner_id::text, website_id::text, title, brief_text, logo_url,
            reference_image_urls, render_mode, template_id, theme_json, pages_json,
            project_files_json, html_source, locale, change_note, created_at
     from public.messaging_partner_website_revisions
     where id = $1::uuid and partner_id = $2::uuid
     limit 1`,
    [rid, pid]
  )
  if (!revision) return null

  const mapped = mapRevisionRow(revision)
  if (isRevisionExpired(mapped.createdAt)) return null
  const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
  if (!existing) return null

  await savePartnerWebsiteRevisionPg({
    website: existing,
    changeNote: 'before_restore',
  })

  return updatePartnerWebsiteDraftPg({
    partnerId: pid,
    title: mapped.title,
    briefText: mapped.briefText,
    logoUrl: mapped.logoUrl,
    referenceImageUrls: mapped.referenceImageUrls,
    renderMode: mapped.renderMode,
    templateId: mapped.templateId,
    theme: mapped.theme,
    pages: mapped.pages,
    project: mapped.project,
    htmlSource: mapped.htmlSource,
    skipRevision: true,
  })
}

export async function updatePartnerWebsiteCreationJournalPg(
  partnerId: string,
  journal: PartnerWebsiteCreationJournal
): Promise<PartnerWebsiteRow | null> {
  if (!isPgConfigured()) return null
  const pid = partnerId.trim()
  if (!pid) return null
  try {
    const existing = await fetchPartnerWebsiteByPartnerIdPg(pid)
    const bag: PartnerWebsiteCreationJournalsV2 = upsertJournalInBag(
      existing?.creationJournals ??
        normalizeCreationJournals(null, {
          defaultBrandName: existing?.title,
          locale: existing?.locale ?? 'vi',
        }),
      journal
    )
    const row = await pgQueryOne<Parameters<typeof mapRow>[0]>(
      `update public.messaging_partner_websites set
         creation_journal_json = $2::jsonb,
         updated_at = timezone('utc'::text, now())
       where partner_id = $1::uuid
       returning id::text, partner_id::text, site_slug, title, brief_text, logo_url,
                 reference_image_urls, render_mode, template_id, theme_json, pages_json, nav_json, footer_json,
                 project_files_json, html_source, locale,
                 is_published, published_at, source_thread_id::text,
                 creation_journal_json,
                 created_at, updated_at`,
      [pid, JSON.stringify(bag)]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-websites-pg] updatePartnerWebsiteCreationJournalPg', e)
    return null
  }
}

export async function updatePartnerWebsiteCreationJournalsPg(
  partnerId: string,
  bag: PartnerWebsiteCreationJournalsV2
): Promise<PartnerWebsiteRow | null> {
  if (!isPgConfigured()) return null
  const pid = partnerId.trim()
  if (!pid) return null
  try {
    const row = await pgQueryOne<Parameters<typeof mapRow>[0]>(
      `update public.messaging_partner_websites set
         creation_journal_json = $2::jsonb,
         updated_at = timezone('utc'::text, now())
       where partner_id = $1::uuid
       returning id::text, partner_id::text, site_slug, title, brief_text, logo_url,
                 reference_image_urls, render_mode, template_id, theme_json, pages_json, nav_json, footer_json,
                 project_files_json, html_source, locale,
                 is_published, published_at, source_thread_id::text,
                 creation_journal_json,
                 created_at, updated_at`,
      [pid, JSON.stringify(bag)]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-websites-pg] updatePartnerWebsiteCreationJournalsPg', e)
    return null
  }
}
