import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { CurriculumMobileLeadInput } from '@/lib/curriculum/curriculum-mobile-lead'

export async function findRecentCurriculumMobileLeadId(contactKey: string): Promise<string | null> {
  const row = await pgQueryOne<{ id: string }>(
    `select id::text as id
     from public.curriculum_mobile_leads
     where contact_key = $1
       and created_at > now() - interval '24 hours'
     limit 1`,
    [contactKey]
  )
  return row?.id ?? null
}

export async function insertCurriculumMobileLead(input: {
  lead: CurriculumMobileLeadInput
  locale: string
  ip: string
  userAgent: string
}): Promise<string> {
  const rows = await pgQuery<{ id: string }>(
    `insert into public.curriculum_mobile_leads (
       name, contact, contact_key, contact_kind, subject, locale, ip, user_agent
     ) values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id::text as id`,
    [
      input.lead.name,
      input.lead.contact,
      input.lead.contactKey,
      input.lead.contactKind,
      input.lead.subject,
      input.locale,
      input.ip,
      input.userAgent,
    ]
  )
  const id = rows[0]?.id
  if (!id) throw new Error('insert_failed')
  return id
}
