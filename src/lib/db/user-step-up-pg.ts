import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  hashStepUpOtp,
  normalizeStepUpOtp,
  STEP_UP_OTP_TTL_MINUTES,
  STEP_UP_SESSION_TTL_MINUTES,
  stepUpCooldownSeconds,
  type StepUpScope,
} from '@/lib/auth/step-up-otp'

const UUID_SQL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function safeUuid(id: unknown): string | null {
  const s = typeof id === 'string' ? id.trim() : String(id ?? '').trim()
  if (!s || !UUID_SQL.test(s)) return null
  return s
}

export async function isStepUpOtpCooldownActiveFromPg(userId: string, scope: StepUpScope): Promise<boolean> {
  if (!isPgConfigured()) return false
  const uid = safeUuid(userId)
  if (!uid) return false
  const cooldownSec = stepUpCooldownSeconds()
  if (cooldownSec <= 0) return false
  try {
    const row = await pgQueryOne<{ ok: boolean }>(
      `select exists(
         select 1 from public.user_step_up_otps
         where user_id = $1::uuid
           and scope = $2
           and created_at > now() - ($3::int * interval '1 second')
       ) as ok`,
      [uid, scope, cooldownSec]
    )
    return row?.ok === true
  } catch (e) {
    console.warn('[isStepUpOtpCooldownActiveFromPg]', e)
    return false
  }
}

export async function replaceStepUpOtpFromPg(params: {
  userId: string
  scope: StepUpScope
  otpHash: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const uid = safeUuid(params.userId)
  if (!uid) return false
  const expiresAt = new Date(Date.now() + STEP_UP_OTP_TTL_MINUTES * 60 * 1000).toISOString()
  try {
    await pgQuery(
      `delete from public.user_step_up_otps where user_id = $1::uuid and scope = $2`,
      [uid, params.scope]
    )
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.user_step_up_otps (user_id, scope, otp_hash, expires_at)
       values ($1::uuid, $2, $3, $4::timestamptz)
       returning id::text`,
      [uid, params.scope, params.otpHash, expiresAt]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[replaceStepUpOtpFromPg]', e)
    return false
  }
}

export async function clearStepUpOtpFromPg(userId: string, scope: StepUpScope): Promise<void> {
  if (!isPgConfigured()) return
  const uid = safeUuid(userId)
  if (!uid) return
  try {
    await pgQuery(`delete from public.user_step_up_otps where user_id = $1::uuid and scope = $2`, [uid, scope])
  } catch (e) {
    console.warn('[clearStepUpOtpFromPg]', e)
  }
}

export async function verifyStepUpOtpAndCreateSessionFromPg(params: {
  userId: string
  scope: StepUpScope
  otpRaw: string
}): Promise<{ expiresAt: string } | null> {
  if (!isPgConfigured()) return null
  const uid = safeUuid(params.userId)
  if (!uid) return null
  const otp = normalizeStepUpOtp(params.otpRaw)
  if (!otp) return null
  const tryHash = hashStepUpOtp(uid, params.scope, otp)
  const sessionExpiresAt = new Date(Date.now() + STEP_UP_SESSION_TTL_MINUTES * 60 * 1000).toISOString()
  try {
    const row = await pgQueryOne<{ expires_at: string }>(
      `with del as (
         delete from public.user_step_up_otps o
         where o.user_id = $1::uuid
           and o.scope = $2
           and o.expires_at > now()
           and o.otp_hash = $3
         returning o.id
       )
       insert into public.user_step_up_sessions (user_id, scope, verified_at, expires_at)
       select $1::uuid, $2, now(), $4::timestamptz
       from del
       on conflict (user_id, scope) do update
         set verified_at = excluded.verified_at,
             expires_at = excluded.expires_at
       returning expires_at::text`,
      [uid, params.scope, tryHash, sessionExpiresAt]
    )
    if (!row?.expires_at) return null
    return { expiresAt: row.expires_at }
  } catch (e) {
    console.warn('[verifyStepUpOtpAndCreateSessionFromPg]', e)
    return null
  }
}

export async function hasActiveStepUpSessionFromPg(userId: string, scope: StepUpScope): Promise<boolean> {
  if (!isPgConfigured()) return false
  const uid = safeUuid(userId)
  if (!uid) return false
  try {
    const row = await pgQueryOne<{ ok: boolean }>(
      `select exists(
         select 1 from public.user_step_up_sessions
         where user_id = $1::uuid
           and scope = $2
           and expires_at > now()
       ) as ok`,
      [uid, scope]
    )
    return row?.ok === true
  } catch (e) {
    console.warn('[hasActiveStepUpSessionFromPg]', e)
    return false
  }
}

export async function fetchActiveStepUpSessionFromPg(
  userId: string,
  scope: StepUpScope
): Promise<{ expiresAt: string } | null> {
  if (!isPgConfigured()) return null
  const uid = safeUuid(userId)
  if (!uid) return null
  try {
    const row = await pgQueryOne<{ expires_at: string }>(
      `select expires_at::text
       from public.user_step_up_sessions
       where user_id = $1::uuid
         and scope = $2
         and expires_at > now()
       limit 1`,
      [uid, scope]
    )
    if (!row?.expires_at) return null
    return { expiresAt: row.expires_at }
  } catch (e) {
    console.warn('[fetchActiveStepUpSessionFromPg]', e)
    return null
  }
}
