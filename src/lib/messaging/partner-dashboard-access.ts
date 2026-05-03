import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchMemberPermissionsForPartnerFromPg,
  isMessagingPartnerOwnerFromPg,
} from '@/lib/db/messaging-partner-members-pg'
import {
  type PartnerStaffPermKey,
  type PartnerStaffPermissionMap,
  normalizeStaffPermissionsFromJson,
  partnerStaffHasPerm,
} from '@/lib/messaging/partner-staff-permissions'
import { isValidUuidString } from '@/lib/validate-uuid'

export type PartnerDashboardAccess = 'owner' | PartnerStaffPermissionMap

/**
 * Resolve quyền dashboard cho (userId, partnerId). `null` = không có quyền.
 */
export async function resolvePartnerDashboardAccessFromPg(
  userId: string,
  partnerId: string
): Promise<PartnerDashboardAccess | null> {
  if (!isPgConfigured() || !isValidUuidString(userId) || !isValidUuidString(partnerId)) {
    return null
  }
  if (await isMessagingPartnerOwnerFromPg(partnerId, userId)) {
    return 'owner'
  }
  const raw = await fetchMemberPermissionsForPartnerFromPg(partnerId, userId)
  if (raw == null) return null
  return normalizeStaffPermissionsFromJson(raw)
}

export async function assertPartnerOwnerGate(
  userId: string,
  partnerId: string
): Promise<{ ok: true } | { error: string }> {
  if (!isValidUuidString(userId) || !isValidUuidString(partnerId)) return { error: 'Forbidden.' }
  if (!(await isMessagingPartnerOwnerFromPg(partnerId, userId))) return { error: 'Forbidden.' }
  return { ok: true }
}

export async function assertPartnerStaffGate(
  userId: string,
  partnerId: string,
  need: PartnerStaffPermKey | 'owner'
): Promise<{ ok: true } | { error: string }> {
  const access = await resolvePartnerDashboardAccessFromPg(userId, partnerId)
  if (access == null) return { error: 'Forbidden.' }
  if (need === 'owner') {
    return access === 'owner' ? { ok: true } : { error: 'Forbidden.' }
  }
  return partnerStaffHasPerm(access, need) ? { ok: true } : { error: 'Forbidden.' }
}
