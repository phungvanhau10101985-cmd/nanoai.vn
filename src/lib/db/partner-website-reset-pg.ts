import { createHash, randomInt } from 'node:crypto'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { insertPartnerWebsitePresetLooksFromTrashPg } from '@/lib/db/messaging-partner-website-preset-looks-pg'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'

const UUID_SQL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const OTP_TTL_MINUTES = 10
/** Soft-reset trash retention window. */
export const PARTNER_WEBSITE_RESET_TRASH_DAYS = 7

function safeUuid(id: unknown): string | null {
  const s = typeof id === 'string' ? id.trim() : String(id ?? '').trim()
  if (!s || !UUID_SQL.test(s)) return null
  return s
}

function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

export function hashPartnerWebsiteResetOtp(partnerId: string, ownerUserId: string, otp: string): string {
  const o = otp.replace(/\D/g, '').trim()
  return sha256hex(`partner_website_reset_otp:${partnerId}:${ownerUserId}:${o}`)
}

export function generatePartnerWebsiteResetOtp6(): string {
  return String(randomInt(100000, 1000000))
}

export async function isPartnerWebsiteResetOtpCooldownActiveFromPg(partnerId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(partnerId)
  if (!pid) return false
  const cooldownSec = Math.min(
    600,
    Math.max(0, parseInt(process.env.PARTNER_WEBSITE_RESET_OTP_COOLDOWN_SECONDS || '90', 10) || 90)
  )
  if (cooldownSec <= 0) return false
  try {
    const row = await pgQueryOne<{ ok: boolean }>(
      `select exists(
         select 1 from public.messaging_partner_website_reset_otps
         where partner_id = $1::uuid
           and created_at > now() - ($2::int * interval '1 second')
       ) as ok`,
      [pid, cooldownSec]
    )
    return row?.ok === true
  } catch (e) {
    console.warn('[isPartnerWebsiteResetOtpCooldownActiveFromPg]', e)
    return false
  }
}

export async function replacePartnerWebsiteResetOtpFromPg(params: {
  partnerId: string
  ownerUserId: string
  otpHash: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(params.partnerId)
  const uid = safeUuid(params.ownerUserId)
  if (!pid || !uid) return false
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()
  try {
    await pgQuery(`delete from public.messaging_partner_website_reset_otps where partner_id = $1::uuid`, [pid])
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.messaging_partner_website_reset_otps (partner_id, owner_user_id, otp_hash, expires_at)
       values ($1::uuid, $2::uuid, $3, $4::timestamptz)
       returning id::text`,
      [pid, uid, params.otpHash, expiresAt]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[replacePartnerWebsiteResetOtpFromPg]', e)
    return false
  }
}

export type PartnerWebsiteResetTrashInfo = {
  partnerId: string
  resetAt: string
  expiresAt: string
  title: string
  siteSlug: string
  daysLeft: number
}

/** Active (not restored, not expired) soft-reset snapshot for partner. */
export async function fetchPartnerWebsiteResetTrashInfoFromPg(
  partnerId: string
): Promise<PartnerWebsiteResetTrashInfo | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(partnerId)
  if (!pid) return null
  try {
    // Drop expired rows opportunistically
    await pgQuery(
      `delete from public.messaging_partner_website_reset_trash
       where partner_id = $1::uuid and expires_at <= now()`,
      [pid]
    )
    const row = await pgQueryOne<{
      partner_id: string
      reset_at: string
      expires_at: string
      title: string | null
      site_slug: string | null
      days_left: string | number
    }>(
      `select
         t.partner_id::text,
         t.reset_at::text,
         t.expires_at::text,
         coalesce(t.payload->'website'->>'title', '') as title,
         coalesce(t.payload->'website'->>'site_slug', '') as site_slug,
         greatest(0, ceil(extract(epoch from (t.expires_at - now())) / 86400.0)) as days_left
       from public.messaging_partner_website_reset_trash t
       where t.partner_id = $1::uuid
         and t.restored_at is null
         and t.expires_at > now()
       limit 1`,
      [pid]
    )
    if (!row) return null
    return {
      partnerId: row.partner_id,
      resetAt: row.reset_at,
      expiresAt: row.expires_at,
      title: row.title?.trim() || '',
      siteSlug: row.site_slug?.trim() || '',
      daysLeft: Math.max(0, Math.min(PARTNER_WEBSITE_RESET_TRASH_DAYS, Number(row.days_left) || 0)),
    }
  } catch (e) {
    console.warn('[fetchPartnerWebsiteResetTrashInfoFromPg]', e)
    return null
  }
}

/**
 * Verify OTP → snapshot website (+ revisions + landings) into 7-day trash → delete live site.
 */
export async function verifyPartnerWebsiteResetOtpAndDeleteFromPg(params: {
  partnerId: string
  ownerUserId: string
  otp: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(params.partnerId)
  const uid = safeUuid(params.ownerUserId)
  if (!pid || !uid) return false
  const otp = params.otp.replace(/\D/g, '').trim()
  if (otp.length !== 6) return false
  const tryHash = hashPartnerWebsiteResetOtp(pid, uid, otp)
  try {
    const row = await pgQueryOne<{ deleted: boolean }>(
      `with verified as (
         delete from public.messaging_partner_website_reset_otps o
         where o.partner_id = $1::uuid
           and o.owner_user_id = $2::uuid
           and o.expires_at > now()
           and o.otp_hash = $3
         returning o.id
       ),
       site as (
         select w.*
         from public.messaging_partner_websites w
         where w.partner_id = $1::uuid
           and exists (
             select 1 from public.messaging_partners p
             where p.id = $1::uuid and p.owner_user_id = $2::uuid
           )
           and exists (select 1 from verified)
         limit 1
       ),
       snap as (
         insert into public.messaging_partner_website_reset_trash (
           partner_id, owner_user_id, payload, reset_at, expires_at, restored_at
         )
         select
           s.partner_id,
           $2::uuid,
           jsonb_build_object(
             'website', to_jsonb(s),
             'revisions', coalesce(
               (select jsonb_agg(to_jsonb(r) order by r.created_at)
                from public.messaging_partner_website_revisions r
                where r.partner_id = s.partner_id),
               '[]'::jsonb
             ),
             'landings', coalesce(
               (select jsonb_agg(to_jsonb(l) order by l.created_at)
                from public.messaging_partner_landing_pages l
                where l.partner_id = s.partner_id),
               '[]'::jsonb
             ),
             'presetLooks', coalesce(
               (select jsonb_agg(to_jsonb(pl) order by pl.preset_id)
                from public.messaging_partner_website_preset_looks pl
                where pl.partner_id = s.partner_id),
               '[]'::jsonb
             )
           ),
           timezone('utc'::text, now()),
           timezone('utc'::text, now()) + ($4::int * interval '1 day'),
           null
         from site s
         on conflict (partner_id) do update set
           owner_user_id = excluded.owner_user_id,
           payload = excluded.payload,
           reset_at = excluded.reset_at,
           expires_at = excluded.expires_at,
           restored_at = null,
           created_at = timezone('utc'::text, now())
         returning partner_id
       ),
       del_revisions as (
         delete from public.messaging_partner_website_revisions r
         where r.partner_id = $1::uuid
           and exists (select 1 from snap)
       ),
       del_site as (
         delete from public.messaging_partner_websites w
         where w.partner_id = $1::uuid
           and exists (select 1 from snap)
         returning w.id
       )
       select exists(select 1 from snap) as deleted`,
      [pid, uid, tryHash, PARTNER_WEBSITE_RESET_TRASH_DAYS]
    )
    return row?.deleted === true
  } catch (e) {
    console.warn('[verifyPartnerWebsiteResetOtpAndDeleteFromPg]', e)
    return false
  }
}

/**
 * Restore soft-reset snapshot within retention window.
 * Fails if a live website already exists for the partner.
 */
export async function restorePartnerWebsiteFromResetTrashPg(params: {
  partnerId: string
  ownerUserId: string
}): Promise<{ ok: true; website: PartnerWebsiteRow } | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'Database not configured' }
  const pid = safeUuid(params.partnerId)
  const uid = safeUuid(params.ownerUserId)
  if (!pid || !uid) return { ok: false, error: 'Invalid id' }

  try {
    const owned = await pgQueryOne<{ id: string }>(
      `select id::text from public.messaging_partners
       where id = $1::uuid and owner_user_id = $2::uuid limit 1`,
      [pid, uid]
    )
    if (!owned) return { ok: false, error: 'Forbidden' }

    const live = await pgQueryOne<{ id: string }>(
      `select id::text from public.messaging_partner_websites where partner_id = $1::uuid limit 1`,
      [pid]
    )
    if (live) {
      return {
        ok: false,
        error:
          'Đã có website mới — xóa/reset web hiện tại trước khi khôi phục bản cũ, hoặc giữ bản mới.',
      }
    }

    const trash = await pgQueryOne<{ payload: unknown; expires_at: string }>(
      `select payload, expires_at::text
       from public.messaging_partner_website_reset_trash
       where partner_id = $1::uuid
         and restored_at is null
         and expires_at > now()
       limit 1`,
      [pid]
    )
    if (!trash?.payload || typeof trash.payload !== 'object') {
      return { ok: false, error: 'Không còn bản lưu để khôi phục (hết hạn hoặc đã dùng).' }
    }

    const payload = trash.payload as {
      website?: Record<string, unknown>
      revisions?: Array<Record<string, unknown>>
      landings?: Array<Record<string, unknown>>
      presetLooks?: Array<Record<string, unknown>>
    }
    const w = payload.website
    if (!w?.id || !w.partner_id || !w.site_slug) {
      return { ok: false, error: 'Bản lưu không hợp lệ.' }
    }

    await pgQuery(
      `insert into public.messaging_partner_websites (
         id, partner_id, site_slug, title, brief_text, logo_url,
         reference_image_urls, project_files_json, html_source, locale,
         is_published, published_at, source_thread_id,
         render_mode, template_id, theme_json, pages_json,
         creation_journal_json, created_at, updated_at
       )
       values (
         $1::uuid, $2::uuid, $3, $4, $5, $6,
         coalesce($7::jsonb, '[]'::jsonb),
         coalesce($8::jsonb, '[]'::jsonb),
         $9, coalesce($10, 'vi'),
         coalesce($11::boolean, false), $12::timestamptz, $13::uuid,
         coalesce($14, 'legacy'), coalesce($15, 'custom-mockup-v1'),
         coalesce($16::jsonb, '{}'::jsonb),
         coalesce($17::jsonb, '[]'::jsonb),
         coalesce($18::jsonb, null),
         coalesce($19::timestamptz, timezone('utc'::text, now())),
         timezone('utc'::text, now())
       )`,
      [
        String(w.id),
        String(w.partner_id),
        String(w.site_slug),
        String(w.title ?? ''),
        String(w.brief_text ?? ''),
        w.logo_url ?? null,
        JSON.stringify(w.reference_image_urls ?? []),
        JSON.stringify(w.project_files_json ?? []),
        w.html_source ?? null,
        w.locale ?? 'vi',
        Boolean(w.is_published),
        w.published_at ?? null,
        w.source_thread_id ?? null,
        w.render_mode ?? 'legacy',
        w.template_id ?? 'custom-mockup-v1',
        JSON.stringify(w.theme_json ?? {}),
        JSON.stringify(w.pages_json ?? []),
        w.creation_journal_json != null ? JSON.stringify(w.creation_journal_json) : null,
        w.created_at ?? null,
      ]
    )

    const websiteId = String(w.id)
    const revisions = Array.isArray(payload.revisions) ? payload.revisions : []
    for (const r of revisions) {
      if (!r?.id) continue
      try {
        await pgQuery(
          `insert into public.messaging_partner_website_revisions (
             id, partner_id, website_id, change_note,
             project_files_json, html_source, title, brief_text, logo_url,
             reference_image_urls, locale, render_mode, template_id, theme_json, pages_json,
             created_at
           ) values (
             $1::uuid, $2::uuid, $3::uuid, $4,
             coalesce($5::jsonb, '[]'::jsonb), $6, $7, $8, $9,
             coalesce($10::jsonb, '[]'::jsonb), coalesce($11, 'vi'),
             coalesce($12, 'legacy'), coalesce($13, 'custom-mockup-v1'),
             coalesce($14::jsonb, '{}'::jsonb), coalesce($15::jsonb, '[]'::jsonb),
             coalesce($16::timestamptz, timezone('utc'::text, now()))
           )
           on conflict (id) do nothing`,
          [
            String(r.id),
            pid,
            websiteId,
            r.change_note ?? null,
            JSON.stringify(r.project_files_json ?? []),
            r.html_source ?? null,
            r.title ?? '',
            r.brief_text ?? '',
            r.logo_url ?? null,
            JSON.stringify(r.reference_image_urls ?? []),
            r.locale ?? 'vi',
            r.render_mode ?? 'legacy',
            r.template_id ?? 'custom-mockup-v1',
            JSON.stringify(r.theme_json ?? {}),
            JSON.stringify(r.pages_json ?? []),
            r.created_at ?? null,
          ]
        )
      } catch (e) {
        console.warn('[restorePartnerWebsiteFromResetTrashPg] revision', e)
      }
    }

    const landings = Array.isArray(payload.landings) ? payload.landings : []
    for (const l of landings) {
      if (!l?.id || !l.landing_slug) continue
      try {
        await pgQuery(
          `insert into public.messaging_partner_landing_pages (
             id, partner_id, website_id, landing_slug, title, brief_text, locale,
             inventory_ids, project_files_json, html_source, reference_image_urls,
             mockup_url, is_published, published_at, created_at, updated_at
           ) values (
             $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, coalesce($7, 'vi'),
             coalesce(
               (select array_agg(x::uuid) from jsonb_array_elements_text($8::jsonb) as t(x)),
               '{}'::uuid[]
             ),
             coalesce($9::jsonb, '{"entryPath":"index.html","files":[]}'::jsonb),
             $10, coalesce($11::jsonb, '[]'::jsonb),
             $12, coalesce($13::boolean, false), $14::timestamptz,
             coalesce($15::timestamptz, timezone('utc'::text, now())),
             timezone('utc'::text, now())
           )
           on conflict (partner_id, landing_slug) do nothing`,
          [
            String(l.id),
            pid,
            websiteId,
            String(l.landing_slug),
            String(l.title ?? ''),
            String(l.brief_text ?? ''),
            l.locale ?? 'vi',
            JSON.stringify(Array.isArray(l.inventory_ids) ? l.inventory_ids : []),
            JSON.stringify(l.project_files_json ?? { entryPath: 'index.html', files: [] }),
            l.html_source ?? null,
            JSON.stringify(l.reference_image_urls ?? []),
            l.mockup_url ?? null,
            Boolean(l.is_published),
            l.published_at ?? null,
            l.created_at ?? null,
          ]
        )
      } catch (e) {
        console.warn('[restorePartnerWebsiteFromResetTrashPg] landing', e)
      }
    }

    const presetLooks = Array.isArray(payload.presetLooks) ? payload.presetLooks : []
    if (presetLooks.length) {
      await insertPartnerWebsitePresetLooksFromTrashPg({
        partnerId: pid,
        websiteId,
        looks: presetLooks,
      })
    }

    await pgQuery(
      `update public.messaging_partner_website_reset_trash
       set restored_at = timezone('utc'::text, now())
       where partner_id = $1::uuid`,
      [pid]
    )

    const website = await fetchPartnerWebsiteByPartnerIdPg(pid)
    if (!website) return { ok: false, error: 'Khôi phục xong nhưng không đọc lại được website.' }
    return { ok: true, website }
  } catch (e) {
    console.warn('[restorePartnerWebsiteFromResetTrashPg]', e)
    return { ok: false, error: 'Không khôi phục được — thử lại sau.' }
  }
}
