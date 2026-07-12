/**
 * Quyền nhân viên workspace nhắn tin (partner dashboard).
 * Chủ workspace (owner_user_id): luôn toàn quyền — không đọc từ bảng member.
 */

export const PARTNER_STAFF_PERM_KEYS = [
  'inbox',
  'orders',
  'inventory',
  'ai_settings',
  'workspace_branding',
  'workspace_payment',
  'integrations_channels',
  'integrations_analytics',
  'usage_reports',
  'marketing_campaigns',
] as const

export type PartnerStaffPermKey = (typeof PARTNER_STAFF_PERM_KEYS)[number]

export type PartnerStaffPermissionMap = Record<PartnerStaffPermKey, boolean>

/** Mặc định khi mời bằng email: chỉ inbox + đơn. */
export function defaultInviteStaffPermissions(): PartnerStaffPermissionMap {
  const o = {} as PartnerStaffPermissionMap
  for (const k of PARTNER_STAFF_PERM_KEYS) {
    o[k] = k === 'inbox' || k === 'orders'
  }
  return o
}

function jsonTruthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v === 'true' || v === '1'
  if (typeof v === 'number') return v !== 0
  return false
}

export function normalizeStaffPermissionsFromJson(raw: unknown): PartnerStaffPermissionMap {
  const base = defaultInviteStaffPermissions()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return base
  }
  const obj = raw as Record<string, unknown>
  const out = { ...base }
  for (const k of PARTNER_STAFF_PERM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k] = jsonTruthy(obj[k])
    }
  }
  return out
}

export function serializeStaffPermissions(m: PartnerStaffPermissionMap): Record<string, boolean> {
  const o: Record<string, boolean> = {}
  for (const k of PARTNER_STAFF_PERM_KEYS) {
    o[k] = Boolean(m[k])
  }
  return o
}

export function partnerStaffHasPerm(
  access: 'owner' | PartnerStaffPermissionMap,
  key: PartnerStaffPermKey
): boolean {
  if (access === 'owner') return true
  return Boolean(access[key])
}
