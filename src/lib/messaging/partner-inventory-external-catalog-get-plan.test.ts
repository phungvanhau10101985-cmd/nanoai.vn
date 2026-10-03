import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { InventoryExcelInsert } from './partner-inventory-excel'
import { planExternalCatalogGetWrites } from './partner-inventory-external-catalog-get-plan'

function row(remarketingId: string, name = 'SP'): InventoryExcelInsert {
  return {
    sort_order: 0,
    name,
    sku: null,
    description: '',
    stock_note: '',
    stock_qty: 0,
    price_hint: '',
    image_url: '',
    product_url: '',
    product_video_url: '',
    consult_note: '',
    remarketing_id: remarketingId,
    is_active: true,
    removeFromInventory: false,
  }
}

describe('planExternalCatalogGetWrites', () => {
  it('skips existing remarketing_id and inserts only new keys', () => {
    const plan = planExternalCatalogGetWrites({
      incoming: [row('A'), row('B'), row('  A  ')],
      existingKeys: [{ id: 'id-a', remarketing_id: 'A' }],
      deleteRemarketingIds: [],
    })
    assert.equal(plan.insertRows.length, 1)
    assert.equal(plan.insertRows[0].remarketing_id, 'B')
    assert.deepEqual(plan.deleteIds, [])
  })

  it('deletes only ids flagged by customer API, not missing-from-feed', () => {
    const plan = planExternalCatalogGetWrites({
      incoming: [row('A')],
      existingKeys: [
        { id: 'id-a', remarketing_id: 'A' },
        { id: 'id-gone', remarketing_id: 'GONE' },
      ],
      deleteRemarketingIds: ['GONE'],
    })
    assert.deepEqual(plan.insertRows, [])
    assert.deepEqual(plan.deleteIds, ['id-gone'])
  })

  it('does not re-insert a key that still exists even if also in the delete list', () => {
    const plan = planExternalCatalogGetWrites({
      incoming: [row('A', 'Updated')],
      existingKeys: [{ id: 'id-a', remarketing_id: 'A' }],
      deleteRemarketingIds: ['A'],
    })
    assert.deepEqual(plan.insertRows, [])
    assert.deepEqual(plan.deleteIds, ['id-a'])
  })

  it('patches image consult context on an existing remarketing id without inserting it', () => {
    const context = {
      captured_at: '2026-10-03T00:00:00Z',
      language: 'vi',
      images: [{ url: 'external-catalog', lines: [{ src: '胸围 88cm', vi: 'Vòng ngực 88cm' }] }],
    }
    const existing = row('A')
    existing.image_consult_context = context
    const fresh = row('B')
    fresh.image_consult_context = context
    const plan = planExternalCatalogGetWrites({
      incoming: [existing, fresh],
      existingKeys: [{ id: 'id-a', remarketing_id: 'A' }],
      deleteRemarketingIds: [],
    })
    assert.equal(plan.insertRows.length, 1)
    assert.equal(plan.insertRows[0].remarketing_id, 'B')
    assert.equal(plan.consultContextPatches.length, 1)
    assert.equal(plan.consultContextPatches[0].inventoryId, 'id-a')
    assert.equal(plan.consultContextPatches[0].imageConsultContext, context)
  })

  it('does not patch consult context when the catalog field is missing or empty', () => {
    const bare = row('A', 'Giữ tên')
    const plan = planExternalCatalogGetWrites({
      incoming: [bare],
      existingKeys: [{ id: 'id-a', remarketing_id: 'A' }],
      deleteRemarketingIds: [],
    })
    assert.deepEqual(plan.insertRows, [])
    assert.deepEqual(plan.consultContextPatches, [])
  })

  it('ignores empty remarketing_id on incoming and existing rows', () => {
    const plan = planExternalCatalogGetWrites({
      incoming: [row(''), row('   '), row('NEW')],
      existingKeys: [{ id: 'blank', remarketing_id: '  ' }, { id: 'ok', remarketing_id: null }],
      deleteRemarketingIds: [''],
    })
    assert.equal(plan.insertRows.length, 1)
    assert.equal(plan.insertRows[0].remarketing_id, 'NEW')
    assert.deepEqual(plan.deleteIds, [])
  })
})
