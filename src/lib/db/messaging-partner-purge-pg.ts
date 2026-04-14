import { createHash, randomInt } from 'node:crypto'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const UUID_SQL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function safeUuid(id: unknown): string | null {
  const s = typeof id === 'string' ? id.trim() : String(id ?? '').trim()
  if (!s || !UUID_SQL.test(s)) return null
  return s
}

export function partnerPurgeGraceDays(): number {
  const raw = parseInt(process.env.PARTNER_PURGE_GRACE_DAYS || '7', 10)
  return Number.isFinite(raw) ? Math.min(90, Math.max(1, raw)) : 7
}

export function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

export function hashWorkspaceDeletionOtp(partnerId: string, ownerUserId: string, otp: string): string {
  const o = otp.replace(/\D/g, '').trim()
  return sha256hex(`messaging_partner_delete_otp:${partnerId}:${ownerUserId}:${o}`)
}

export function generateWorkspaceDeletionOtp6(): string {
  return String(randomInt(100000, 1000000))
}

const OTP_TTL_MINUTES = 10

/**
 * Gỡ OTP cũ, ghi OTP mới (hash). Trả `false` khi không cập nhật được.
 */
export async function isWorkspaceDeletionOtpCooldownActiveFromPg(partnerId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(partnerId)
  if (!pid) return false
  const cooldownSec = Math.min(600, Math.max(0, parseInt(process.env.WORKSPACE_DELETE_OTP_COOLDOWN_SECONDS || '90', 10) || 90))
  if (cooldownSec <= 0) return false
  try {
    const row = await pgQueryOne<{ ok: boolean }>(
      `select exists(
         select 1 from public.messaging_partner_deletion_otps
         where partner_id = $1::uuid
           and created_at > now() - ($2::int * interval '1 second')
       ) as ok`,
      [pid, cooldownSec]
    )
    return row?.ok === true
  } catch (e) {
    console.warn('[isWorkspaceDeletionOtpCooldownActiveFromPg]', e)
    return false
  }
}

export async function replaceWorkspaceDeletionOtpForPartnerFromPg(params: {
  partnerId: string
  ownerUserId: string
  otpHash: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(params.partnerId)
  const uid = safeUuid(params.ownerUserId)
  if (!pid || !uid) return false
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()
  try {
    await pgQuery(`delete from public.messaging_partner_deletion_otps where partner_id = $1::uuid`, [pid])
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.messaging_partner_deletion_otps (partner_id, owner_user_id, otp_hash, expires_at)
       values ($1::uuid, $2::uuid, $3, $4::timestamptz)
       returning id::text`,
      [pid, uid, params.otpHash, expiresAt]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[replaceWorkspaceDeletionOtpForPartnerFromPg]', e)
    return false
  }
}

/**
 * Khớp OTP, đặt `purge_at` = now + grace, xóa dòng OTP. Trả `null` khi sai hết hạn hoặc không đủ quyền.
 */
export async function verifyDeletionOtpAndSchedulePartnerPurgeFromPg(params: {
  partnerId: string
  ownerUserId: string
  otp: string
}): Promise<{ purge_at: string } | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(params.partnerId)
  const uid = safeUuid(params.ownerUserId)
  if (!pid || !uid) return null
  const otp = params.otp.replace(/\D/g, '').trim()
  if (otp.length !== 6) return null
  const tryHash = hashWorkspaceDeletionOtp(pid, uid, otp)
  const days = partnerPurgeGraceDays()
  try {
    const row = await pgQueryOne<{
      id: string
      purge_at: string
    }>(
      `with del as (
         delete from public.messaging_partner_deletion_otps o
         where o.partner_id = $1::uuid
           and o.owner_user_id = $2::uuid
           and o.expires_at > now()
           and o.otp_hash = $3
         returning o.id
       )
       update public.messaging_partners mp
       set purge_at = now() + ($4::int * interval '1 day'),
           deletion_requested_at = now(),
           updated_at = now()
       from del
       where mp.id = $1::uuid
         and mp.owner_user_id = $2::uuid
         and coalesce(mp.is_active, true) = true
         and mp.purge_at is null
       returning mp.purge_at::text as purge_at`,
      [pid, uid, tryHash, days]
    )
    if (!row?.purge_at) return null
    return { purge_at: row.purge_at }
  } catch (e) {
    console.warn('[verifyDeletionOtpAndSchedulePartnerPurgeFromPg]', e)
    return null
  }
}

export async function cancelScheduledPartnerPurgeFromPg(partnerId: string, ownerUserId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(partnerId)
  const uid = safeUuid(ownerUserId)
  if (!pid || !uid) return false
  try {
    await pgQuery(`delete from public.messaging_partner_deletion_otps where partner_id = $1::uuid`, [pid])
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_partners
       set purge_at = null,
           updated_at = now()
       where id = $1::uuid
         and owner_user_id = $2::uuid
         and coalesce(is_active, true) = true
         and purge_at is not null
       returning id::text`,
      [pid, uid]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[cancelScheduledPartnerPurgeFromPg]', e)
    return false
  }
}

/**
 * Cron: workspace đến hạn xóa → `is_active = false`, gỡ `purge_at`.
 */
export async function finalizeDueMessagingPartnerPurgesFromPg(): Promise<string[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ id: string }>(
      `update public.messaging_partners
       set is_active = false,
           purge_at = null,
           updated_at = now()
       where coalesce(is_active, true) = true
         and purge_at is not null
         and purge_at <= now()
       returning id::text as id`
    )
    return rows.map((r) => r.id)
  } catch (e) {
    console.warn('[finalizeDueMessagingPartnerPurgesFromPg]', e)
    return []
  }
}
