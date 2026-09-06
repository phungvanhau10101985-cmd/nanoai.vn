import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { normalizeImportedEmail } from '@/lib/messaging/partner-email-normalize'

export const EMAIL_WARMUP_UNLIMITED = 999_999
export const EMAIL_WARMUP_DEFAULT_START = 5
export const EMAIL_WARMUP_DEFAULT_INCREMENT = 5

export type PartnerEmailSendChannel =
  | 'birthday'
  | 'marketing'
  | 'cart_abandon'
  | 'comeback'
  | 'newsletter'
  | 'newsletter_welcome'
  | 'broadcast'

export type PartnerEmailSendSettingsRow = {
  partner_id: string
  warmup_enabled: boolean
  start_limit: number
  daily_increment: number
  max_limit: number | null
  birthday_cron_enabled: boolean
  cart_abandon_email_enabled: boolean
  comeback_email_enabled: boolean
  newsletter_welcome_email_enabled: boolean
  warmup_started_at: string | null
  warmup_day: number
  daily_sent_total: number
  daily_birthday_sent: number
  daily_marketing_sent: number
  last_reset_date: string | null
  updated_at: string
}

export type PartnerNewsletterSubscriberRow = {
  id: string
  partner_id: string
  email_normalized: string
  email_raw: string
  subscriber_name: string | null
  gender: string | null
  birthday: string | null
  phone: string | null
  source: string
  is_active: boolean
  subscribed_at: string
  unsubscribed_at: string | null
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function computeDailyLimit(row: {
  warmup_enabled: boolean
  start_limit: number
  daily_increment: number
  max_limit: number | null
  warmup_day: number
}): number {
  if (!row.warmup_enabled) return EMAIL_WARMUP_UNLIMITED
  const start = Math.max(1, row.start_limit || EMAIL_WARMUP_DEFAULT_START)
  const increment = Math.max(1, row.daily_increment || EMAIL_WARMUP_DEFAULT_INCREMENT)
  const day = Math.max(1, row.warmup_day || 1)
  let limit = start + (day - 1) * increment
  if (row.max_limit && row.max_limit > 0) limit = Math.min(limit, row.max_limit)
  return limit
}

export function partnerEmailWarmupDailyLimit(row: {
  warmup_enabled: boolean
  start_limit: number
  daily_increment: number
  max_limit: number | null
  warmup_day: number
}): number {
  return computeDailyLimit(row)
}

async function insertDefaultSettings(partnerId: string): Promise<void> {
  await pgQuery(
    `insert into public.messaging_partner_email_send_settings (partner_id)
     values ($1::uuid)
     on conflict (partner_id) do nothing`,
    [partnerId]
  )
}

export async function fetchPartnerEmailSendSettingsFromPg(
  partnerId: string
): Promise<PartnerEmailSendSettingsRow | null> {
  if (!isPgConfigured()) return null
  await insertDefaultSettings(partnerId)
  const row = await pgQueryOne<PartnerEmailSendSettingsRow>(
    `select partner_id::text, warmup_enabled, start_limit, daily_increment, max_limit,
            birthday_cron_enabled, cart_abandon_email_enabled, comeback_email_enabled,
            newsletter_welcome_email_enabled, warmup_started_at::text, warmup_day,
            daily_sent_total, daily_birthday_sent, daily_marketing_sent,
            last_reset_date::text, updated_at::text
     from public.messaging_partner_email_send_settings
     where partner_id = $1::uuid
     limit 1`,
    [partnerId]
  )
  return row
}

async function ensureDailyReset(partnerId: string): Promise<PartnerEmailSendSettingsRow | null> {
  const today = todayYmd()
  await pgQuery(
    `update public.messaging_partner_email_send_settings
     set warmup_day = case
           when last_reset_date is not null and last_reset_date::text <> $2 then warmup_day + 1
           else warmup_day
         end,
         warmup_started_at = coalesce(warmup_started_at, now()),
         daily_sent_total = case when last_reset_date::text = $2 then daily_sent_total else 0 end,
         daily_birthday_sent = case when last_reset_date::text = $2 then daily_birthday_sent else 0 end,
         daily_marketing_sent = case when last_reset_date::text = $2 then daily_marketing_sent else 0 end,
         last_reset_date = $2::date,
         updated_at = now()
     where partner_id = $1::uuid
       and (last_reset_date is null or last_reset_date::text <> $2)`,
    [partnerId, today]
  )
  return fetchPartnerEmailSendSettingsFromPg(partnerId)
}

export async function tryConsumePartnerEmailSendSlotFromPg(input: {
  partnerId: string
  channel: PartnerEmailSendChannel
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  await insertDefaultSettings(input.partnerId)
  const row = await ensureDailyReset(input.partnerId)
  if (!row) return false
  if (!row.warmup_enabled) {
    await recordSend(input.partnerId, input.channel)
    return true
  }
  const limit = computeDailyLimit(row)
  if (row.daily_sent_total >= limit) return false
  await recordSend(input.partnerId, input.channel)
  return true
}

async function recordSend(partnerId: string, channel: PartnerEmailSendChannel): Promise<void> {
  const birthday = channel === 'birthday' ? 1 : 0
  const marketing = channel === 'birthday' ? 0 : 1
  await pgQuery(
    `update public.messaging_partner_email_send_settings
     set daily_sent_total = daily_sent_total + 1,
         daily_birthday_sent = daily_birthday_sent + $2,
         daily_marketing_sent = daily_marketing_sent + $3,
         updated_at = now()
     where partner_id = $1::uuid`,
    [partnerId, birthday, marketing]
  )
}

export async function updatePartnerEmailWarmupSettingsFromPg(input: {
  partnerId: string
  warmupEnabled: boolean
  startLimit: number
  dailyIncrement: number
  maxLimit: number | null
  birthdayCronEnabled: boolean
  cartAbandonEmailEnabled: boolean
  comebackEmailEnabled: boolean
  newsletterWelcomeEmailEnabled: boolean
}): Promise<PartnerEmailSendSettingsRow | null> {
  if (!isPgConfigured()) return null
  await insertDefaultSettings(input.partnerId)
  await pgQuery(
    `update public.messaging_partner_email_send_settings
     set warmup_enabled = $2,
         start_limit = $3,
         daily_increment = $4,
         max_limit = $5,
         birthday_cron_enabled = $6,
         cart_abandon_email_enabled = $7,
         comeback_email_enabled = $8,
         newsletter_welcome_email_enabled = $9,
         updated_at = now()
     where partner_id = $1::uuid`,
    [
      input.partnerId,
      input.warmupEnabled,
      Math.max(1, Math.floor(input.startLimit || 5)),
      Math.max(1, Math.floor(input.dailyIncrement || 5)),
      input.maxLimit && input.maxLimit > 0 ? Math.floor(input.maxLimit) : null,
      input.birthdayCronEnabled,
      input.cartAbandonEmailEnabled,
      input.comebackEmailEnabled,
      input.newsletterWelcomeEmailEnabled,
    ]
  )
  return fetchPartnerEmailSendSettingsFromPg(input.partnerId)
}

export async function insertPartnerEmailSendLogFromPg(input: {
  partnerId: string
  channel: string
  recipientEmail: string
  recipientKey?: string | null
  campaignKey?: string | null
  subject?: string | null
  status: 'sent' | 'failed' | 'skipped'
  error?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `insert into public.messaging_partner_email_send_log (
       partner_id, channel, recipient_email, recipient_key, campaign_key, subject, status, error
     ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.partnerId,
      input.channel.slice(0, 40),
      input.recipientEmail.slice(0, 180),
      input.recipientKey?.slice(0, 120) ?? null,
      input.campaignKey?.slice(0, 64) ?? null,
      input.subject?.slice(0, 240) ?? null,
      input.status,
      input.error?.slice(0, 400) ?? null,
    ]
  )
}

export async function listPartnerEmailSendLogFromPg(input: {
  partnerId: string
  limit?: number
}): Promise<
  Array<{
    id: string
    channel: string
    recipient_email: string
    subject: string | null
    status: string
    error: string | null
    sent_at: string
  }>
> {
  if (!isPgConfigured()) return []
  return pgQuery(
    `select id::text, channel, recipient_email, subject, status, error, sent_at::text
     from public.messaging_partner_email_send_log
     where partner_id = $1::uuid
     order by sent_at desc
     limit $2::int`,
    [input.partnerId, Math.max(1, Math.min(200, input.limit ?? 80))]
  )
}

export async function countBirthdaySentAllTimeFromPg(partnerId: string): Promise<number> {
  if (!isPgConfigured()) return 0
  const row = await pgQueryOne<{ n: number }>(
    `select count(*)::int as n from public.messaging_partner_birthday_email_sent where partner_id = $1::uuid`,
    [partnerId]
  )
  return Number(row?.n || 0)
}

export type PartnerEmailOverview = {
  warmup_enabled: boolean
  start_limit: number
  daily_increment: number
  max_limit: number | null
  birthday_cron_enabled: boolean
  cart_abandon_email_enabled: boolean
  comeback_email_enabled: boolean
  newsletter_welcome_email_enabled: boolean
  warmup_day: number
  warmup_started_at: string | null
  daily_limit: number | null
  daily_sent_total: number
  daily_birthday_sent: number
  daily_marketing_sent: number
  remaining_today: number | null
  birthday_sent_all_time: number
  smtp_configured: boolean
  newsletter_active_total: number
  active_subscribers: number
  recent_sent: Array<{
    id: string
    kind: string
    recipient_email: string
    subject: string | null
    status: string
    sent_at: string
  }>
}

export type PartnerEmailManagementOverview = PartnerEmailOverview

export async function buildPartnerEmailOverviewFromPg(
  partnerId: string,
  smtpConfigured: boolean
): Promise<PartnerEmailOverview | null> {
  const row = await ensureDailyReset(partnerId)
  if (!row) return null
  const dailyLimit = computeDailyLimit(row)
  const remaining = row.warmup_enabled ? Math.max(0, dailyLimit - row.daily_sent_total) : null
  const birthdayAll = await countBirthdaySentAllTimeFromPg(partnerId)
  const news = await pgQueryOne<{ n: number }>(
    `select count(*)::int as n from public.messaging_partner_newsletter_subscribers
     where partner_id = $1::uuid and is_active = true`,
    [partnerId]
  )
  return {
    warmup_enabled: row.warmup_enabled,
    start_limit: row.start_limit,
    daily_increment: row.daily_increment,
    max_limit: row.max_limit,
    birthday_cron_enabled: row.birthday_cron_enabled,
    cart_abandon_email_enabled: row.cart_abandon_email_enabled,
    comeback_email_enabled: row.comeback_email_enabled,
    newsletter_welcome_email_enabled: row.newsletter_welcome_email_enabled,
    warmup_day: row.warmup_day,
    warmup_started_at: row.warmup_started_at,
    daily_limit: row.warmup_enabled ? dailyLimit : null,
    daily_sent_total: row.daily_sent_total,
    daily_birthday_sent: row.daily_birthday_sent,
    daily_marketing_sent: row.daily_marketing_sent,
    remaining_today: remaining,
    birthday_sent_all_time: birthdayAll,
    smtp_configured: smtpConfigured,
    newsletter_active_total: Number(news?.n || 0),
    active_subscribers: Number(news?.n || 0),
    recent_sent: (await listPartnerEmailSendLogFromPg({ partnerId, limit: 40 })).map((row) => ({
      id: row.id,
      kind: row.channel,
      recipient_email: row.recipient_email,
      subject: row.subject,
      status: row.status,
      sent_at: row.sent_at,
    })),
  }
}

export async function upsertNewsletterSubscriberFromPg(input: {
  partnerId: string
  email?: string
  emailNormalized?: string
  emailRaw?: string
  source?: string
  subscriberName?: string | null
  gender?: string | null
  birthday?: string | null
  phone?: string | null
}): Promise<
  | { created: boolean; reactivated: boolean; skippedActive: boolean; email: string }
  | { error: string }
> {
  if (!isPgConfigured()) return { error: 'unavailable' }
  const email = (input.emailNormalized || input.email || '').trim().toLowerCase()
  if (!email) return { error: 'invalid_email' }
  const existing = await pgQueryOne<{ id: string; is_active: boolean }>(
    `select id::text, is_active from public.messaging_partner_newsletter_subscribers
     where partner_id = $1::uuid and email_normalized = $2
     limit 1`,
    [input.partnerId, email]
  )
  if (existing?.is_active) return { created: false, reactivated: false, skippedActive: true, email }
  if (existing) {
    await pgQuery(
      `update public.messaging_partner_newsletter_subscribers
       set is_active = true, unsubscribed_at = null, source = coalesce(nullif($2, ''), source),
           subscriber_name = coalesce($3, subscriber_name),
           gender = coalesce($4, gender),
           birthday = coalesce($5::date, birthday),
           phone = coalesce($6, phone),
           email_raw = coalesce(nullif($7, ''), email_raw),
           updated_at = now()
       where id = $1::uuid`,
      [
        existing.id,
        input.source ?? 'footer',
        input.subscriberName ?? null,
        input.gender ?? null,
        input.birthday ?? null,
        input.phone ?? null,
        input.emailRaw ?? email,
      ]
    )
    return { created: false, reactivated: true, skippedActive: false, email }
  }
  await pgQuery(
    `insert into public.messaging_partner_newsletter_subscribers (
       partner_id, email_normalized, email_raw, source, subscriber_name, gender, birthday, phone
     ) values ($1::uuid, $2, $3, $4, $5, $6, $7::date, $8)`,
    [
      input.partnerId,
      email,
      (input.emailRaw || email).slice(0, 180),
      (input.source || 'footer').slice(0, 40),
      input.subscriberName?.slice(0, 255) ?? null,
      input.gender?.slice(0, 20) ?? null,
      input.birthday ?? null,
      input.phone?.slice(0, 20) ?? null,
    ]
  )
  return { created: true, reactivated: false, skippedActive: false, email }
}

export async function deactivateNewsletterSubscriberFromPg(input: {
  partnerId: string
  email?: string
  emailNormalized?: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const email = (input.emailNormalized || input.email || '').trim().toLowerCase()
  if (!email) return false
  const rows = await pgQuery<{ id: string }>(
    `update public.messaging_partner_newsletter_subscribers
     set is_active = false, unsubscribed_at = now(), updated_at = now()
     where partner_id = $1::uuid and email_normalized = $2 and is_active = true
     returning id::text`,
    [input.partnerId, email]
  )
  return rows.length > 0
}

export async function listNewsletterSubscribersFromPg(input: {
  partnerId: string
  q?: string
  activeOnly?: boolean | null
  skip?: number
  limit?: number
}): Promise<{ items: PartnerNewsletterSubscriberRow[]; total: number; activeTotal: number }> {
  if (!isPgConfigured()) return { items: [], total: 0, activeTotal: 0 }
  const q = input.q?.trim().toLowerCase() || ''
  const limit = Math.max(1, Math.min(100, input.limit ?? 50))
  const skip = Math.max(0, input.skip ?? 0)
  const filters: string[] = ['partner_id = $1::uuid']
  const params: unknown[] = [input.partnerId]
  if (input.activeOnly === true) filters.push('is_active = true')
  if (input.activeOnly === false) filters.push('is_active = false')
  if (q) {
    params.push(`%${q}%`)
    filters.push(`(email_normalized ilike $${params.length} or coalesce(subscriber_name, '') ilike $${params.length})`)
  }
  const where = filters.join(' and ')
  const totalRow = await pgQueryOne<{ n: number }>(
    `select count(*)::int as n from public.messaging_partner_newsletter_subscribers where ${where}`,
    params
  )
  const activeRow = await pgQueryOne<{ n: number }>(
    `select count(*)::int as n from public.messaging_partner_newsletter_subscribers
     where partner_id = $1::uuid and is_active = true`,
    [input.partnerId]
  )
  params.push(limit, skip)
  const items = await pgQuery<PartnerNewsletterSubscriberRow>(
    `select id::text, partner_id::text, email_normalized, email_raw, subscriber_name, gender,
            birthday::text, phone, source, is_active, subscribed_at::text, unsubscribed_at::text
     from public.messaging_partner_newsletter_subscribers
     where ${where}
     order by subscribed_at desc
     limit $${params.length - 1}::int offset $${params.length}::int`,
    params
  )
  return { items, total: Number(totalRow?.n || 0), activeTotal: Number(activeRow?.n || 0) }
}

export async function listActiveNewsletterEmailsFromPg(partnerId: string, limit = 5000): Promise<string[]> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<{ email_normalized: string }>(
    `select email_normalized from public.messaging_partner_newsletter_subscribers
     where partner_id = $1::uuid and is_active = true
     order by subscribed_at asc
     limit $2::int`,
    [partnerId, Math.max(1, Math.min(20000, limit))]
  )
  return rows.map((r) => r.email_normalized).filter(Boolean)
}

export async function resolveCustomerEmailForIdentityFromPg(input: {
  partnerId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  emailNormalized?: string | null
}): Promise<{ email: string; name: string } | null> {
  if (!isPgConfigured()) return null
  const hinted = input.emailNormalized?.trim().toLowerCase() || ''
  if (hinted) {
    const named = await pgQueryOne<{ customer_name: string | null }>(
      `select customer_name from public.messaging_partner_customer_profiles
       where partner_id = $1::uuid and email_normalized = $2 limit 1`,
      [input.partnerId, hinted]
    )
    return { email: hinted, name: named?.customer_name?.trim() || '' }
  }
  if (input.guestAccountId) {
    const ga = await pgQueryOne<{ email_normalized: string; customer_name: string | null }>(
      `select ga.email_normalized, p.customer_name
       from public.messaging_guest_accounts ga
       left join public.messaging_partner_customer_profiles p
         on p.partner_id = ga.partner_id and p.email_normalized = ga.email_normalized
       where ga.partner_id = $1::uuid and ga.id = $2::uuid
       limit 1`,
      [input.partnerId, input.guestAccountId]
    )
    const em = ga?.email_normalized?.trim().toLowerCase() || ''
    if (em) return { email: em, name: ga?.customer_name?.trim() || '' }
  }
  if (input.linkedUserId) {
    const u = await pgQueryOne<{ email: string; full_name: string | null }>(
      `select lower(trim(u.email)) as email, nullif(trim(p.full_name), '') as full_name
       from auth.users u
       left join public.profiles p on p.id = u.id
       where u.id = $1::uuid
       limit 1`,
      [input.linkedUserId]
    )
    const em = u?.email?.trim().toLowerCase() || ''
    if (em) return { email: em, name: u?.full_name?.trim() || '' }
  }
  return null
}

export const ensurePartnerEmailSendSettingsFromPg = fetchPartnerEmailSendSettingsFromPg
export const getPartnerEmailManagementOverviewFromPg = buildPartnerEmailOverviewFromPg
export const updatePartnerEmailSendSettingsFromPg = updatePartnerEmailWarmupSettingsFromPg
export const listPartnerNewsletterSubscribersFromPg = listNewsletterSubscribersFromPg

export async function importNewsletterEmailsFromPg(input: {
  partnerId: string
  lines: string[]
  source?: string
}): Promise<{
  parsed: number
  created: number
  reactivated: number
  skipped_active: number
  corrected: number
  invalid: number
  duplicate_in_file: number
}> {
  const seen = new Set<string>()
  let parsed = 0
  let created = 0
  let reactivated = 0
  let skipped_active = 0
  let corrected = 0
  let invalid = 0
  let duplicate_in_file = 0
  for (const raw of input.lines) {
    const line = String(raw || '').trim()
    if (!line || line.startsWith('#') || /^email\s*[,;\t]/i.test(line)) continue
    const cell = line.split(/[,;\t]/)[0]?.trim() || ''
    if (!cell) continue
    const norm = normalizeImportedEmail(cell)
    if (!norm.email) {
      invalid += 1
      continue
    }
    parsed += 1
    if (norm.corrected) corrected += 1
    if (seen.has(norm.email)) {
      duplicate_in_file += 1
      continue
    }
    seen.add(norm.email)
    const up = await upsertNewsletterSubscriberFromPg({
      partnerId: input.partnerId,
      email: norm.email,
      emailRaw: cell,
      source: input.source || 'import',
    })
    if ('error' in up) {
      invalid += 1
      continue
    }
    if (up.created) created += 1
    else if (up.reactivated) reactivated += 1
    else skipped_active += 1
  }
  return { parsed, created, reactivated, skipped_active, corrected, invalid, duplicate_in_file }
}

