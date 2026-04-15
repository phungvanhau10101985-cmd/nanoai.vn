import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export async function findGuestAccountIdByEmailPg(
  partnerId: string,
  emailNormalized: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ id: string }>(
    `select id::text as id from public.messaging_guest_accounts
     where partner_id = $1::uuid and email_normalized = $2
     limit 1`,
    [partnerId, emailNormalized]
  )
  return row?.id ?? null
}

export async function fetchGuestAccountEmailByIdPg(
  partnerId: string,
  guestAccountId: string
): Promise<{ emailNormalized: string; emailRaw: string } | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ email_normalized: string; email_raw: string }>(
    `select email_normalized, email_raw
     from public.messaging_guest_accounts
     where partner_id = $1::uuid and id = $2::uuid
     limit 1`,
    [partnerId, guestAccountId]
  )
  if (!row) return null
  return {
    emailNormalized: String(row.email_normalized ?? '').trim().toLowerCase(),
    emailRaw: String(row.email_raw ?? '').trim(),
  }
}

export async function listGuestChallengeSessionIdsByEmailPg(
  partnerId: string,
  emailNormalized: string,
  limit = 200
): Promise<string[]> {
  if (!isPgConfigured()) return []
  const safeLimit = Math.max(20, Math.min(500, Math.floor(limit)))
  try {
    const rows = await getPgPool().query<{ session_id: string }>(
      `select distinct session_id
       from public.messaging_guest_email_challenges
       where partner_id = $1::uuid and email_normalized = $2
       order by session_id asc
       limit $3::int`,
      [partnerId, emailNormalized, safeLimit]
    )
    return rows.rows.map((r) => String(r.session_id ?? '').trim()).filter(Boolean)
  } catch (e) {
    console.error('[messaging-guest-pg] listGuestChallengeSessionIdsByEmailPg', e)
    return []
  }
}

export async function insertGuestAccountPg(params: {
  partnerId: string
  emailRaw: string
  emailNormalized: string
  firstVerifiedAt: string
  lastLoginAt: string
}): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ id: string }>(
    `insert into public.messaging_guest_accounts (
       partner_id, email_raw, email_normalized, first_verified_at, last_login_at
     ) values ($1::uuid, $2, $3, $4::timestamptz, $5::timestamptz)
     returning id::text as id`,
    [params.partnerId, params.emailRaw, params.emailNormalized, params.firstVerifiedAt, params.lastLoginAt]
  )
  return row?.id ?? null
}

export async function updateGuestAccountLastLoginPg(accountId: string, lastLoginAt: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `update public.messaging_guest_accounts set last_login_at = $1::timestamptz, updated_at = now() where id = $2::uuid`,
      [lastLoginAt, accountId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[messaging-guest-pg] updateGuestAccountLastLoginPg', e)
    return false
  }
}

export async function upsertGuestIdentityPg(params: {
  partnerId: string
  guestAccountId: string
  provider: 'google' | 'email_otp'
  providerSubject: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `insert into public.messaging_guest_identities (
         partner_id, guest_account_id, provider, provider_subject, created_at, updated_at
       ) values ($1::uuid, $2::uuid, $3, $4, now(), now())
       on conflict (partner_id, provider, provider_subject)
       do update set guest_account_id = excluded.guest_account_id, updated_at = now()`,
      [params.partnerId, params.guestAccountId, params.provider, params.providerSubject]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[messaging-guest-pg] upsertGuestIdentityPg', e)
    return false
  }
}

export async function findLatestEmailChallengeInCooldownPg(
  partnerId: string,
  emailNormalized: string,
  cooldownAfterIso: string
): Promise<{ id: string; created_at: string } | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne(
    `select id::text as id, created_at
     from public.messaging_guest_email_challenges
     where partner_id = $1::uuid and email_normalized = $2 and created_at > $3::timestamptz
     order by created_at desc
     limit 1`,
    [partnerId, emailNormalized, cooldownAfterIso]
  )
}

export async function insertGuestEmailChallengePg(params: {
  partnerId: string
  emailNormalized: string
  sessionId: string
  codeHash: string
  magicTokenHash: string
  expiresAt: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `insert into public.messaging_guest_email_challenges (
         partner_id, email_normalized, session_id, code_hash, magic_token_hash,
         expires_at, attempt_count
       ) values ($1::uuid, $2, $3, $4, $5, $6::timestamptz, 0)`,
      [
        params.partnerId,
        params.emailNormalized,
        params.sessionId,
        params.codeHash,
        params.magicTokenHash,
        params.expiresAt,
      ]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[messaging-guest-pg] insertGuestEmailChallengePg', e)
    return false
  }
}

export async function findActiveOtpChallengePg(
  partnerId: string,
  emailNormalized: string,
  sessionId: string
): Promise<{
  id: string
  code_hash: string
  expires_at: string
  attempt_count: number
  consumed_at: string | null
} | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<Record<string, unknown>>(
    `select id::text as id, code_hash, expires_at, attempt_count, consumed_at
     from public.messaging_guest_email_challenges
     where partner_id = $1::uuid and email_normalized = $2 and session_id = $3
       and consumed_at is null
     order by created_at desc
     limit 1`,
    [partnerId, emailNormalized, sessionId]
  )
  if (!row) return null
  return {
    id: String(row.id),
    code_hash: String(row.code_hash ?? ''),
    expires_at: String(row.expires_at ?? ''),
    attempt_count: Number(row.attempt_count ?? 0),
    consumed_at: row.consumed_at != null ? String(row.consumed_at) : null,
  }
}

export async function incrementOtpChallengeAttemptsPg(challengeId: string, nextCount: number): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `update public.messaging_guest_email_challenges set attempt_count = $1, updated_at = now() where id = $2::uuid`,
      [nextCount, challengeId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[messaging-guest-pg] incrementOtpChallengeAttemptsPg', e)
    return false
  }
}

export async function consumeEmailChallengePg(challengeId: string, consumedAtIso: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `update public.messaging_guest_email_challenges
       set consumed_at = $1::timestamptz, updated_at = now()
       where id = $2::uuid and consumed_at is null`,
      [consumedAtIso, challengeId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[messaging-guest-pg] consumeEmailChallengePg', e)
    return false
  }
}

export async function findMagicLinkChallengePg(
  partnerId: string,
  emailNormalized: string,
  sessionId: string,
  magicTokenHash: string
): Promise<{ id: string; expires_at: string; consumed_at: string | null } | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<Record<string, unknown>>(
    `select id::text as id, expires_at, consumed_at
     from public.messaging_guest_email_challenges
     where partner_id = $1::uuid and email_normalized = $2 and session_id = $3
       and magic_token_hash = $4 and consumed_at is null
     order by created_at desc
     limit 1`,
    [partnerId, emailNormalized, sessionId, magicTokenHash]
  )
  if (!row) return null
  return {
    id: String(row.id),
    expires_at: String(row.expires_at ?? ''),
    consumed_at: row.consumed_at != null ? String(row.consumed_at) : null,
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Đơn neo `guest_account` (sau merge phiên) + khách PATCH bằng session Google:
 * cùng email `messaging_guest_accounts` ↔ `auth.users` → vẫn là chủ đơn.
 */
export async function guestAccountEmailMatchesAuthUserFromPg(
  partnerId: string,
  guestAccountId: string,
  linkedUserId: string
): Promise<boolean> {
  const authEmail = (await getAuthUserEmailFromPg(linkedUserId))?.trim().toLowerCase()
  if (!authEmail) return false
  const aid = guestAccountId.trim()
  const pid = partnerId.trim()
  if (!aid || !pid || !UUID_RE.test(aid)) return false
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.messaging_guest_accounts
       where partner_id = $1::uuid and id = $2::uuid
         and email_normalized = $3
       limit 1`,
      [pid, aid, authEmail]
    )
    return row != null
  } catch (e) {
    console.warn('[messaging-guest-pg] guestAccountEmailMatchesAuthUserFromPg', e)
    return false
  }
}
