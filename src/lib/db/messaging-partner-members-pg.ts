import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { PartnerStaffPermissionMap } from '@/lib/messaging/partner-staff-permissions'
import {
  serializeStaffPermissions,
  normalizeStaffPermissionsFromJson,
} from '@/lib/messaging/partner-staff-permissions'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PartnerMemberRow = {
  id: string
  partner_id: string
  member_user_id: string
  invited_by: string | null
  permissions: PartnerStaffPermissionMap
  /** email từ auth.users — chỉ chủ đọc */
  member_email: string | null
  created_at: string
}

/** Trả UUID user có email khớp (lower trim), không bằng chủ workspace. */
export async function lookupAuthUserIdByEmailExcludeOwnerFromPg(params: {
  email: string
  ownerUserId: string
  partnerId: string
}): Promise<
  | { ok: true; userId: string }
  | { ok: false; reason: 'not_found' | 'is_owner' | 'invalid_email' | 'duplicate_owner' }
> {
  if (!isPgConfigured()) return { ok: false, reason: 'not_found' }
  const raw = typeof params.email === 'string' ? params.email.trim() : ''
  const em = raw.toLowerCase()
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    return { ok: false, reason: 'invalid_email' }
  }
  const owner = typeof params.ownerUserId === 'string' ? params.ownerUserId.trim() : ''
  const pid = typeof params.partnerId === 'string' ? params.partnerId.trim() : ''
  if (!owner || !UUID_RE.test(owner) || !UUID_RE.test(pid)) {
    return { ok: false, reason: 'not_found' }
  }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select u.id::text
       from auth.users u
       where lower(trim(coalesce(u.email,''))) = $1::text limit 1`,
      [em]
    )
    if (!row?.id) return { ok: false, reason: 'not_found' }
    if (row.id === owner) return { ok: false, reason: 'is_owner' }

    const isPartnerOwner = await pgQueryOne<{ ok: boolean }>(
      `select (owner_user_id = $2::uuid) as ok
       from public.messaging_partners where id = $1::uuid limit 1`,
      [pid, row.id]
    )
    if (isPartnerOwner?.ok === true) {
      return { ok: false, reason: 'duplicate_owner' }
    }
    return { ok: true, userId: row.id }
  } catch (e) {
    console.warn('[lookupAuthUserIdByEmailExcludeOwnerFromPg]', e)
    return { ok: false, reason: 'not_found' }
  }
}

export async function isMessagingPartnerOwnerFromPg(partnerId: string, userId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = partnerId.trim()
  const uid = userId.trim()
  if (!UUID_RE.test(pid) || !UUID_RE.test(uid)) return false
  try {
    const row = await pgQueryOne<{ ok: boolean }>(
      `select true as ok from public.messaging_partners
       where id = $1::uuid and owner_user_id = $2::uuid limit 1`,
      [pid, uid]
    )
    return row?.ok === true
  } catch {
    return false
  }
}

export async function fetchMemberPermissionsForPartnerFromPg(
  partnerId: string,
  memberUserId: string
): Promise<unknown | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ permissions: unknown }>(
      `select permissions
       from public.messaging_partner_members
       where partner_id = $1::uuid and member_user_id = $2::uuid
       limit 1`,
      [partnerId.trim(), memberUserId.trim()]
    )
    return row?.permissions ?? null
  } catch (e) {
    console.warn('[fetchMemberPermissionsForPartnerFromPg]', e)
    return null
  }
}

export async function listMessagingPartnerMembersForOwnerFromPg(
  partnerId: string,
  ownerUserId: string
): Promise<PartnerMemberRow[]> {
  if (!isPgConfigured()) return []
  const pid = partnerId.trim()
  const oid = ownerUserId.trim()
  if (!UUID_RE.test(pid) || !UUID_RE.test(oid)) return []
  try {
    const owns = await isMessagingPartnerOwnerFromPg(pid, oid)
    if (!owns) return []

    const rows = await pgQuery<{
      id: string
      partner_id: string
      member_user_id: string
      invited_by: string | null
      permissions: unknown
      member_email: string | null
      created_at: unknown
    }>(
      `select m.id::text, m.partner_id::text, m.member_user_id::text,
              m.invited_by::text as invited_by,
              m.permissions,
              nullif(trim(coalesce(au.email, '')), '') as member_email,
              m.created_at
       from public.messaging_partner_members m
       left join auth.users au on au.id = m.member_user_id
       where m.partner_id = $1::uuid
       order by m.created_at asc`,
      [pid]
    )
    return rows.map((r) => ({
      id: r.id,
      partner_id: r.partner_id,
      member_user_id: r.member_user_id,
      invited_by: r.invited_by,
      permissions: normalizeStaffPermissionsFromJson(r.permissions),
      member_email: r.member_email ?? null,
      created_at: String(r.created_at ?? ''),
    }))
  } catch (e) {
    console.warn('[listMessagingPartnerMembersForOwnerFromPg]', e)
    return []
  }
}

export async function upsertMessagingPartnerMemberForOwnerFromPg(input: {
  partnerId: string
  ownerUserId: string
  memberUserId: string
  permissions: PartnerStaffPermissionMap
}): Promise<{ ok: boolean; error?: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database' }
  const pid = input.partnerId.trim()
  const oid = input.ownerUserId.trim()
  const mid = input.memberUserId.trim()
  if (!UUID_RE.test(pid) || !UUID_RE.test(oid) || !UUID_RE.test(mid)) {
    return { ok: false, error: 'invalid_id' }
  }
  const owns = await isMessagingPartnerOwnerFromPg(pid, oid)
  if (!owns) return { ok: false, error: 'forbidden' }
  try {
    const permJson = JSON.stringify(serializeStaffPermissions(input.permissions))
    await pgQuery(
      `insert into public.messaging_partner_members (
         partner_id, member_user_id, invited_by, permissions
       ) values ($1::uuid, $2::uuid, $3::uuid, $4::jsonb)
       on conflict (partner_id, member_user_id) do update set
         permissions = excluded.permissions,
         updated_at = now()`,
      [pid, mid, oid, permJson]
    )
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('member_cannot_be_owner')) return { ok: false, error: 'is_owner' }
    console.warn('[upsertMessagingPartnerMemberForOwnerFromPg]', e)
    return { ok: false, error: 'insert_failed' }
  }
}

export async function deleteMessagingPartnerMemberForOwnerFromPg(input: {
  partnerId: string
  ownerUserId: string
  memberUserId: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = input.partnerId.trim()
  const oid = input.ownerUserId.trim()
  const mid = input.memberUserId.trim()
  if (!UUID_RE.test(pid) || !UUID_RE.test(oid) || !UUID_RE.test(mid)) return false
  const owns = await isMessagingPartnerOwnerFromPg(pid, oid)
  if (!owns) return false
  try {
    await pgQuery(
      `delete from public.messaging_partner_members
       where partner_id = $1::uuid and member_user_id = $2::uuid`,
      [pid, mid]
    )
    return true
  } catch (e) {
    console.warn('[deleteMessagingPartnerMemberForOwnerFromPg]', e)
    return false
  }
}
