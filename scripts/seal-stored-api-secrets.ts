/**
 * Niêm secret đang plaintext trong Postgres.
 * Chạy SAU khi process đang phục vụ DB đó đã có code đọc được blob nai1.
 *
 *   npx tsx scripts/seal-stored-api-secrets.ts
 *
 * Host không phải localhost thì cần SEAL_REMOTE_OK=1.
 * Script chỉ in số dòng, không in giá trị secret.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import type { Pool } from 'pg'
import { decryptCustomerApiKey, encryptCustomerApiKey } from '../src/lib/security/customer-api-key-vault'
import {
  isSealedSecret,
  resealNullableSecret,
  resealSecret,
  vaultMasterConfigured,
  type SecretPurpose,
} from '../src/lib/security/secret-vault'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

type SealJob = {
  label: string
  sql: string
  idCast: string
  purpose: SecretPurpose
  maxLen?: number
  nullable: boolean
}

const JOBS: SealJob[] = [
  {
    label: 'payment.sepay_webhook_token',
    sql: `select partner_id::text as id, sepay_webhook_token as secret
          from public.messaging_partner_payment_settings`,
    idCast: 'uuid',
    purpose: 'sepay-shop-token',
    maxLen: 120,
    nullable: false,
  },
  {
    label: 'payment.sepay_secret_key',
    sql: `select partner_id::text as id, sepay_secret_key as secret
          from public.messaging_partner_payment_settings`,
    idCast: 'uuid',
    purpose: 'sepay-shop-hmac',
    maxLen: 256,
    nullable: false,
  },
  {
    label: 'sepay_webhook_settings.hmac_secret',
    sql: `select id::text as id, hmac_secret as secret from public.sepay_webhook_settings`,
    idCast: 'int',
    purpose: 'sepay-platform-hmac',
    maxLen: 256,
    nullable: true,
  },
  {
    label: 'google_sheets.service_account_json',
    sql: `select partner_id::text as id, service_account_json as secret
          from public.messaging_partner_google_sheets_settings`,
    idCast: 'uuid',
    purpose: 'gsheets-sa',
    nullable: true,
  },
  {
    label: 'ad_spend.google_developer_token',
    sql: `select partner_id::text as id, google_developer_token as secret
          from public.messaging_partner_ad_spend`,
    idCast: 'uuid',
    purpose: 'ad-google-dev-token',
    nullable: true,
  },
  {
    label: 'ad_spend.google_client_secret',
    sql: `select partner_id::text as id, google_client_secret as secret
          from public.messaging_partner_ad_spend`,
    idCast: 'uuid',
    purpose: 'ad-google-client-secret',
    nullable: true,
  },
  {
    label: 'ad_spend.google_refresh_token',
    sql: `select partner_id::text as id, google_refresh_token as secret
          from public.messaging_partner_ad_spend`,
    idCast: 'uuid',
    purpose: 'ad-google-refresh',
    nullable: true,
  },
  {
    label: 'ad_spend.google_service_account_json',
    sql: `select partner_id::text as id, google_service_account_json as secret
          from public.messaging_partner_ad_spend`,
    idCast: 'uuid',
    purpose: 'ad-google-sa',
    nullable: true,
  },
  {
    label: 'ad_spend.meta_access_token',
    sql: `select partner_id::text as id, meta_access_token as secret
          from public.messaging_partner_ad_spend`,
    idCast: 'uuid',
    purpose: 'ad-meta-token',
    nullable: true,
  },
  {
    label: 'ai.image_search_api_secret',
    sql: `select partner_id::text as id, image_search_api_secret as secret
          from public.messaging_partner_ai_settings`,
    idCast: 'uuid',
    purpose: 'image-search',
    nullable: true,
  },
  {
    label: 'ai.shipping_lookup_api_key',
    sql: `select partner_id::text as id, shipping_lookup_api_key as secret
          from public.messaging_partner_ai_settings`,
    idCast: 'uuid',
    purpose: 'shipping-lookup',
    maxLen: 512,
    nullable: true,
  },
  {
    label: 'channels.page_access_token',
    sql: `select id::text as id, page_access_token as secret from public.messaging_partner_channels`,
    idCast: 'uuid',
    purpose: 'fb-page-token',
    nullable: true,
  },
  {
    label: 'channels.webhook_verify_token',
    sql: `select id::text as id, webhook_verify_token as secret from public.messaging_partner_channels`,
    idCast: 'uuid',
    purpose: 'fb-verify',
    nullable: true,
  },
  {
    label: 'channels.zalo_access_token',
    sql: `select id::text as id, zalo_access_token as secret from public.messaging_partner_channels`,
    idCast: 'uuid',
    purpose: 'zalo-access',
    nullable: true,
  },
  {
    label: 'channels.zalo_webhook_secret',
    sql: `select id::text as id, zalo_webhook_secret as secret from public.messaging_partner_channels`,
    idCast: 'uuid',
    purpose: 'zalo-webhook',
    nullable: true,
  },
  {
    label: 'outbound.webhook_secret',
    sql: `select partner_id::text as id, webhook_secret as secret
          from public.messaging_partner_outbound_webhooks`,
    idCast: 'uuid',
    purpose: 'outbound-webhook',
    maxLen: 256,
    nullable: true,
  },
]

function dbHost(): string {
  const raw = process.env.DATABASE_URL?.trim() || ''
  try {
    return new URL(raw).hostname
  } catch {
    return ''
  }
}

function columnOf(job: SealJob): string {
  const match = / ([a-z_]+) as secret/.exec(job.sql)
  const column = match?.[1] || ''
  if (!/^[a-z_]+$/.test(column)) throw new Error(`Bad column for ${job.label}`)
  return column
}

function updateSqlExact(job: SealJob): string {
  const table = job.sql.split(' from ')[1]?.trim().split(/\s+/)[0]
  if (!table) throw new Error(`Bad table for ${job.label}`)
  const column = columnOf(job)
  if (job.idCast === 'int') return `update ${table} set ${column} = $2 where id = $1::int`
  if (job.sql.includes('id::text as id')) return `update ${table} set ${column} = $2 where id = $1::uuid`
  return `update ${table} set ${column} = $2 where partner_id = $1::uuid`
}

async function sealJob(pool: Pool, job: SealJob): Promise<void> {
  const { rows } = await pool.query<{ id: string; secret: string | null }>(job.sql)
  let updated = 0
  let skipped = 0
  let failed = 0
  for (const row of rows) {
    const current = row.secret == null ? '' : String(row.secret)
    if (!current.trim() || isSealedSecret(current)) {
      skipped += 1
      continue
    }
    try {
      const next = job.nullable
        ? resealNullableSecret(current, job.purpose, job.maxLen)
        : resealSecret(current, job.purpose, job.maxLen)
      if (!next || next === current) {
        skipped += 1
        continue
      }
      await pool.query(updateSqlExact(job), [row.id, next])
      updated += 1
    } catch {
      failed += 1
    }
  }
  console.log(`[seal] ${job.label}: updated=${updated} skipped=${skipped} failed=${failed}`)
}

async function sealCustomerKeys(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{
    user_id: string
    provider: string
    encrypted_key: string
    iv: string
    auth_tag: string
  }>(
    `select user_id::text, provider, encrypted_key, iv, auth_tag
     from public.user_ai_api_keys`
  )
  let updated = 0
  let skipped = 0
  let failed = 0
  for (const row of rows) {
    if (isSealedSecret(row.encrypted_key)) {
      skipped += 1
      continue
    }
    try {
      const plain = decryptCustomerApiKey({
        encryptedKey: row.encrypted_key,
        iv: row.iv,
        authTag: row.auth_tag,
      })
      const next = encryptCustomerApiKey(plain)
      await pool.query(
        `update public.user_ai_api_keys
         set encrypted_key = $3, iv = $4, auth_tag = $5
         where user_id = $1::uuid and provider = $2`,
        [row.user_id, row.provider, next.encryptedKey, next.iv, next.authTag]
      )
      updated += 1
    } catch {
      failed += 1
    }
  }
  console.log(`[seal] user_ai_api_keys: updated=${updated} skipped=${skipped} failed=${failed}`)
}

async function main(): Promise<void> {
  if (!vaultMasterConfigured()) {
    console.error('[seal] Thiếu CUSTOMER_API_KEY_ENCRYPTION_SECRET (≥ 32 ký tự).')
    process.exit(1)
  }
  const host = dbHost()
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  if (!local && process.env.SEAL_REMOTE_OK !== '1') {
    console.error(
      `[seal] Từ chối host ${host || '(không đọc được)'}. Chỉ đặt SEAL_REMOTE_OK=1 sau khi server đó đã chạy code đọc được blob nai1.`
    )
    process.exit(1)
  }
  const { getPgPool } = await import('../src/lib/db/pool')
  const pool = getPgPool()
  for (const job of JOBS) {
    try {
      await sealJob(pool, job)
    } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code || '') : ''
      if (code === '42P01' || code === '42703') {
        console.log(`[seal] ${job.label}: bỏ qua (${code})`)
        continue
      }
      console.error(`[seal] ${job.label}: lỗi truy vấn`)
      process.exitCode = 1
    }
  }
  try {
    await sealCustomerKeys(pool)
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code || '') : ''
    if (code === '42P01') console.log('[seal] user_ai_api_keys: bỏ qua (42P01)')
    else {
      console.error('[seal] user_ai_api_keys: lỗi truy vấn')
      process.exitCode = 1
    }
  }
  await pool.end()
}

void main()
