import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type MessagingPartnerLogoVersionRow = {
  id: string
  partner_id: string
  source_logo_url: string
  normalized_logo_url: string
  model: string
  prompt: string
  status: 'done' | 'failed'
  charged_credits: number
  is_active: boolean
  created_by: string | null
  created_at: string
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function isMissingTableError(e: unknown): boolean {
  const err = e as { code?: string } | null
  return Boolean(err?.code === '42P01')
}

export async function listPartnerLogoVersionsFromPg(partnerId: string): Promise<MessagingPartnerLogoVersionRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      id: string
      partner_id: string
      source_logo_url: string
      normalized_logo_url: string
      model: string | null
      prompt: string | null
      status: 'done' | 'failed' | null
      charged_credits: string | number | null
      is_active: boolean | null
      created_by: string | null
      created_at: unknown
    }>(
      `select id::text, partner_id::text, source_logo_url, normalized_logo_url, model, prompt, status,
              charged_credits, coalesce(is_active, false) as is_active, created_by::text, created_at
       from public.messaging_partner_logo_versions
       where partner_id = $1::uuid
       order by created_at desc`,
      [partnerId]
    )
    return rows.map((r) => ({
      id: r.id,
      partner_id: r.partner_id,
      source_logo_url: r.source_logo_url,
      normalized_logo_url: r.normalized_logo_url,
      model: String(r.model ?? ''),
      prompt: String(r.prompt ?? ''),
      status: r.status === 'failed' ? 'failed' : 'done',
      charged_credits: asNum(r.charged_credits),
      is_active: r.is_active === true,
      created_by: r.created_by,
      created_at: toIso(r.created_at),
    }))
  } catch (e) {
    if (isMissingTableError(e)) return []
    console.warn('[listPartnerLogoVersionsFromPg]', e)
    return null
  }
}

export async function insertPartnerLogoVersionFromPg(input: {
  partnerId: string
  sourceLogoUrl: string
  normalizedLogoUrl: string
  model: string
  prompt: string
  chargedCredits: number
  createdBy: string | null
}): Promise<MessagingPartnerLogoVersionRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      partner_id: string
      source_logo_url: string
      normalized_logo_url: string
      model: string | null
      prompt: string | null
      status: 'done' | 'failed' | null
      charged_credits: string | number | null
      is_active: boolean | null
      created_by: string | null
      created_at: unknown
    }>(
      `insert into public.messaging_partner_logo_versions (
         partner_id, source_logo_url, normalized_logo_url, model, prompt, status, charged_credits, created_by, is_active
       ) values (
         $1::uuid, $2, $3, $4, $5, 'done', $6::numeric, $7::uuid, false
       )
       returning id::text, partner_id::text, source_logo_url, normalized_logo_url, model, prompt, status,
                 charged_credits, coalesce(is_active, false) as is_active, created_by::text, created_at`,
      [
        input.partnerId,
        input.sourceLogoUrl,
        input.normalizedLogoUrl,
        input.model,
        input.prompt,
        input.chargedCredits,
        input.createdBy,
      ]
    )
    if (!row) return null
    return {
      id: row.id,
      partner_id: row.partner_id,
      source_logo_url: row.source_logo_url,
      normalized_logo_url: row.normalized_logo_url,
      model: String(row.model ?? ''),
      prompt: String(row.prompt ?? ''),
      status: row.status === 'failed' ? 'failed' : 'done',
      charged_credits: asNum(row.charged_credits),
      is_active: row.is_active === true,
      created_by: row.created_by,
      created_at: toIso(row.created_at),
    }
  } catch (e) {
    console.warn('[insertPartnerLogoVersionFromPg]', e)
    return null
  }
}

export async function activatePartnerLogoVersionFromPg(input: {
  partnerId: string
  versionId: string
  ownerUserId: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.messaging_partner_logo_versions
       set is_active = false
       where partner_id = $1::uuid`,
      [input.partnerId]
    )
    const v = await pgQueryOne<{ id: string; normalized_logo_url: string }>(
      `update public.messaging_partner_logo_versions
       set is_active = true
       where id = $1::uuid and partner_id = $2::uuid
       returning id::text, normalized_logo_url`,
      [input.versionId, input.partnerId]
    )
    if (!v) return false
    const mp = await pgQueryOne<{ id: string }>(
      `update public.messaging_partners
       set logo_url = $4, updated_at = now()
       where id = $1::uuid and owner_user_id = $2::uuid and coalesce(is_active, true) = true
       returning id::text as id`,
      [input.partnerId, input.ownerUserId, input.versionId, v.normalized_logo_url]
    )
    return Boolean(mp?.id)
  } catch (e) {
    console.warn('[activatePartnerLogoVersionFromPg]', e)
    return false
  }
}
