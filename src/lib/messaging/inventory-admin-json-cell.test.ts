import assert from 'node:assert/strict'
import test from 'node:test'
import { inventoryFieldToJsonCellText } from '@/lib/messaging/inventory-admin-json-cell'

test('empty image cells render as blank JSON (188 dash)', () => {
  assert.equal(inventoryFieldToJsonCellText(null), '')
  assert.equal(inventoryFieldToJsonCellText(''), '')
  assert.equal(inventoryFieldToJsonCellText([]), '[]')
})

test('main image string is JSON-quoted like 188', () => {
  assert.equal(inventoryFieldToJsonCellText('https://cdn.example/a.jpg'), '"https://cdn.example/a.jpg"')
})

test('gallery array is compact JSON', () => {
  assert.equal(
    inventoryFieldToJsonCellText(['https://a.jpg', 'https://b.jpg']),
    '["https://a.jpg","https://b.jpg"]'
  )
})

test('JSON string in cell is parsed then re-stringified', () => {
  assert.equal(inventoryFieldToJsonCellText('["https://a.jpg"]'), '["https://a.jpg"]')
})
