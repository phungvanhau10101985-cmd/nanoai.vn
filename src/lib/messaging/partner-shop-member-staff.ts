import {
  INVENTORY_CHILD_PERMS,
  PARTNER_STAFF_PERM_KEYS,
  WEBSITE_CHILD_PERMS,
  type PartnerStaffPermKey,
  type PartnerStaffPermissionMap,
} from '@/lib/messaging/partner-staff-permissions'

export const LINKED_STAFF_ROLES = ['none', 'order_manager', 'admin', 'product_manager', 'content_manager'] as const

export type LinkedStaffRole = (typeof LINKED_STAFF_ROLES)[number]

const ORDER_PRESET: PartnerStaffPermKey[] = [
  'inbox',
  'orders',
  'orders_profit',
  'orders_ems',
  'orders_shipping',
]

const CONTENT_PRESET: PartnerStaffPermKey[] = [...WEBSITE_CHILD_PERMS]

export function isLinkedStaffRole(value: unknown): value is LinkedStaffRole {
  return typeof value === 'string' && (LINKED_STAFF_ROLES as readonly string[]).includes(value)
}

function blankPerms(): PartnerStaffPermissionMap {
  const out = {} as PartnerStaffPermissionMap
  for (const key of PARTNER_STAFF_PERM_KEYS) out[key] = false
  return out
}

function fill(out: PartnerStaffPermissionMap, keys: readonly PartnerStaffPermKey[], value = true) {
  for (const key of keys) out[key] = value
}

export function presetModulesForLinkedRole(role: LinkedStaffRole): PartnerStaffPermKey[] {
  if (role === 'order_manager') return [...ORDER_PRESET]
  if (role === 'product_manager') return [...INVENTORY_CHILD_PERMS]
  if (role === 'content_manager') return [...CONTENT_PRESET]
  return []
}

export function permissionsForLinkedStaff(
  role: LinkedStaffRole,
  modules?: string[] | null
): PartnerStaffPermissionMap {
  const out = blankPerms()
  if (role === 'none') return out
  if (role === 'admin') {
    fill(out, PARTNER_STAFF_PERM_KEYS, true)
    return out
  }
  const allowed = new Set<string>(PARTNER_STAFF_PERM_KEYS)
  const picked = (modules ?? presetModulesForLinkedRole(role)).filter((key) => allowed.has(key))
  fill(out, picked as PartnerStaffPermKey[], true)
  return out
}

function sameKeys(perms: PartnerStaffPermissionMap, keys: readonly PartnerStaffPermKey[]): boolean {
  const on = new Set(PARTNER_STAFF_PERM_KEYS.filter((key) => perms[key]))
  if (on.size !== keys.length) return false
  return keys.every((key) => on.has(key))
}

export function readStoredStaffRole(raw: unknown): LinkedStaffRole | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const role = (raw as { staff_role?: unknown }).staff_role
  return isLinkedStaffRole(role) && role !== 'none' ? role : null
}

export function inferLinkedStaffRole(
  perms: PartnerStaffPermissionMap,
  stored: LinkedStaffRole | null
): LinkedStaffRole {
  if (stored) return stored
  const any = PARTNER_STAFF_PERM_KEYS.some((key) => perms[key])
  if (!any) return 'none'
  if (PARTNER_STAFF_PERM_KEYS.every((key) => perms[key])) return 'admin'
  if (sameKeys(perms, ORDER_PRESET)) return 'order_manager'
  if (sameKeys(perms, INVENTORY_CHILD_PERMS)) return 'product_manager'
  if (sameKeys(perms, CONTENT_PRESET)) return 'content_manager'
  return 'order_manager'
}

export function linkedModulesForDisplay(role: LinkedStaffRole, perms: PartnerStaffPermissionMap): string[] {
  if (role === 'none' || role === 'admin') return []
  return PARTNER_STAFF_PERM_KEYS.filter((key) => perms[key])
}
