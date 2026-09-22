import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const inventorySource = readFileSync(
  new URL('../db/messaging-partner-inventory-pg.ts', import.meta.url),
  'utf8'
)
const personalizationDbSource = readFileSync(
  new URL('../db/messaging-partner-visitor-personalization-pg.ts', import.meta.url),
  'utf8'
)
const storefrontSource = readFileSync(
  new URL('../partner-website/shop/partner-site-personalization.ts', import.meta.url),
  'utf8'
)

test('central inventory deletion removes deleted ids from viewed and favorite histories', () => {
  const deleteFlow = inventorySource.slice(
    inventorySource.indexOf('export async function deletePartnerInventoryByIdsForPartnerFromPg'),
    inventorySource.indexOf('function inventoryInsertRowParams')
  )
  assert.ok(deleteFlow.includes('removePartnerVisitorInventoryIdsFromPg'))
  assert.ok(deleteFlow.includes('inventoryIds: chunk'))
  assert.ok(deleteFlow.includes('visitor personalization cleanup failed'))
  assert.ok(!deleteFlow.includes("throw new Error('Inventory rows were deleted"))
})

test('personalization cleanup is tenant-scoped and filters both saved id arrays', () => {
  const cleanup = personalizationDbSource.slice(
    personalizationDbSource.indexOf('export async function removePartnerVisitorInventoryIdsFromPg'),
    personalizationDbSource.indexOf('function parseUtmContext')
  )
  assert.ok(cleanup.includes('where v.partner_id = $1::uuid'))
  assert.ok(cleanup.includes('recently_viewed_ids = ('))
  assert.ok(cleanup.includes('favorite_ids = ('))
  assert.ok(cleanup.includes('lower(trim(rv.item)) = any($2::text[])'))
  assert.ok(cleanup.includes('lower(trim(fv.item)) = any($2::text[])'))
})

test('badge id reads discard legacy ids whose inventory rows are already gone', () => {
  const idsRead = storefrontSource.slice(
    storefrontSource.indexOf('export async function getSitePersonalizationInventoryIds'),
    storefrontSource.indexOf('export async function getSiteRecentlyViewedProducts')
  )
  assert.ok(idsRead.includes('fetchExistingPartnerInventoryIdsInOrderFromPg'))
  assert.ok(idsRead.includes('staleIds'))
  assert.ok(idsRead.includes('removePartnerVisitorInventoryIdsFromPg'))
  assert.ok(idsRead.includes('return existingIds'))
})
