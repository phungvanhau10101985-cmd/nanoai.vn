import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { partnerStaffAdminPath } from '@/lib/messaging/partner-staff-invite-email'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PartnerShopAdminAccess = {
  userId: string
  role: 'owner' | 'staff'
  href: string
}

/** Gmail đã là chủ shop hoặc được mời nhân viên → link trang quản trị. */
export async function resolvePartnerShopAdminAccessByEmail(input: {
  partnerId: string
  email: string | null | undefined
  industryKey?: string | null
}): Promise<PartnerShopAdminAccess | null> {
  if (!isPgConfigured()) return null
  const partnerId = input.partnerId.trim()
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase()
  if (!UUID_RE.test(partnerId) || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null
  }
  try {
    const row = await pgQueryOne<{ id: string; is_owner: boolean; is_staff: boolean }>(
      `select u.id::text as id,
              (p.owner_user_id = u.id) as is_owner,
              exists(
                select 1
                from public.messaging_partner_members m
                where m.partner_id = p.id
                  and m.member_user_id = u.id
              ) as is_staff
       from auth.users u
       join public.messaging_partners p on p.id = $2::uuid
       where lower(trim(coalesce(u.email, ''))) = $1::text
       limit 1`,
      [email, partnerId]
    )
    if (!row?.id || (!row.is_owner && !row.is_staff)) return null
    return {
      userId: row.id,
      role: row.is_owner ? 'owner' : 'staff',
      href: partnerStaffAdminPath(partnerId, input.industryKey),
    }
  } catch (e) {
    console.warn('[resolvePartnerShopAdminAccessByEmail]', e)
    return null
  }
}
