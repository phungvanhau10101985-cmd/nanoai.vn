/**
 * Quyền nhân viên workspace nhắn tin (partner dashboard).
 * Chủ workspace (owner_user_id): luôn toàn quyền — không đọc từ bảng member.
 *
 * Mỗi mục con trên sidebar quản trị là một quyền. Không có quyền «cả mục lớn»
 * (kho / website / đơn) chia cho mọi mục con.
 * JSON cũ chỉ có khóa cha (`inventory`, `website`, `orders`, `integrations_analytics`)
 * vẫn mở hết mục con của nhóm đó cho đến lần chủ shop lưu lại.
 */

export const PARTNER_STAFF_PERM_KEYS = [
  'inbox',
  'workspace_branding',
  'workspace_payment',
  'inventory_products',
  'inventory_studio',
  'inventory_listing_import',
  'inventory_source_stock',
  'inventory_open_sync',
  'inventory_image_loc',
  'inventory_search_aliases',
  'inventory_facet_cache',
  'inventory_search_cache',
  'orders_shipping',
  'orders',
  'orders_profit',
  'orders_ems',
  'notifications',
  'marketing_campaigns',
  'email_management',
  'website_customers',
  'website_leads',
  'website_editor',
  'website_categories',
  'website_reviews',
  'website_static_pages',
  'website_promotions',
  'website_landings',
  'website_floating_cta',
  'integrations_channels',
  'analytics_catalog',
  'analytics_ads',
  'ai_settings',
  'usage_reports',
] as const

export type PartnerStaffPermKey = (typeof PARTNER_STAFF_PERM_KEYS)[number]

export type PartnerStaffPermissionMap = Record<PartnerStaffPermKey, boolean>

export const INVENTORY_CHILD_PERMS = [
  'inventory_products',
  'inventory_studio',
  'inventory_listing_import',
  'inventory_source_stock',
  'inventory_open_sync',
  'inventory_image_loc',
  'inventory_search_aliases',
  'inventory_facet_cache',
  'inventory_search_cache',
] as const satisfies readonly PartnerStaffPermKey[]

export const WEBSITE_CHILD_PERMS = [
  'website_customers',
  'website_leads',
  'website_editor',
  'website_categories',
  'website_reviews',
  'website_static_pages',
  'website_promotions',
  'website_landings',
  'website_floating_cta',
] as const satisfies readonly PartnerStaffPermKey[]

export const ORDER_CHILD_PERMS = ['orders', 'orders_profit', 'orders_ems', 'orders_shipping'] as const satisfies readonly PartnerStaffPermKey[]

/** Mặc định khi mời bằng email: chỉ hộp thư + đơn hàng. */
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

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function blankPerms(): PartnerStaffPermissionMap {
  const o = {} as PartnerStaffPermissionMap
  for (const k of PARTNER_STAFF_PERM_KEYS) o[k] = false
  return o
}

function fillExplicit(out: PartnerStaffPermissionMap, obj: Record<string, unknown>, keys: readonly PartnerStaffPermKey[]) {
  for (const k of keys) {
    if (hasOwn(obj, k)) out[k] = jsonTruthy(obj[k])
  }
}

function fillAll(out: PartnerStaffPermissionMap, keys: readonly PartnerStaffPermKey[], value: boolean) {
  for (const k of keys) out[k] = value
}

/**
 * Đọc JSON member. Khóa con có mặt = chế độ tách mục (thiếu khóa con = tắt).
 * Chưa có khóa con thì khóa cha cũ mở cả nhóm.
 */
export function normalizeStaffPermissionsFromJson(raw: unknown): PartnerStaffPermissionMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaultInviteStaffPermissions()
  }
  const obj = raw as Record<string, unknown>
  const out = blankPerms()
  fillExplicit(out, obj, PARTNER_STAFF_PERM_KEYS)

  const inventoryExplicit = INVENTORY_CHILD_PERMS.some((k) => hasOwn(obj, k))
  if (!inventoryExplicit && jsonTruthy(obj.inventory)) fillAll(out, INVENTORY_CHILD_PERMS, true)

  const websiteExplicit = WEBSITE_CHILD_PERMS.some((k) => hasOwn(obj, k))
  if (!websiteExplicit && jsonTruthy(obj.website)) fillAll(out, WEBSITE_CHILD_PERMS, true)

  const ordersExplicit = (['orders_profit', 'orders_ems', 'orders_shipping'] as const).some((k) => hasOwn(obj, k))
  if (!ordersExplicit && jsonTruthy(obj.orders)) fillAll(out, ORDER_CHILD_PERMS, true)

  const analyticsExplicit = hasOwn(obj, 'analytics_catalog') || hasOwn(obj, 'analytics_ads')
  if (!analyticsExplicit && jsonTruthy(obj.integrations_analytics)) {
    out.analytics_catalog = true
    out.analytics_ads = true
  }

  const legacyWebsiteOrMarketing = jsonTruthy(obj.website) || jsonTruthy(obj.marketing_campaigns)
  if (!hasOwn(obj, 'notifications') && legacyWebsiteOrMarketing) out.notifications = true
  if (!hasOwn(obj, 'email_management') && legacyWebsiteOrMarketing) out.email_management = true

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

export function partnerStaffHasAnyPerm(
  access: 'owner' | PartnerStaffPermissionMap,
  keys: readonly PartnerStaffPermKey[]
): boolean {
  if (access === 'owner') return true
  return keys.some((key) => Boolean(access[key]))
}
