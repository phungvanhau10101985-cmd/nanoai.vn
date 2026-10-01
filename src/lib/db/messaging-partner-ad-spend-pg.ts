import { sqlPartnerMpActorHasPerm } from '@/lib/db/messaging-partner-access-sql'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  facebookConfigured,
  googleConfigured,
  metaGraphApiVersion,
  googleAdsApiVersion,
  normalizeAdAccountId,
  normalizeCustomerId,
  type AdSpendCredentials,
} from '@/lib/messaging/ad-spend/partner-ad-spend'

export type PartnerAdSpendSettingsView = {
  googleCustomerId: string
  googleLoginCustomerId: string
  googleDeveloperTokenSet: boolean
  googleClientIdSet: boolean
  googleClientSecretSet: boolean
  googleRefreshTokenSet: boolean
  googleConfigured: boolean
  metaAdAccountId: string
  metaAccessTokenSet: boolean
  facebookConfigured: boolean
  googleAdsApiVersion: string
  metaGraphApiVersion: string
}

type SecretRow = {
  google_developer_token: string | null
  google_client_id: string | null
  google_client_secret: string | null
  google_refresh_token: string | null
  google_customer_id: string | null
  google_login_customer_id: string | null
  meta_access_token: string | null
  meta_ad_account_id: string | null
}

function blankCreds(): AdSpendCredentials {
  return {
    googleDeveloperToken: '',
    googleClientId: '',
    googleClientSecret: '',
    googleRefreshToken: '',
    googleCustomerId: '',
    googleLoginCustomerId: '',
    metaAccessToken: '',
    metaAdAccountId: '',
  }
}

function credsFromRow(row: SecretRow | null): AdSpendCredentials {
  if (!row) return blankCreds()
  return {
    googleDeveloperToken: String(row.google_developer_token ?? '').trim(),
    googleClientId: String(row.google_client_id ?? '').trim(),
    googleClientSecret: String(row.google_client_secret ?? '').trim(),
    googleRefreshToken: String(row.google_refresh_token ?? '').trim(),
    googleCustomerId: normalizeCustomerId(row.google_customer_id),
    googleLoginCustomerId: normalizeCustomerId(row.google_login_customer_id),
    metaAccessToken: String(row.meta_access_token ?? '').trim(),
    metaAdAccountId: normalizeAdAccountId(row.meta_ad_account_id),
  }
}

export function adSpendSettingsView(creds: AdSpendCredentials): PartnerAdSpendSettingsView {
  return {
    googleCustomerId: creds.googleCustomerId,
    googleLoginCustomerId: creds.googleLoginCustomerId,
    googleDeveloperTokenSet: Boolean(creds.googleDeveloperToken),
    googleClientIdSet: Boolean(creds.googleClientId),
    googleClientSecretSet: Boolean(creds.googleClientSecret),
    googleRefreshTokenSet: Boolean(creds.googleRefreshToken),
    googleConfigured: googleConfigured(creds),
    metaAdAccountId: creds.metaAdAccountId,
    metaAccessTokenSet: Boolean(creds.metaAccessToken),
    facebookConfigured: facebookConfigured(creds),
    googleAdsApiVersion: googleAdsApiVersion(),
    metaGraphApiVersion: metaGraphApiVersion(),
  }
}

async function partnerOrdersAllowed(ownerUserId: string, partnerId: string): Promise<boolean> {
  const row = await pgQueryOne(
    `select mp.id::text as id
     from public.messaging_partners mp
     where mp.id = $2::uuid
       and ${sqlPartnerMpActorHasPerm(1, 'orders')}
     limit 1`,
    [ownerUserId, partnerId],
  )
  return Boolean(row)
}

async function loadSecretRow(partnerId: string): Promise<SecretRow | null> {
  return pgQueryOne<SecretRow>(
    `select google_developer_token, google_client_id, google_client_secret, google_refresh_token,
            google_customer_id, google_login_customer_id, meta_access_token, meta_ad_account_id
     from public.messaging_partner_ad_spend
     where partner_id = $1::uuid`,
    [partnerId],
  )
}

export async function loadPartnerAdSpendSettingsFromPg(input: {
  ownerUserId: string
  partnerId: string
}): Promise<PartnerAdSpendSettingsView | null> {
  if (!(await partnerOrdersAllowed(input.ownerUserId, input.partnerId))) return null
  return adSpendSettingsView(credsFromRow(await loadSecretRow(input.partnerId)))
}

export async function loadPartnerAdSpendCredentialsFromPg(input: {
  ownerUserId: string
  partnerId: string
}): Promise<AdSpendCredentials | null> {
  if (!(await partnerOrdersAllowed(input.ownerUserId, input.partnerId))) return null
  return credsFromRow(await loadSecretRow(input.partnerId))
}

export async function savePartnerAdSpendSettingsFromPg(input: {
  ownerUserId: string
  partnerId: string
  googleCustomerId: string
  googleLoginCustomerId: string
  metaAdAccountId: string
  googleDeveloperToken?: string
  googleClientId?: string
  googleClientSecret?: string
  googleRefreshToken?: string
  metaAccessToken?: string
  clearGoogleSecrets?: boolean
  clearMetaSecrets?: boolean
}): Promise<PartnerAdSpendSettingsView | null> {
  if (!(await partnerOrdersAllowed(input.ownerUserId, input.partnerId))) return null
  const current = credsFromRow(await loadSecretRow(input.partnerId))
  const next: AdSpendCredentials = {
    ...current,
    googleCustomerId: normalizeCustomerId(input.googleCustomerId),
    googleLoginCustomerId: normalizeCustomerId(input.googleLoginCustomerId),
    metaAdAccountId: normalizeAdAccountId(input.metaAdAccountId),
  }
  if (input.clearGoogleSecrets) {
    next.googleDeveloperToken = ''
    next.googleClientId = ''
    next.googleClientSecret = ''
    next.googleRefreshToken = ''
  }
  if (input.clearMetaSecrets) next.metaAccessToken = ''
  const keep = (raw: string | undefined, previous: string) => {
    const text = String(raw ?? '').trim()
    return text || previous
  }
  next.googleDeveloperToken = keep(input.googleDeveloperToken, next.googleDeveloperToken)
  next.googleClientId = keep(input.googleClientId, next.googleClientId)
  next.googleClientSecret = keep(input.googleClientSecret, next.googleClientSecret)
  next.googleRefreshToken = keep(input.googleRefreshToken, next.googleRefreshToken)
  next.metaAccessToken = keep(input.metaAccessToken, next.metaAccessToken)

  await pgQuery(
    `insert into public.messaging_partner_ad_spend (
       partner_id, google_developer_token, google_client_id, google_client_secret, google_refresh_token,
       google_customer_id, google_login_customer_id, meta_access_token, meta_ad_account_id, updated_at
     ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, now())
     on conflict (partner_id) do update set
       google_developer_token = excluded.google_developer_token,
       google_client_id = excluded.google_client_id,
       google_client_secret = excluded.google_client_secret,
       google_refresh_token = excluded.google_refresh_token,
       google_customer_id = excluded.google_customer_id,
       google_login_customer_id = excluded.google_login_customer_id,
       meta_access_token = excluded.meta_access_token,
       meta_ad_account_id = excluded.meta_ad_account_id,
       updated_at = now()`,
    [
      input.partnerId,
      next.googleDeveloperToken || null,
      next.googleClientId || null,
      next.googleClientSecret || null,
      next.googleRefreshToken || null,
      next.googleCustomerId || null,
      next.googleLoginCustomerId || null,
      next.metaAccessToken || null,
      next.metaAdAccountId || null,
    ],
  )
  return adSpendSettingsView(next)
}
