import assert from 'node:assert/strict'
import test from 'node:test'
import {
  INVENTORY_DETAIL_OMIT_KEYS,
  buildInventoryDetailSections,
  inventoryDetailShownKeys,
} from '@/lib/messaging/inventory-admin-detail-fields'

test('detail page lists every product field and skips embedding vectors', () => {
  const fields: Record<string, unknown> = {
    id: 'uuid-1',
    name: 'Túi',
    description: '<p>mô tả</p>',
    product_info_json: { chat_lieu: 'da' },
    gallery_urls: ['https://cdn.example/a.jpg'],
    stock_qty: 0,
    is_active: false,
    image_embedding_vec: '[1,2,3]',
    text_embedding_json: [0.1, 0.2],
    future_column: 'mới',
  }
  const shown = inventoryDetailShownKeys(fields)
  assert.deepEqual(
    shown.filter((key) => (INVENTORY_DETAIL_OMIT_KEYS as readonly string[]).includes(key)),
    []
  )
  for (const key of Object.keys(fields)) {
    if ((INVENTORY_DETAIL_OMIT_KEYS as readonly string[]).includes(key)) {
      assert.equal(shown.includes(key), false)
    } else {
      assert.equal(shown.includes(key), true, key)
    }
  }
  assert.equal(new Set(shown).size, shown.length)

  const sections = buildInventoryDetailSections(fields, 'en')
  const stock = sections.find((section) => section.id === 'stock')
  const qty = stock?.cells.find((cell) => cell.key === 'stock_qty')
  assert.equal(qty?.kind, 'text')
  if (qty?.kind === 'text') assert.equal(qty.text, '0')
  const status = sections.flatMap((section) => section.cells).find((cell) => cell.key === 'is_active')
  assert.equal(status?.kind, 'bool')
  if (status?.kind === 'bool') assert.equal(status.text, 'Hidden')
  const other = sections.find((section) => section.id === 'other')
  assert.equal(other?.cells.some((cell) => cell.key === 'future_column'), true)
})
