import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const UUID_SQL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function safeUuid(id: unknown): string | null {
  const s = typeof id === 'string' ? id.trim() : String(id ?? '').trim()
  if (!s || !UUID_SQL.test(s)) return null
  return s
}

export type AdminDeleteUserPrecheck =
  | { ok: true; email: string | null; role: string | null }
  | { ok: false; code: 'not_found' | 'is_admin' | 'is_self' | 'owns_workspace' | 'db_error'; message: string }

export async function precheckAdminDeleteUserFromPg(
  targetUserId: string,
  adminUserId: string
): Promise<AdminDeleteUserPrecheck> {
  if (!isPgConfigured()) {
    return { ok: false, code: 'db_error', message: 'DATABASE_URL is not set.' }
  }
  const targetId = safeUuid(targetUserId)
  const adminId = safeUuid(adminUserId)
  if (!targetId || !adminId) {
    return { ok: false, code: 'not_found', message: 'Invalid user id.' }
  }
  if (targetId === adminId) {
    return { ok: false, code: 'is_self', message: 'Không thể xóa chính tài khoản admin đang đăng nhập.' }
  }
  try {
    const profile = await pgQueryOne<{ role: string | null; email: string | null }>(
      `select p.role, nullif(au.email, '') as email
       from public.profiles p
       left join auth.users au on au.id = p.id
       where p.id = $1::uuid
       limit 1`,
      [targetId]
    )
    if (!profile) {
      return { ok: false, code: 'not_found', message: 'Không tìm thấy tài khoản.' }
    }
    if (profile.role === 'admin') {
      return { ok: false, code: 'is_admin', message: 'Không thể xóa tài khoản admin khác.' }
    }
    const owned = await pgQueryOne<{ n: number }>(
      `select count(*)::int as n
       from public.messaging_partners
       where owner_user_id = $1::uuid`,
      [targetId]
    )
    if ((owned?.n ?? 0) > 0) {
      return {
        ok: false,
        code: 'owns_workspace',
        message: 'User còn workspace shop. Hãy xóa/lên lịch xóa workspace trước.',
      }
    }
    return { ok: true, email: profile.email, role: profile.role }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[precheckAdminDeleteUserFromPg]', e)
    return { ok: false, code: 'db_error', message: msg }
  }
}

export async function pgAdminDeleteUserById(targetUserId: string): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const targetId = safeUuid(targetUserId)
  if (!targetId) return { error: 'Invalid user id.' }
  try {
    await pgQuery(
      `delete from public.messaging_partner_marketing_campaigns where created_by_user_id = $1::uuid`,
      [targetId]
    )
    const row = await pgQueryOne<{ id: string }>(
      `delete from auth.users where id = $1::uuid returning id::text`,
      [targetId]
    )
    if (!row?.id) return { error: 'Không tìm thấy tài khoản hoặc đã bị xóa.' }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[pgAdminDeleteUserById]', e)
    return { error: msg || 'Không xóa được tài khoản (ràng buộc dữ liệu).' }
  }
}
