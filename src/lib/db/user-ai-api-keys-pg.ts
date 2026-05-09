import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { decryptCustomerApiKey, type EncryptedCustomerApiKey } from '@/lib/security/customer-api-key-vault'

export type UserAiApiKeyProvider = 'google_gemini'
export type UserAiApiKeyStatus = 'unchecked' | 'valid' | 'invalid'

export type UserAiApiKeyPublicRow = {
  provider: UserAiApiKeyProvider
  key_hint: string
  is_enabled: boolean
  status: UserAiApiKeyStatus
  last_checked_at: string | null
  last_error: string | null
  updated_at: string
}

type UserAiApiKeySecretRow = UserAiApiKeyPublicRow & {
  encrypted_key: string
  iv: string
  auth_tag: string
}

export async function getUserAiApiKeyPublicRow(
  userId: string,
  provider: UserAiApiKeyProvider
): Promise<UserAiApiKeyPublicRow | null> {
  if (!isPgConfigured()) return null
  return await pgQueryOne<UserAiApiKeyPublicRow>(
    `select provider, key_hint, is_enabled, status, last_checked_at::text, last_error, updated_at::text
     from public.user_ai_api_keys
     where user_id = $1::uuid and provider = $2
     limit 1`,
    [userId, provider]
  )
}

export async function getEnabledUserAiApiKeyPlaintext(
  userId: string,
  provider: UserAiApiKeyProvider
): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<UserAiApiKeySecretRow>(
    `select provider, key_hint, is_enabled, status, last_checked_at::text, last_error, updated_at::text,
            encrypted_key, iv, auth_tag
     from public.user_ai_api_keys
     where user_id = $1::uuid and provider = $2 and is_enabled = true and status = 'valid'
     limit 1`,
    [userId, provider]
  )
  if (!row) return null
  return decryptCustomerApiKey({
    encryptedKey: row.encrypted_key,
    iv: row.iv,
    authTag: row.auth_tag,
  })
}

export async function getUserAiApiKeyPlaintext(
  userId: string,
  provider: UserAiApiKeyProvider
): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<UserAiApiKeySecretRow>(
    `select provider, key_hint, is_enabled, status, last_checked_at::text, last_error, updated_at::text,
            encrypted_key, iv, auth_tag
     from public.user_ai_api_keys
     where user_id = $1::uuid and provider = $2
     limit 1`,
    [userId, provider]
  )
  if (!row) return null
  return decryptCustomerApiKey({
    encryptedKey: row.encrypted_key,
    iv: row.iv,
    authTag: row.auth_tag,
  })
}

export async function upsertUserAiApiKey(params: {
  userId: string
  provider: UserAiApiKeyProvider
  encrypted: EncryptedCustomerApiKey
  status: UserAiApiKeyStatus
  lastError?: string | null
}): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.user_ai_api_keys (
         user_id, provider, encrypted_key, iv, auth_tag, key_hint,
         is_enabled, status, last_checked_at, last_error
       )
       values ($1::uuid, $2, $3, $4, $5, $6, true, $7, now(), $8)
       on conflict (user_id, provider) do update set
         encrypted_key = excluded.encrypted_key,
         iv = excluded.iv,
         auth_tag = excluded.auth_tag,
         key_hint = excluded.key_hint,
         is_enabled = true,
         status = excluded.status,
         last_checked_at = excluded.last_checked_at,
         last_error = excluded.last_error`,
      [
        params.userId,
        params.provider,
        params.encrypted.encryptedKey,
        params.encrypted.iv,
        params.encrypted.authTag,
        params.encrypted.keyHint,
        params.status,
        params.lastError ?? null,
      ]
    )
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateUserAiApiKeyEnabled(params: {
  userId: string
  provider: UserAiApiKeyProvider
  enabled: boolean
}): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.user_ai_api_keys
       set is_enabled = $3
       where user_id = $1::uuid and provider = $2`,
      [params.userId, params.provider, params.enabled]
    )
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateUserAiApiKeyCheckStatus(params: {
  userId: string
  provider: UserAiApiKeyProvider
  status: UserAiApiKeyStatus
  lastError?: string | null
}): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.user_ai_api_keys
       set status = $3, last_checked_at = now(), last_error = $4
       where user_id = $1::uuid and provider = $2`,
      [params.userId, params.provider, params.status, params.lastError ?? null]
    )
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteUserAiApiKey(params: {
  userId: string
  provider: UserAiApiKeyProvider
}): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    const pool = getPgPool()
    await pool.query(
      `delete from public.user_ai_api_keys
       where user_id = $1::uuid and provider = $2`,
      [params.userId, params.provider]
    )
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
