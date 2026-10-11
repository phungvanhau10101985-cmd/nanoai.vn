import * as XLSX from 'xlsx'
import {
  IMPORT_1688_EXCEL_COLUMNS,
  excelExportRowFromProductData,
  listingImportPyJson,
} from '@/lib/messaging/listing-import/import-1688-excel-export-preview'

/** SheetJS ném lỗi khi `cell.v.length > 32767`. */
const EXCEL_MAX_CELL_CHARS = 32767

type ArraySlot = {
  arr: unknown[]
  encoded: number
  set: (next: unknown[]) => void
}

type StringSlot = {
  value: string
  set: (next: string) => void
}

function jsonFits(value: unknown, max: number): boolean {
  return listingImportPyJson(value).length <= max
}

function largestArrayPrefix(arr: unknown[], accept: (prefix: unknown[]) => boolean): unknown[] {
  if (accept(arr)) return arr.slice()
  let best: unknown[] = []
  if (!accept(best)) return []
  let lo = 0
  let hi = arr.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const prefix = arr.slice(0, mid)
    if (accept(prefix)) {
      best = prefix
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  accept(best)
  return best
}

function shrinkStringUntil(value: string, accept: (next: string) => boolean): string {
  if (accept(value)) return value
  let best = ''
  if (!accept(best)) return ''
  let lo = 0
  let hi = value.length
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const cut = value.slice(0, mid)
    if (accept(cut)) {
      best = cut
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  accept(best)
  return best
}

function collectArraySlots(node: unknown, out: ArraySlot[]): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) collectArraySlots(item, out)
    return
  }
  const rec = node as Record<string, unknown>
  for (const key of Object.keys(rec)) {
    const child = rec[key]
    if (Array.isArray(child)) {
      out.push({
        arr: child,
        encoded: listingImportPyJson(child).length,
        set: (next) => {
          rec[key] = next
        },
      })
    }
    collectArraySlots(child, out)
  }
}

function collectStringSlots(node: unknown, out: StringSlot[]): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      if (typeof item === 'string') {
        if (item.length > 64) {
          out.push({
            value: item,
            set: (next) => {
              node[index] = next
            },
          })
        }
        return
      }
      collectStringSlots(item, out)
    })
    return
  }
  const rec = node as Record<string, unknown>
  for (const key of Object.keys(rec)) {
    const child = rec[key]
    if (typeof child === 'string') {
      if (child.length > 64) {
        out.push({
          value: child,
          set: (next) => {
            rec[key] = next
          },
        })
      }
      continue
    }
    collectStringSlots(child, out)
  }
}

/**
 * Ô Excel tối đa 32767 ký tự. JSON thì bớt mảng dài (price_pairs) từ cuối
 * để file vẫn parse được khi nhập lại.
 */
function shrinkJsonForExcel(root: unknown, max: number): unknown {
  if (jsonFits(root, max)) return root
  if (typeof root === 'string') return root.slice(0, max)
  if (typeof root !== 'object' || root == null) return root

  const current = JSON.parse(JSON.stringify(root)) as unknown
  if (Array.isArray(current)) {
    return largestArrayPrefix(current, (prefix) => jsonFits(prefix, max))
  }

  const rec = current as Record<string, unknown>
  const arrays: ArraySlot[] = []
  collectArraySlots(rec, arrays)
  arrays.sort((a, b) => b.encoded - a.encoded)
  for (const slot of arrays) {
    if (jsonFits(rec, max)) break
    const prefix = largestArrayPrefix(slot.arr, (next) => {
      slot.set(next)
      return jsonFits(rec, max)
    })
    slot.set(prefix)
  }
  if (jsonFits(rec, max)) return rec

  const strings: StringSlot[] = []
  collectStringSlots(rec, strings)
  strings.sort((a, b) => b.value.length - a.value.length)
  for (const slot of strings) {
    if (jsonFits(rec, max)) break
    const next = shrinkStringUntil(slot.value, (cut) => {
      slot.set(cut)
      return jsonFits(rec, max)
    })
    slot.set(next)
  }
  if (jsonFits(rec, max)) return rec

  const keys = Object.keys(rec).sort(
    (a, b) => listingImportPyJson(rec[b]).length - listingImportPyJson(rec[a]).length,
  )
  for (const key of keys) {
    if (jsonFits(rec, max)) break
    delete rec[key]
  }
  return jsonFits(rec, max) ? rec : {}
}

function fitExcelCell(value: string | number): string | number {
  if (typeof value !== 'string' || value.length <= EXCEL_MAX_CELL_CHARS) return value
  const trimmed = value.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const fitted = listingImportPyJson(shrinkJsonForExcel(parsed, EXCEL_MAX_CELL_CHARS))
      if (fitted.length <= EXCEL_MAX_CELL_CHARS) return fitted
    } catch {
      /* ô text thường */
    }
  }
  return value.slice(0, EXCEL_MAX_CELL_CHARS)
}

export function listingImportProductsXlsxBuffer(productDataRows: Record<string, unknown>[]): Buffer {
  const enHeaders = IMPORT_1688_EXCEL_COLUMNS.map(([k]) => k)
  const viHeaders = IMPORT_1688_EXCEL_COLUMNS.map(([, vi]) => vi)
  const aoa: (string | number)[][] = [enHeaders, viHeaders]
  for (const pd of productDataRows) {
    const row = excelExportRowFromProductData(pd)
    aoa.push(enHeaders.map((k) => fitExcelCell(row[k] == null ? '' : row[k])))
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

const LISTING_LINK_HEADERS_EN = [
  'ID SP',
  'Sku',
  'Link SP',
  'shop_name_chinese',
  'China price',
  'chinese_name',
]
const LISTING_LINK_HEADERS_VI = [
  'id',
  'Sku',
  'link',
  'Shop Trung Quốc',
  'Giá Tệ',
  'Tên tiếng trung',
]

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
