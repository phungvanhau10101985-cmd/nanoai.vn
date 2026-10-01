import { fetchMessagingPartnersForDashboardFromPg } from '@/lib/db/messaging-partners-pg'
import {
  partnerStaffHasAnyPerm,
  type PartnerStaffPermKey,
} from '@/lib/messaging/partner-staff-permissions'

export async function assertPartnerDashboardAccess(
  userId: string,
  partnerId: string,
  requiredPerm?: PartnerStaffPermKey | readonly PartnerStaffPermKey[]
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const partners = await fetchMessagingPartnersForDashboardFromPg(userId)
  if (partners === null) {
    return { ok: false, status: 503, error: 'Database not configured' }
  }
  const match = partners.find((p) => p.id === partnerId)
  if (!match) {
    return { ok: false, status: 403, error: 'Partner access denied' }
  }
  if (requiredPerm && match.dashboard_access !== 'owner') {
    const perms = match.staff_permissions
    const keys = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm]
    if (!perms || !partnerStaffHasAnyPerm(perms, keys)) {
      return { ok: false, status: 403, error: 'Permission denied' }
    }
  }
  return { ok: true }
}
