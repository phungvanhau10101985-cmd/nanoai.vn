import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type PartnerWebsiteLeadRow = {
  id: string
  partnerId: string
  siteSlug: string
  name: string
  phone: string
  email: string
  message: string
  status: 'new' | 'read' | 'archived'
  createdAt: string
}

function mapLead(r: {
  id: string
  partner_id: string
  site_slug: string
  name: string | null
  phone: string | null
  email: string | null
  message: string | null
  status: string | null
  created_at: unknown
}): PartnerWebsiteLeadRow {
  const status = r.status === 'read' || r.status === 'archived' ? r.status : 'new'
  return {
    id: r.id,
    partnerId: r.partner_id,
    siteSlug: r.site_slug,
    name: r.name?.trim() || '',
    phone: r.phone?.trim() || '',
    email: r.email?.trim() || '',
    message: r.message?.trim() || '',
    status,
    createdAt: String(r.created_at ?? ''),
  }
}

export async function insertPartnerWebsiteLeadPg(input: {
  partnerId: string
  siteSlug: string
  name: string
  phone: string
  email: string
  message: string
}): Promise<PartnerWebsiteLeadRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Parameters<typeof mapLead>[0]>(
      `insert into public.messaging_partner_website_leads (
         partner_id, site_slug, name, phone, email, message
       ) values ($1::uuid, $2, $3, $4, $5, $6)
       returning id::text, partner_id::text, site_slug, name, phone, email, message, status, created_at`,
      [
        input.partnerId,
        input.siteSlug.trim().toLowerCase(),
        input.name.slice(0, 200),
        input.phone.slice(0, 50),
        input.email.slice(0, 200),
        input.message.slice(0, 4000),
      ]
    )
    return row ? mapLead(row) : null
  } catch (e) {
    console.error('[partner-website-leads-pg] insert', e)
    return null
  }
}

export async function listPartnerWebsiteLeadsPg(
  partnerId: string,
  limit = 50
): Promise<PartnerWebsiteLeadRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<Parameters<typeof mapLead>[0]>(
      `select id::text, partner_id::text, site_slug, name, phone, email, message, status, created_at
       from public.messaging_partner_website_leads
       where partner_id = $1::uuid
       order by created_at desc
       limit $2`,
      [partnerId.trim(), limit]
    )
    return rows.map(mapLead)
  } catch (e) {
    console.error('[partner-website-leads-pg] list', e)
    return []
  }
}

export async function markPartnerWebsiteLeadReadPg(input: {
  partnerId: string
  leadId: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.messaging_partner_website_leads set status = 'read'
       where id = $1::uuid and partner_id = $2::uuid`,
      [input.leadId, input.partnerId]
    )
    return true
  } catch (e) {
    console.error('[partner-website-leads-pg] markRead', e)
    return false
  }
}

export async function fetchPublishedWebsitePartnerIdBySlugPg(
  siteSlug: string
): Promise<{ partnerId: string; siteSlug: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ partner_id: string; site_slug: string }>(
      `select w.partner_id::text, w.site_slug
       from public.messaging_partner_websites w
       inner join public.messaging_partners p on p.id = w.partner_id
       where w.site_slug = $1 and w.is_published = true
         and coalesce(p.is_active, true) = true
         and p.purge_at is null
       limit 1`,
      [siteSlug.trim().toLowerCase()]
    )
    if (!row) return null
    return { partnerId: row.partner_id, siteSlug: row.site_slug }
  } catch (e) {
    console.error('[partner-website-leads-pg] fetchPublishedWebsitePartnerIdBySlugPg', e)
    return null
  }
}
