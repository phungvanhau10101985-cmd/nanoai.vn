import { createHash, randomInt } from 'node:crypto'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const UUID_SQL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const OTP_TTL_MINUTES = 10

function safeUuid(id: unknown): string | null {
  const s = typeof id === 'string' ? id.trim() : String(id ?? '').trim()
  if (!s || !UUID_SQL.test(s)) return null
  return s
}

export function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

export function hashAdminDeleteUserOtp(adminUserId: string, targetUserId: string, otp: string): string {
  const o = otp.replace(/\D/g, '').trim()
  return sha256hex(`admin_delete_user_otp:${adminUserId}:${targetUserId}:${o}`)
}

export function generateAdminDeleteUserOtp6(): string {
  return String(randomInt(100000, 1000000))
}

export async function isAdminDeleteUserOtpCooldownActiveFromPg(
  adminUserId: string,
  targetUserId: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const adminId = safeUuid(adminUserId)
  const targetId = safeUuid(targetUserId)
  if (!adminId || !targetId) return false
  const cooldownSec = Math.min(
    600,
    Math.max(0, parseInt(process.env.ADMIN_DELETE_USER_OTP_COOLDOWN_SECONDS || '90', 10) || 90)
  )
  if (cooldownSec <= 0) return false
  try {
    const row = await pgQueryOne<{ ok: boolean }>(
      `select exists(
         select 1 from public.admin_user_deletion_otps
         where admin_user_id = $1::uuid
           and target_user_id = $2::uuid
           and created_at > now() - ($3::int * interval '1 second')
       ) as ok`,
      [adminId, targetId, cooldownSec]
    )
    return row?.ok === true
  } catch (e) {
    console.warn('[isAdminDeleteUserOtpCooldownActiveFromPg]', e)
    return false
  }
}

export async function replaceAdminDeleteUserOtpFromPg(params: {
  adminUserId: string
  targetUserId: string
  otpHash: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const adminId = safeUuid(params.adminUserId)
  const targetId = safeUuid(params.targetUserId)
  if (!adminId || !targetId) return false
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()
  try {
    await pgQuery(
      `delete from public.admin_user_deletion_otps
       where admin_user_id = $1::uuid and target_user_id = $2::uuid`,
      [adminId, targetId]
    )
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.admin_user_deletion_otps (admin_user_id, target_user_id, otp_hash, expires_at)
       values ($1::uuid, $2::uuid, $3, $4::timestamptz)
       returning id::text`,
      [adminId, targetId, params.otpHash, expiresAt]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[replaceAdminDeleteUserOtpFromPg]', e)
    return false
  }
}

export async function clearAdminDeleteUserOtpFromPg(adminUserId: string, targetUserId: string): Promise<void> {
  if (!isPgConfigured()) return
  const adminId = safeUuid(adminUserId)
  const targetId = safeUuid(targetUserId)
  if (!adminId || !targetId) return
  try {
    await pgQuery(
      `delete from public.admin_user_deletion_otps where admin_user_id = $1::uuid and target_user_id = $2::uuid`,
      [adminId, targetId]
    )
  } catch (e) {
    console.warn('[clearAdminDeleteUserOtpFromPg]', e)
  }
}

export async function consumeAdminDeleteUserOtpFromPg(params: {
  adminUserId: string
  targetUserId: string
  otp: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const adminId = safeUuid(params.adminUserId)
  const targetId = safeUuid(params.targetUserId)
  if (!adminId || !targetId) return false
  const otp = params.otp.replace(/\D/g, '').trim()
  if (otp.length !== 6) return false
  const tryHash = hashAdminDeleteUserOtp(adminId, targetId, otp)
  try {
    const row = await pgQueryOne<{ id: string }>(
      `delete from public.admin_user_deletion_otps
       where admin_user_id = $1::uuid
         and target_user_id = $2::uuid
         and expires_at > now()
         and otp_hash = $3
       returning id::text`,
      [adminId, targetId, tryHash]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[consumeAdminDeleteUserOtpFromPg]', e)
    return false
  }
}
