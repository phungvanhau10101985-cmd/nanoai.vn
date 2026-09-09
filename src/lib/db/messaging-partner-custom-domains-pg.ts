import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  partnerCustomDomainHostLookupNames,
  partnerCustomDomainPublicOrigin,
} from '@/lib/messaging/partner-custom-domain-hostname'

export type PartnerCustomDomainRow = {
  id: string
  partner_id: string
  hostname: string
  verification_token: string
  dns_verified_at: string | null
  ssl_status: 'pending' | 'dns_ok' | 'ssl_active' | 'error'
  ssl_provisioned_at: string | null
  ssl_last_error: string | null
  use_for_chat: boolean
  use_for_site: boolean
  created_at: string
  updated_at: string
}

export type PartnerCustomDomainResolveRow = {
  partner_id: string
  partner_slug: string
  site_slug: string | null
  site_published: boolean
  use_for_chat: boolean
  use_for_site: boolean
}

export type UpsertPartnerCustomDomainResult =
  | { ok: true; row: PartnerCustomDomainRow }
  | { ok: false; error: 'hostname_taken' | 'save_failed' }

const DOMAIN_RETURNING = `id, partner_id, hostname, verification_token,
            dns_verified_at, ssl_status, ssl_provisioned_at, ssl_last_error,
            use_for_chat, use_for_site, created_at, updated_at`

function pgErrCode(e: unknown): string | null {
  if (!e || typeof e !== 'object') return null
  const code = (e as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

export function isHostnameUniqueViolation(e: unknown): boolean {
  if (pgErrCode(e) !== '23505') return false
  const constraint = String((e as { constraint?: unknown }).constraint ?? '').toLowerCase()
  const message = String((e as { message?: unknown }).message ?? '').toLowerCase()
  const detail = String((e as { detail?: unknown }).detail ?? '').toLowerCase()
  if (constraint.includes('partner') && !constraint.includes('hostname')) return false
  return constraint.includes('hostname') || message.includes('hostname') || detail.includes('hostname')
}

function mapRow(r: Record<string, unknown>): PartnerCustomDomainRow {
  return {
    id: String(r.id),
    partner_id: String(r.partner_id),
    hostname: String(r.hostname),
    verification_token: String(r.verification_token),
    dns_verified_at: r.dns_verified_at ? String(r.dns_verified_at) : null,
    ssl_status: String(r.ssl_status) as PartnerCustomDomainRow['ssl_status'],
    ssl_provisioned_at: r.ssl_provisioned_at ? String(r.ssl_provisioned_at) : null,
    ssl_last_error: r.ssl_last_error ? String(r.ssl_last_error) : null,
    use_for_chat: Boolean(r.use_for_chat),
    use_for_site: Boolean(r.use_for_site),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }
}

export async function fetchPartnerCustomDomainByPartnerIdPg(
  partnerId: string
): Promise<PartnerCustomDomainRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select ${DOMAIN_RETURNING}
       from public.messaging_partner_custom_domains
       where partner_id = $1::uuid
       limit 1`,
      [partnerId]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.error('[fetchPartnerCustomDomainByPartnerIdPg]', e)
    return null
  }
}

async function updatePartnerCustomDomainRowPg(input: {
  partnerId: string
  hostname: string
  verificationToken: string
  useForChat: boolean
  useForSite: boolean
}): Promise<PartnerCustomDomainRow | null> {
  const row = await pgQueryOne<Record<string, unknown>>(
    `update public.messaging_partner_custom_domains set
       hostname = $2,
       verification_token = $3,
       use_for_chat = $4,
       use_for_site = $5,
       dns_verified_at = null,
       ssl_status = 'pending',
       ssl_provisioned_at = null,
       ssl_last_error = null,
       updated_at = timezone('utc', now())
     where partner_id = $1::uuid
     returning ${DOMAIN_RETURNING}`,
    [input.partnerId, input.hostname, input.verificationToken, input.useForChat, input.useForSite]
  )
  return row ? mapRow(row) : null
}

export async function upsertPartnerCustomDomainPg(input: {
  partnerId: string
  hostname: string
  verificationToken: string
  useForChat: boolean
  useForSite: boolean
}): Promise<UpsertPartnerCustomDomainResult> {
  if (!isPgConfigured()) return { ok: false, error: 'save_failed' }
  try {
    const updated = await updatePartnerCustomDomainRowPg(input)
    if (updated) return { ok: true, row: updated }

    const inserted = await pgQueryOne<Record<string, unknown>>(
      `insert into public.messaging_partner_custom_domains
         (partner_id, hostname, verification_token, use_for_chat, use_for_site, updated_at)
       values ($1::uuid, $2, $3, $4, $5, timezone('utc', now()))
       returning ${DOMAIN_RETURNING}`,
      [input.partnerId, input.hostname, input.verificationToken, input.useForChat, input.useForSite]
    )
    if (inserted) return { ok: true, row: mapRow(inserted) }
    return { ok: false, error: 'save_failed' }
  } catch (e) {
    if (isHostnameUniqueViolation(e)) {
      return { ok: false, error: 'hostname_taken' }
    }
    if (pgErrCode(e) === '23505') {
      try {
        const raced = await updatePartnerCustomDomainRowPg(input)
        if (raced) return { ok: true, row: raced }
      } catch (retryErr) {
        if (isHostnameUniqueViolation(retryErr)) return { ok: false, error: 'hostname_taken' }
        console.error('[upsertPartnerCustomDomainPg] retry', retryErr)
      }
    }
    console.error('[upsertPartnerCustomDomainPg]', e)
    return { ok: false, error: 'save_failed' }
  }
}

export async function updatePartnerCustomDomainVerificationPg(input: {
  partnerId: string
  dnsVerified: boolean
  sslStatus: PartnerCustomDomainRow['ssl_status']
  sslLastError?: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  await pgQuery(
    `update public.messaging_partner_custom_domains set
       dns_verified_at = case when $2::boolean then timezone('utc', now()) else null end,
       ssl_status = $3,
       ssl_provisioned_at = case when $3 = 'ssl_active' then timezone('utc', now()) else ssl_provisioned_at end,
       ssl_last_error = $4,
       updated_at = timezone('utc', now())
     where partner_id = $1::uuid`,
    [input.partnerId, input.dnsVerified, input.sslStatus, input.sslLastError ?? null]
  )
  return true
}

export async function updatePartnerCustomDomainFlagsPg(input: {
  partnerId: string
  useForChat: boolean
  useForSite: boolean
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  await pgQuery(
    `update public.messaging_partner_custom_domains set
       use_for_chat = $2,
       use_for_site = $3,
       updated_at = timezone('utc', now())
     where partner_id = $1::uuid`,
    [input.partnerId, input.useForChat, input.useForSite]
  )
  return true
}

export async function deletePartnerCustomDomainPg(partnerId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  await pgQuery(`delete from public.messaging_partner_custom_domains where partner_id = $1::uuid`, [partnerId])
  return true
}

export async function resolveActivePartnerCustomDomainByHostPg(
  hostname: string
): Promise<PartnerCustomDomainResolveRow | null> {
  if (!isPgConfigured()) return null
  const host = hostname.trim().toLowerCase()
  const lookup = partnerCustomDomainHostLookupNames(host)
  if (lookup.length === 0) return null
  const row = await pgQueryOne<Record<string, unknown>>(
    `select d.partner_id, p.slug as partner_slug,
            w.site_slug, coalesce(w.is_published, false) as site_published,
            d.use_for_chat, d.use_for_site
     from public.messaging_partner_custom_domains d
     join public.messaging_partners p on p.id = d.partner_id
     left join public.messaging_partner_websites w on w.partner_id = d.partner_id
     where lower(d.hostname) = any($1::text[])
       and d.dns_verified_at is not null
       and d.ssl_status = 'ssl_active'
       and p.is_active = true
       and p.purge_at is null
     order by case when lower(d.hostname) = $2 then 0 else 1 end
     limit 1`,
    [lookup, host]
  )
  if (!row) return null
  return {
    partner_id: String(row.partner_id),
    partner_slug: String(row.partner_slug),
    site_slug: row.site_slug ? String(row.site_slug) : null,
    site_published: Boolean(row.site_published),
    use_for_chat: Boolean(row.use_for_chat),
    use_for_site: Boolean(row.use_for_site),
  }
}

export async function fetchActivePartnerCustomDomainOriginPg(partnerId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ hostname: string }>(
    `select hostname from public.messaging_partner_custom_domains
     where partner_id = $1::uuid
       and dns_verified_at is not null
       and ssl_status = 'ssl_active'
     limit 1`,
    [partnerId]
  )
  const h = row?.hostname?.trim()
  return h ? partnerCustomDomainPublicOrigin(h) : null
}

/** Tên miền shop trong quản trị (SSL + dùng cho website /site) — nguồn SSO Google mặc định. */
export async function fetchPartnerShopSiteCustomDomainOriginPg(partnerId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ hostname: string }>(
    `select hostname from public.messaging_partner_custom_domains
     where partner_id = $1::uuid
       and dns_verified_at is not null
       and ssl_status = 'ssl_active'
       and use_for_site = true
     limit 1`,
    [partnerId]
  )
  const h = row?.hostname?.trim()
  return h ? partnerCustomDomainPublicOrigin(h) : null
}

/** Hostname đã lưu trong quản trị (chưa cần SSL) — dùng cho link «Xem web» / preview. */
/** Domain đã verify DNS nhưng chưa SSL — cron/worker VPS cấp cert + nginx. */
export async function fetchPartnerCustomDomainsNeedingSslPg(limit = 20): Promise<
  Array<{ partner_id: string; hostname: string; ssl_status: PartnerCustomDomainRow['ssl_status'] }>
> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<{ partner_id: string; hostname: string; ssl_status: string }>(
    `select d.partner_id::text, d.hostname, d.ssl_status
     from public.messaging_partner_custom_domains d
     join public.messaging_partners p on p.id = d.partner_id
     where d.dns_verified_at is not null
       and d.ssl_status in ('dns_ok', 'pending')
       and p.is_active = true
       and p.purge_at is null
     order by d.updated_at asc
     limit $1`,
    [limit]
  )
  return rows.map((r) => ({
    partner_id: r.partner_id,
    hostname: r.hostname,
    ssl_status: r.ssl_status as PartnerCustomDomainRow['ssl_status'],
  }))
}

/** Domain đã SSL — cron cấp thêm cert cho bản www/apex còn thiếu. */
export async function fetchSslActivePartnerCustomDomainsPg(limit = 20): Promise<
  Array<{ partner_id: string; hostname: string }>
> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<{ partner_id: string; hostname: string }>(
    `select d.partner_id::text, d.hostname
     from public.messaging_partner_custom_domains d
     join public.messaging_partners p on p.id = d.partner_id
     where d.dns_verified_at is not null
       and d.ssl_status = 'ssl_active'
       and p.is_active = true
       and p.purge_at is null
     order by d.updated_at asc
     limit $1`,
    [limit]
  )
  return rows.map((r) => ({ partner_id: r.partner_id, hostname: r.hostname }))
}

export async function fetchPartnerWebsiteConfiguredSiteOriginPg(partnerId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ hostname: string }>(
    `select hostname from public.messaging_partner_custom_domains
     where partner_id = $1::uuid
       and use_for_site = true
     limit 1`,
    [partnerId]
  )
  const h = row?.hostname?.trim()
  return h ? partnerCustomDomainPublicOrigin(h) : null
}
