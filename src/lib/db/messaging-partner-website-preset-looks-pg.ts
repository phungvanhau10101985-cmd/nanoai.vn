import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { parseProjectFilesFromDb, projectFilesToJson } from '@/lib/partner-website/partner-website-project'
import {
  normalizeTemplatePages,
  normalizeTemplateTheme,
} from '@/lib/partner-website/template/default-landing-v1'
import {
  isShopTemplatePresetId,
  type ShopTemplatePresetId,
} from '@/lib/partner-website/template/shop-template-presets'
import type {
  PartnerWebsitePage,
  PartnerWebsiteProject,
  PartnerWebsiteRow,
  PartnerWebsiteTheme,
} from '@/lib/partner-website/partner-website-types'

export type PartnerWebsitePresetLook = {
  presetId: ShopTemplatePresetId
  templateId: string
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
  project: PartnerWebsiteProject
  htmlSource: string | null
  updatedAt: string
}

type LookRow = {
  preset_id: string
  template_id: string | null
  theme_json: unknown
  pages_json: unknown
  project_files_json: unknown
  html_source: string | null
  updated_at: string
}

function mapLookRow(r: LookRow, logoUrl?: string | null): PartnerWebsitePresetLook | null {
  if (!isShopTemplatePresetId(r.preset_id)) return null
  return {
    presetId: r.preset_id,
    templateId: r.template_id?.trim() || r.preset_id,
    theme: normalizeTemplateTheme(r.theme_json, logoUrl),
    pages: normalizeTemplatePages(r.pages_json),
    project: parseProjectFilesFromDb(r.project_files_json),
    htmlSource: r.html_source?.trim() || null,
    updatedAt: String(r.updated_at ?? ''),
  }
}

export function presetLookFromWebsite(
  website: PartnerWebsiteRow,
  presetId: ShopTemplatePresetId
): Omit<PartnerWebsitePresetLook, 'updatedAt'> {
  return {
    presetId,
    templateId: website.templateId,
    theme: website.theme,
    pages: website.pages,
    project: website.project,
    htmlSource: website.htmlSource,
  }
}

export async function savePartnerWebsitePresetLookPg(input: {
  partnerId: string
  websiteId: string
  look: Omit<PartnerWebsitePresetLook, 'updatedAt'>
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const partnerId = input.partnerId.trim()
  const websiteId = input.websiteId.trim()
  if (!partnerId || !websiteId || !isShopTemplatePresetId(input.look.presetId)) return false
  try {
    await pgQuery(
      `insert into public.messaging_partner_website_preset_looks (
         partner_id, website_id, preset_id, template_id,
         theme_json, pages_json, project_files_json, html_source, updated_at
       ) values (
         $1::uuid, $2::uuid, $3, $4,
         $5::jsonb, $6::jsonb, $7::jsonb, $8, timezone('utc'::text, now())
       )
       on conflict (partner_id, preset_id) do update set
         website_id = excluded.website_id,
         template_id = excluded.template_id,
         theme_json = excluded.theme_json,
         pages_json = excluded.pages_json,
         project_files_json = excluded.project_files_json,
         html_source = excluded.html_source,
         updated_at = timezone('utc'::text, now())`,
      [
        partnerId,
        websiteId,
        input.look.presetId,
        input.look.templateId,
        JSON.stringify(input.look.theme),
        JSON.stringify(input.look.pages),
        JSON.stringify(projectFilesToJson(input.look.project)),
        input.look.htmlSource?.trim() || null,
      ]
    )
    return true
  } catch (e) {
    console.error('[messaging-partner-website-preset-looks-pg] save', e)
    return false
  }
}

export async function fetchPartnerWebsitePresetLookPg(
  partnerId: string,
  presetId: string,
  logoUrl?: string | null
): Promise<PartnerWebsitePresetLook | null> {
  if (!isPgConfigured()) return null
  const pid = partnerId.trim()
  if (!pid || !isShopTemplatePresetId(presetId)) return null
  try {
    const row = await pgQueryOne<LookRow>(
      `select preset_id, template_id, theme_json, pages_json, project_files_json, html_source, updated_at::text
       from public.messaging_partner_website_preset_looks
       where partner_id = $1::uuid and preset_id = $2
       limit 1`,
      [pid, presetId]
    )
    return row ? mapLookRow(row, logoUrl) : null
  } catch (e) {
    console.error('[messaging-partner-website-preset-looks-pg] fetch', e)
    return null
  }
}

export async function insertPartnerWebsitePresetLooksFromTrashPg(input: {
  partnerId: string
  websiteId: string
  looks: Array<Record<string, unknown>>
}): Promise<void> {
  if (!isPgConfigured()) return
  const partnerId = input.partnerId.trim()
  const websiteId = input.websiteId.trim()
  if (!partnerId || !websiteId) return
  for (const raw of input.looks) {
    const presetId = typeof raw.preset_id === 'string' ? raw.preset_id.trim() : ''
    if (!isShopTemplatePresetId(presetId)) continue
    try {
      await pgQuery(
        `insert into public.messaging_partner_website_preset_looks (
           partner_id, website_id, preset_id, template_id,
           theme_json, pages_json, project_files_json, html_source, updated_at
         ) values (
           $1::uuid, $2::uuid, $3, $4,
           coalesce($5::jsonb, '{}'::jsonb),
           coalesce($6::jsonb, '[]'::jsonb),
           coalesce($7::jsonb, '{"entryPath":"index.html","files":[]}'::jsonb),
           $8,
           coalesce($9::timestamptz, timezone('utc'::text, now()))
         )
         on conflict (partner_id, preset_id) do nothing`,
        [
          partnerId,
          websiteId,
          presetId,
          typeof raw.template_id === 'string' ? raw.template_id : presetId,
          JSON.stringify(raw.theme_json ?? {}),
          JSON.stringify(raw.pages_json ?? []),
          JSON.stringify(raw.project_files_json ?? { entryPath: 'index.html', files: [] }),
          typeof raw.html_source === 'string' ? raw.html_source : null,
          typeof raw.updated_at === 'string' ? raw.updated_at : null,
        ]
      )
    } catch (e) {
      console.warn('[messaging-partner-website-preset-looks-pg] restore from trash', e)
    }
  }
}
