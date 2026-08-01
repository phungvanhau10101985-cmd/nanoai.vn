import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { WebLocale } from '@/lib/i18n/config'
import {
  normalizeLandingShareSections,
  type LandingPageSharePayload,
} from '@/lib/hub-chat/landing-page-share-utils'
import { isCompleteLandingHtml } from '@/lib/hub-chat/landing-page-html-builder'

export type HubLandingPageShareRow = {
  title: string
  logo_url: string | null
  sections_json: ReturnType<typeof normalizeLandingShareSections>
  html_source: string | null
  locale: WebLocale
}

export async function insertHubLandingPageSharePg(input: {
  shareToken: string
  userId: string | null
  threadId: string | null
  payload: LandingPageSharePayload
  locale: WebLocale
  expiresAtIso: string
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  const htmlSource = input.payload.htmlSource?.trim() || null
  try {
    await pgQuery(
      `insert into public.hub_landing_page_shares (
         share_token, user_id, thread_id, title, logo_url, sections_json, html_source, locale, expires_at
       ) values ($1, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, $8, $9::timestamptz)`,
      [
        input.shareToken,
        input.userId,
        input.threadId,
        input.payload.title.slice(0, 200),
        input.payload.logoUrl?.trim() || null,
        JSON.stringify(input.payload.sections),
        htmlSource,
        input.locale,
        input.expiresAtIso,
      ]
    )
    return true
  } catch (e) {
    console.error('[hub-landing-page-share-pg] insertHubLandingPageSharePg', e)
    return null
  }
}

export async function fetchHubLandingPageShareByTokenPg(
  shareToken: string
): Promise<HubLandingPageShareRow | null> {
  if (!isPgConfigured()) return null
  const token = shareToken.trim()
  if (!token) return null
  try {
    const row = await pgQueryOne<{
      title: string | null
      logo_url: string | null
      sections_json: unknown
      html_source: string | null
      locale: string | null
    }>(
      `select title, logo_url, sections_json, html_source, locale
       from public.hub_landing_page_shares
       where share_token = $1 and expires_at > timezone('utc'::text, now())
       limit 1`,
      [token]
    )
    if (!row) return null
    const sections = normalizeLandingShareSections(row.sections_json)
    const htmlSource = row.html_source?.trim() || null
    if (!sections.length && !(htmlSource && isCompleteLandingHtml(htmlSource))) return null
    return {
      title: row.title?.trim() || 'Landing Page',
      logo_url: row.logo_url,
      sections_json: sections,
      html_source: htmlSource,
      locale: (row.locale ?? 'vi') as WebLocale,
    }
  } catch (e) {
    console.error('[hub-landing-page-share-pg] fetchHubLandingPageShareByTokenPg', e)
    return null
  }
}
