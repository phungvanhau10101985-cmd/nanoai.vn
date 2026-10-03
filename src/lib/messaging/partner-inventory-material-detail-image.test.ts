import assert from 'node:assert/strict'
import test from 'node:test'
import type { Database } from '@/types/database.types'
import { materialDetailPlanForInventoryRow } from './partner-inventory-material-detail-image'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

function row(
  id: string,
  materialDetailImageUrl: string,
  materialNote = 'Polyester pha spandex'
): InvRow {
  return {
    id,
    material_detail_image_url: materialDetailImageUrl,
    material_note: materialNote,
  } as unknown as InvRow
}

test('cached material image keeps the canonical inventory anchor', () => {
  const plan = materialDetailPlanForInventoryRow(
    row('04671253-cc4d-47a2-8e12-d0964e19e7f8', 'https://cdn.gudo.vn/cf2717-material.png')
  )
  assert.equal(plan.request, null)
  assert.equal(plan.followup?.inventoryId, '04671253-cc4d-47a2-8e12-d0964e19e7f8')
  assert.equal(plan.followup?.publicUrl, 'https://cdn.gudo.vn/cf2717-material.png')
})

test('uncached image schedules generation for the same inventory only', () => {
  const plan = materialDetailPlanForInventoryRow(
    row('04671253-cc4d-47a2-8e12-d0964e19e7f8', '')
  )
  assert.equal(plan.followup, null)
  assert.deepEqual(plan.request, {
    inventoryId: '04671253-cc4d-47a2-8e12-d0964e19e7f8',
  })
})
