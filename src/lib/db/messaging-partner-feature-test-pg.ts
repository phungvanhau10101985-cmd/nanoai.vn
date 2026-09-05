import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  birthdayPercentForFeatureTest,
  findMatchingFeatureTestRow,
  isBirthdayPromoTestActive,
  isSiteSaleTestActive,
  normalizeFeatureTestEmail,
  normalizeSiteSaleTestPhase,
  partnerFeatureTestExpiresAt,
  type PartnerFeatureTestRow,
  type PartnerSiteSaleTestPhase,
} from '@/lib/partner-website/promotions/partner-feature-test'
import {
  applyPartnerFeatureTestToSaleCalendar,
  type PartnerSaleCalendarSettings,
  type PartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'

type FeatureTestDbRow = {
  id: string
  partner_id: string
  actor_user_id: string
  test_email: string | null
  birthday_promo_enabled: boolean
  birthday_promo_expires_at: string | null
  site_sale_test_enabled: boolean
  site_sale_test_expires_at: string | null
  site_sale_test_phase: string
}

function mapRow(row: FeatureTestDbRow): PartnerFeatureTestRow {
  return {
    id: row.id,
    partnerId: row.partner_id,
    actorUserId: row.actor_user_id,
    testEmail: normalizeFeatureTestEmail(row.test_email) || null,
    birthdayPromoEnabled: row.birthday_promo_enabled === true,
    birthdayPromoExpiresAt: row.birthday_promo_expires_at,
    siteSaleTestEnabled: row.site_sale_test_enabled === true,
    siteSaleTestExpiresAt: row.site_sale_test_expires_at,
    siteSaleTestPhase: normalizeSiteSaleTestPhase(row.site_sale_test_phase),
  }
}

const SELECT_COLS = `
  id::text,
  partner_id::text,
  actor_user_id::text,
  test_email,
  coalesce(birthday_promo_enabled, false) as birthday_promo_enabled,
  birthday_promo_expires_at::text,
  coalesce(site_sale_test_enabled, false) as site_sale_test_enabled,
  site_sale_test_expires_at::text,
  coalesce(site_sale_test_phase, 'active') as site_sale_test_phase
`

export async function fetchPartnerFeatureTestSettingsFromPg(input: {
  partnerId: string
  actorUserId: string
}): Promise<PartnerFeatureTestRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<FeatureTestDbRow>(
      `select ${SELECT_COLS}
       from public.messaging_partner_feature_test_settings
       where partner_id = $1::uuid and actor_user_id = $2::uuid
       limit 1`,
      [input.partnerId, input.actorUserId]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerFeatureTestSettingsFromPg]', e)
    return null
  }
}

export async function listActivePartnerFeatureTestsFromPg(
  partnerId: string
): Promise<PartnerFeatureTestRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<FeatureTestDbRow>(
      `select ${SELECT_COLS}
       from public.messaging_partner_feature_test_settings
       where partner_id = $1::uuid
         and (
           (birthday_promo_enabled = true and birthday_promo_expires_at is not null and birthday_promo_expires_at > now())
           or (site_sale_test_enabled = true and site_sale_test_expires_at is not null and site_sale_test_expires_at > now())
         )`,
      [partnerId]
    )
    return rows.map(mapRow)
  } catch (e) {
    console.warn('[listActivePartnerFeatureTestsFromPg]', e)
    return []
  }
}

export async function upsertPartnerBirthdayFeatureTestFromPg(input: {
  partnerId: string
  actorUserId: string
  enabled: boolean
  testEmail: string | null
}): Promise<PartnerFeatureTestRow | null> {
  return upsertPartnerFeatureTestFromPg({
    partnerId: input.partnerId,
    actorUserId: input.actorUserId,
    testEmail: input.testEmail,
    birthdayPromoEnabled: input.enabled,
    siteSaleTestEnabled: undefined,
    siteSaleTestPhase: undefined,
  })
}

export async function upsertPartnerSiteSaleFeatureTestFromPg(input: {
  partnerId: string
  actorUserId: string
  enabled: boolean
  phase: PartnerSiteSaleTestPhase
  testEmail: string | null
}): Promise<PartnerFeatureTestRow | null> {
  return upsertPartnerFeatureTestFromPg({
    partnerId: input.partnerId,
    actorUserId: input.actorUserId,
    testEmail: input.testEmail,
    birthdayPromoEnabled: undefined,
    siteSaleTestEnabled: input.enabled,
    siteSaleTestPhase: input.phase,
  })
}

async function upsertPartnerFeatureTestFromPg(input: {
  partnerId: string
  actorUserId: string
  testEmail: string | null
  birthdayPromoEnabled?: boolean
  siteSaleTestEnabled?: boolean
  siteSaleTestPhase?: PartnerSiteSaleTestPhase
}): Promise<PartnerFeatureTestRow | null> {
  if (!isPgConfigured()) return null
  const email = normalizeFeatureTestEmail(input.testEmail)
  const now = new Date()
  const birthdayEnabled = input.birthdayPromoEnabled
  const siteSaleEnabled = input.siteSaleTestEnabled
  const phase = normalizeSiteSaleTestPhase(input.siteSaleTestPhase)
  try {
    const pool = getPgPool()
    const r = await pool.query<FeatureTestDbRow>(
      `insert into public.messaging_partner_feature_test_settings (
        partner_id, actor_user_id, test_email,
        birthday_promo_enabled, birthday_promo_expires_at,
        site_sale_test_enabled, site_sale_test_expires_at, site_sale_test_phase,
        updated_at
      ) values (
        $1::uuid, $2::uuid, $3,
        coalesce($4, false), $5::timestamptz,
        coalesce($6, false), $7::timestamptz, $8,
        now()
      )
      on conflict (partner_id, actor_user_id) do update set
        test_email = excluded.test_email,
        birthday_promo_enabled = coalesce($4, messaging_partner_feature_test_settings.birthday_promo_enabled),
        birthday_promo_expires_at = case
          when $4 is null then messaging_partner_feature_test_settings.birthday_promo_expires_at
          else excluded.birthday_promo_expires_at
        end,
        site_sale_test_enabled = coalesce($6, messaging_partner_feature_test_settings.site_sale_test_enabled),
        site_sale_test_expires_at = case
          when $6 is null then messaging_partner_feature_test_settings.site_sale_test_expires_at
          else excluded.site_sale_test_expires_at
        end,
        site_sale_test_phase = case
          when $6 is null then messaging_partner_feature_test_settings.site_sale_test_phase
          else excluded.site_sale_test_phase
        end,
        updated_at = now()
      returning ${SELECT_COLS}`,
      [
        input.partnerId,
        input.actorUserId,
        email || null,
        birthdayEnabled ?? null,
        birthdayEnabled == null ? null : partnerFeatureTestExpiresAt(birthdayEnabled, now),
        siteSaleEnabled ?? null,
        siteSaleEnabled == null ? null : partnerFeatureTestExpiresAt(siteSaleEnabled, now),
        phase,
      ]
    )
    const row = r.rows[0]
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[upsertPartnerFeatureTestFromPg]', e)
    return null
  }
}

export async function resolvePartnerBirthdayFeatureTestPercentFromPg(input: {
  partnerId: string
  visitorEmail?: string | null
  configuredPercent?: number | null
}): Promise<number | null> {
  const email = normalizeFeatureTestEmail(input.visitorEmail)
  if (!email) return null
  const rows = await listActivePartnerFeatureTestsFromPg(input.partnerId)
  const match = findMatchingFeatureTestRow(
    rows.filter((row) => isBirthdayPromoTestActive(row)),
    email
  )
  if (!match) return null
  return birthdayPercentForFeatureTest(input.configuredPercent)
}

export async function resolvePartnerStorefrontSaleCalendarFromPg(input: {
  partnerId: string
  visitorEmail?: string | null
  settings?: PartnerSaleCalendarSettings | null
  at?: Date
}): Promise<PartnerSaleCalendarState> {
  const [config, rows] = await Promise.all([
    input.settings
      ? Promise.resolve(input.settings)
      : fetchPartnerSaleCalendarConfigFromPg(input.partnerId),
    listActivePartnerFeatureTestsFromPg(input.partnerId),
  ])
  const match = findMatchingFeatureTestRow(
    rows.filter((row) => isSiteSaleTestActive(row)),
    input.visitorEmail
  )
  return applyPartnerFeatureTestToSaleCalendar({
    settings: config,
    testPhase: match?.siteSaleTestPhase ?? null,
    at: input.at,
  })
}
