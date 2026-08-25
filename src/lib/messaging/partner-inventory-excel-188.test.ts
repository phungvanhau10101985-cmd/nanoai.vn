import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import {
  CATALOG_188_EXCEL_COLUMNS,
  CATALOG_188_VI_HEADERS,
  isCatalog188HeaderRow,
  isCatalog188LabelRow,
  parseColorVariantsField,
} from '@/lib/messaging/partner-inventory-catalog-188'
import {
  buildInventoryTemplateBuffer,
  parseInventoryWorkbook,
} from '@/lib/messaging/partner-inventory-excel'

test('isCatalog188HeaderRow detects EN catalog headers', () => {
  assert.equal(isCatalog188HeaderRow([...CATALOG_188_EXCEL_COLUMNS]), true)
  assert.equal(isCatalog188HeaderRow(['sku', 'name', 'description']), false)
})

test('isCatalog188LabelRow detects Vietnamese row 2', () => {
  assert.equal(
    isCatalog188LabelRow(CATALOG_188_EXCEL_COLUMNS.map((col) => CATALOG_188_VI_HEADERS[col])),
    true
  )
})

test('parseColorVariantsField keeps name-only colors', () => {
  const colors = parseColorVariantsField('["Đen","Trắng"]')
  assert.equal(colors.length, 2)
  assert.equal(colors[0]?.name, 'Đen')
  assert.equal(colors[0]?.img, '')
})

test('buildInventoryTemplateBuffer + parseInventoryWorkbook round-trips 188 catalog', () => {
  const buf = buildInventoryTemplateBuffer()
  const parsed = parseInventoryWorkbook(buf)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.rows.length, 1)
  const row = parsed.rows[0]
  assert.equal(row.catalogFormat, '188')
  assert.equal(row.remarketing_id, 'A746-DEMO-001')
  assert.equal(row.sku, 'B0038')
  assert.equal(row.name, 'Áo thun cotton cổ tròn')
  assert.match(row.description, /Áo thun cotton/)
  assert.equal(row.catalog?.sizes.join(','), 'M,L,XL')
  assert.equal(row.catalog?.colors[0]?.name, 'Đen')
  assert.equal(row.catalog?.category_l1, 'Thời trang nam')
  assert.equal(row.catalog?.category_l3, 'Áo thun')
  assert.equal(row.catalog?.deposit_required, false)
  assert.equal(row.catalog?.material_note, 'Cotton')
})

test('parseInventoryWorkbook still accepts the legacy 12-column template', () => {
  const header = [
    'Mã SKU',
    'Tên sản phẩm',
    'Size (JSON) vd: ["38","39","40"]',
    'Màu sắc (JSON) vd: [{"name":"Đen","img":"https://..."}]',
    'Số lượng tồn kho',
    'Giá',
    'Link ảnh',
    'Link trang sản phẩm',
    'Video sản phẩm (YouTube hoặc MP4)',
    'Ghi chú tư vấn',
    'Id remarketing',
    'Trạng thái thêm là 1 xóa 0',
  ]
  const example = [
    'AT-001',
    'Áo thun cotton',
    '["M","L"]',
    '[{"name":"Đen","img":"https://cdn.example.com/den.jpg"}]',
    '10',
    '199000',
    'https://cdn.example.com/main.jpg',
    '',
    '',
    '',
    '',
    '1',
  ]
  const ws = XLSX.utils.aoa_to_sheet([header, example])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'inventory')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const parsed = parseInventoryWorkbook(buf)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.rows[0]?.catalogFormat, 'legacy')
  assert.equal(parsed.rows[0]?.sku, 'AT-001')
  assert.equal(parsed.rows[0]?.catalog?.sizes.join(','), 'M,L')
})

test('188 listed=0 deletes by product id without requiring name', () => {
  const aoa = [
    [...CATALOG_188_EXCEL_COLUMNS],
    CATALOG_188_EXCEL_COLUMNS.map((col) => CATALOG_188_VI_HEADERS[col]),
    CATALOG_188_EXCEL_COLUMNS.map((col) => (col === 'id' ? 'A746-DEL' : col === 'listed' ? 0 : '')),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'inventory')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const parsed = parseInventoryWorkbook(buf)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.rows[0]?.removeFromInventory, true)
  assert.equal(parsed.rows[0]?.remarketing_id, 'A746-DEL')
})
