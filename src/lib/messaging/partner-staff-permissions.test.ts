import assert from 'node:assert/strict'
import test from 'node:test'
import {
  INVENTORY_CHILD_PERMS,
  ORDER_CHILD_PERMS,
  WEBSITE_CHILD_PERMS,
  defaultInviteStaffPermissions,
  normalizeStaffPermissionsFromJson,
  serializeStaffPermissions,
} from '@/lib/messaging/partner-staff-permissions'

test('invite default is inbox and orders hub only', () => {
  const perms = defaultInviteStaffPermissions()
  assert.equal(perms.inbox, true)
  assert.equal(perms.orders, true)
  assert.equal(perms.orders_profit, false)
  assert.equal(perms.inventory_products, false)
  assert.equal(perms.website_editor, false)
})

test('legacy parent keys expand only when child markers are absent', () => {
  const perms = normalizeStaffPermissionsFromJson({
    inventory: true,
    website: true,
    orders: true,
    integrations_analytics: true,
    marketing_campaigns: true,
  })
  for (const key of INVENTORY_CHILD_PERMS) assert.equal(perms[key], true, key)
  for (const key of WEBSITE_CHILD_PERMS) assert.equal(perms[key], true, key)
  for (const key of ORDER_CHILD_PERMS) assert.equal(perms[key], true, key)
  assert.equal(perms.analytics_catalog, true)
  assert.equal(perms.analytics_ads, true)
  assert.equal(perms.notifications, true)
  assert.equal(perms.email_management, true)
})

test('an explicit child key keeps the rest of the group off', () => {
  const perms = normalizeStaffPermissionsFromJson({
    inventory: true,
    inventory_products: false,
    website: true,
    website_editor: true,
    orders: true,
    orders_profit: false,
    integrations_analytics: true,
    analytics_catalog: true,
    notifications: false,
    email_management: false,
  })
  assert.equal(perms.inventory_products, false)
  assert.equal(perms.inventory_studio, false)
  assert.equal(perms.website_editor, true)
  assert.equal(perms.website_categories, false)
  assert.equal(perms.orders, true)
  assert.equal(perms.orders_profit, false)
  assert.equal(perms.orders_ems, false)
  assert.equal(perms.orders_shipping, false)
  assert.equal(perms.analytics_catalog, true)
  assert.equal(perms.analytics_ads, false)
  assert.equal(perms.notifications, false)
  assert.equal(perms.email_management, false)
})

test('saving the normalized map does not re-expand a parent group', () => {
  const saved = serializeStaffPermissions(
    normalizeStaffPermissionsFromJson({
      orders: true,
      orders_profit: false,
      inventory_products: true,
    })
  )
  const again = normalizeStaffPermissionsFromJson(saved)
  assert.equal(again.orders, true)
  assert.equal(again.orders_profit, false)
  assert.equal(again.orders_ems, false)
  assert.equal(again.inventory_products, true)
  assert.equal(again.inventory_studio, false)
  assert.equal('inventory' in saved, false)
  assert.equal('website' in saved, false)
})
