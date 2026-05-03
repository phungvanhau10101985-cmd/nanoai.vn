import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { resolvePartnerDashboardAccessFromPg } from '@/lib/messaging/partner-dashboard-access'
import { partnerStaffHasPerm } from '@/lib/messaging/partner-staff-permissions'

/** Xác thực chủ workspace (Postgres). */
export async function requireMessagingPartnerOwner(partnerId: string): Promise<
  { ok: true; userId: string } | { ok: false; error: string; status: number }
> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, error: auth.error, status: 401 }

  if (!isPgConfigured()) {
    return { ok: false, error: 'DATABASE_URL is not set.', status: 503 }
  }

  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text from public.messaging_partners
       where id = $1::uuid and owner_user_id = $2::uuid limit 1`,
      [partnerId, auth.user.id]
    )
    if (row) return { ok: true, userId: auth.user.id }
  } catch (e) {
    console.warn('[requireMessagingPartnerOwner] PG check failed', e)
    return { ok: false, error: 'Server error.', status: 500 }
  }

  return { ok: false, error: 'Forbidden.', status: 403 }
}

/** Chủ workspace hoặc nhân viên có quyền chỉnh kệ hàng / Excel. */
export async function requireMessagingPartnerInventoryAccess(partnerId: string): Promise<
  { ok: true; userId: string } | { ok: false; error: string; status: number }
> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, error: auth.error, status: 401 }
  if (!isPgConfigured()) {
    return { ok: false, error: 'DATABASE_URL is not set.', status: 503 }
  }
  try {
    const access = await resolvePartnerDashboardAccessFromPg(auth.user.id, partnerId)
    if (access === null) return { ok: false, error: 'Forbidden.', status: 403 }
    const okGate = access === 'owner' || partnerStaffHasPerm(access, 'inventory')
    if (!okGate) return { ok: false, error: 'Forbidden.', status: 403 }
    return { ok: true, userId: auth.user.id }
  } catch (e) {
    console.warn('[requireMessagingPartnerInventoryAccess]', e)
    return { ok: false, error: 'Server error.', status: 500 }
  }
}
