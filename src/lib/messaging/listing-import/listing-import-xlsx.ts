import * as XLSX from 'xlsx'
import { IMPORT_1688_EXCEL_COLUMNS, excelExportRowFromProductData } from '@/lib/messaging/listing-import/import-1688-excel-export-preview'

export function listingImportProductsXlsxBuffer(productDataRows: Record<string, unknown>[]): Buffer {
  const enHeaders = IMPORT_1688_EXCEL_COLUMNS.map(([k]) => k)
  const viHeaders = IMPORT_1688_EXCEL_COLUMNS.map(([, vi]) => vi)
  const aoa: (string | number)[][] = [enHeaders, viHeaders]
  for (const pd of productDataRows) {
    const row = excelExportRowFromProductData(pd)
    aoa.push(enHeaders.map((k) => (row[k] == null ? '' : row[k])))
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'products')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

const LISTING_LINK_HEADERS_EN = ['ID SP', 'Sku', 'Link SP', 'shop_name_chinese', 'China price', 'chinese_name']
const LISTING_LINK_HEADERS_VI = ['id', 'Sku', 'link', 'Shop Trung Quốc', 'Giá Tệ', 'Tên tiếng trung']

export function listingLinkTemplateXlsxBuffer(
  rows: Array<{
    product_id?: string
    url?: string
    shop_name_chinese?: string
    china_price?: number | null
    chinese_name?: string
  }>
): Buffer {
  const aoa: (string | number)[][] = [LISTING_LINK_HEADERS_EN, LISTING_LINK_HEADERS_VI]
  for (const r of rows) {
    const price = r.china_price
    aoa.push([
      String(r.product_id || ''),
      '',
      String(r.url || ''),
      String(r.shop_name_chinese || ''),
      typeof price === 'number' && Number.isFinite(price) ? price : '',
      String(r.chinese_name || ''),
    ])
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
