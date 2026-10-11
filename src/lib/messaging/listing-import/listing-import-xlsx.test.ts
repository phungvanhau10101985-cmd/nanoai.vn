import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as XLSX from 'xlsx'
import { excelExportRowFromProductData } from '@/lib/messaging/listing-import/import-1688-excel-export-preview'
import { listingImportProductsXlsxBuffer } from '@/lib/messaging/listing-import/listing-import-xlsx'

function cellAt(buf: Buffer, column: string): string {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets.Products, { header: 1, defval: '' })
  const headers = rows[0] ?? []
  const idx = headers.indexOf(column)
  assert.ok(idx >= 0, column)
  return String((rows[2] ?? [])[idx] ?? '')
}

describe('listing import excel cell limit', () => {
  it('keeps a short product_info cell unchanged', () => {
    const pd = {
      product_id: 'A1',
      name: 'Áo',
      product_info: { product_info: { name_vi: 'Áo' }, variants: { price_pairs: [{ color: 'Đỏ', size: 'S', price: 1000 }] } },
    }
    const expected = String(excelExportRowFromProductData(pd).product_info)
    const cell = cellAt(listingImportProductsXlsxBuffer([pd]), 'product_info')
    assert.equal(cell, expected)
    assert.ok(cell.length <= 32767)
  })

  it('writes a workbook when price_pairs exceed 32767 characters', () => {
    const pricePairs = Array.from({ length: 400 }, (_, i) => ({
      color: `Mau ${i} den bong`,
      size: i % 2 === 0 ? 'XL' : 'XXL',
      price: 120000 + i,
      price_cny: 35.5,
      sku_code: `SKU-${String(i).padStart(4, '0')}-LONG`,
    }))
    const pd = {
      product_id: 'A716797988680',
      name: 'Ao dai',
      description: 'Mo ta ngan',
      product_info: {
        product_info: { name_vi: 'Ao dai', sku: 'A716797988680' },
        variants: { source: 'vipomall', sizes: ['XL', 'XXL'], price_pairs: pricePairs },
      },
    }
    const raw = String(excelExportRowFromProductData(pd).product_info)
    assert.ok(raw.length > 32767, `expected oversized cell, got ${raw.length}`)

    const buf = listingImportProductsXlsxBuffer([pd])
    const cell = cellAt(buf, 'product_info')
    assert.ok(cell.length <= 32767, `cell length ${cell.length}`)
    const parsed = JSON.parse(cell) as { variants: { price_pairs: Array<{ sku_code: string }>; source: string } }
    assert.equal(parsed.variants.source, 'vipomall')
    assert.ok(parsed.variants.price_pairs.length > 0)
    assert.ok(parsed.variants.price_pairs.length < pricePairs.length)
    assert.equal(parsed.variants.price_pairs[0]?.sku_code, 'SKU-0000-LONG')
  })

  it('truncates a plain description that exceeds the cell limit', () => {
    const pd = {
      product_id: 'A2',
      name: 'Vay',
      description: 'x'.repeat(40000),
    }
    const cell = cellAt(listingImportProductsXlsxBuffer([pd]), 'pro_content')
    assert.equal(cell.length, 32767)
    assert.ok(cell.startsWith('x'))
  })
})
