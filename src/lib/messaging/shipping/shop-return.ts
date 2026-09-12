import { fetchPartnerOrderByPaymentReferenceForPartnerFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { insertPartnerOrderEventFromPg } from '@/lib/db/messaging-partner-orders-pg'
import {
  confirmPartnerShopReturnFromPg,
  fetchPartnerInventoryByWarehouseSkuFromPg,
  findPartnerEmsRecordByTokenFromPg,
  intakePartnerReturnWarehouseFromPg,
} from '@/lib/db/messaging-partner-ems-shipping-pg'
import { cellStr, extractWarehouseSkuFromEmsLabel, looksLikeRecipientNotSku, readSpreadsheetRows } from '@/lib/messaging/shipping/ems-excel'
import { parseWarehouseSourceSkuParts, resolveWarehouseIntakeHints } from '@/lib/messaging/fulfillment/warehouse-source-sku'

const CODE_SPLIT_RE = /[\s,;|\t]+/

export function classifyShopReturnStatus(input: {
  hasRecord: boolean
  alreadyReturned: boolean
  emsReportedReturn: boolean
}): { status: 'not_found' | 'already_returned' | 'ready_to_confirm' | 'not_ready'; message: string } {
  if (!input.hasRecord) {
    return { status: 'not_found', message: 'Không tìm thấy trong bảng vận chuyển EMS.' }
  }
  if (input.alreadyReturned) {
    return { status: 'already_returned', message: 'Shop đã xác nhận nhận hàng hoàn.' }
  }
  if (input.emsReportedReturn) {
    return { status: 'ready_to_confirm', message: 'EMS đã báo hoàn — có thể xác nhận trả shop.' }
  }
  return { status: 'not_ready', message: 'Chưa thấy mốc hoàn từ EMS (phát hoàn / chuyển hoàn).' }
}

export function parseWarehouseSkuParts(sku: string | null | undefined): { base: string; size: string; color: string } {
  const source = parseWarehouseSourceSkuParts(sku)
  if (source.kind !== 'unknown') {
    return {
      base: source.offerId,
      size: source.size,
      color: source.colorImageIndex != null ? String(source.colorImageIndex + 1) : '',
    }
  }
  const parts = String(sku || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
  return {
    base: parts[0] || '',
    size: parts[1] || '',
    color: parts[2] || '',
  }
}

function asNameList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) out.push(item.trim())
    else if (item && typeof item === 'object' && 'name' in item) {
      const name = String((item as { name?: unknown }).name || '').trim()
      if (name) out.push(name)
    }
  }
  return out
}

export function splitShopReturnTokens(text: string): string[] {
  const tokens: string[] = []
  for (const line of text.split(/\r?\n/)) {
    for (const part of line.split(CODE_SPLIT_RE)) {
      const t = part.trim()
      if (t) tokens.push(t)
    }
  }
  return tokens
}

export async function previewShopReturns(partnerId: string, rawText: string) {
  const tokens = splitShopReturnTokens(rawText)
  const rows = []
  for (const token of tokens) {
    const record = await findPartnerEmsRecordByTokenFromPg(partnerId, token)
    const orderCode = (record?.order_code || token).trim().toUpperCase()
    const order = orderCode ? await fetchPartnerOrderByPaymentReferenceForPartnerFromPg(partnerId, orderCode) : null
    const already = record ? isEmsRecordShopReturnReceived(record) : (order?.shipping_status || '') === 'returned'
    const classified = classifyShopReturnStatus({
      hasRecord: Boolean(record),
      alreadyReturned: already,
      emsReportedReturn: isEmsReturnPendingShop(record?.ems_status),
    })
    const status = classified.status
    const message =
      classified.status === 'not_found' ? `Không tìm thấy «${token}» trong bảng vận chuyển EMS.` : classified.message
    rows.push({
      input: token,
      order_code: record?.order_code || order?.payment_reference || null,
      ems_tracking_code: record?.ems_tracking_code || record?.reference_code || null,
      ems_status: record?.ems_status || null,
      status,
      message,
      ems_shipping_record_id: record?.id || null,
      order_id: record?.order_id || order?.id || null,
      product_code: record?.product_code || null,
    })
  }
  const ready = rows.filter((r) => r.status === 'ready_to_confirm').length
  const alreadyReturned = rows.filter((r) => r.status === 'already_returned').length
  return {
    rows,
    total: rows.length,
    ready,
    confirmable_count: ready,
    already_returned_count: alreadyReturned,
    error_count: rows.length - ready - alreadyReturned,
  }
}

export async function confirmShopReturns(input: {
  partnerId: string
  rawText: string
  userId?: string | null
}) {
  const preview = await previewShopReturns(input.partnerId, input.rawText)
  const confirmed = []
  for (const row of preview.rows) {
    if (row.status !== 'ready_to_confirm' || !row.ems_shipping_record_id) {
      confirmed.push(row)
      continue
    }
    const updated = await confirmPartnerShopReturnFromPg({
      partnerId: input.partnerId,
      recordId: row.ems_shipping_record_id,
      orderId: row.order_id,
    })
    if (row.order_id) {
      await insertPartnerOrderEventFromPg({
        orderId: row.order_id,
        eventType: 'shipping_status',
        title: 'Đơn hoàn đã trả shop',
        detail: row.ems_tracking_code ? `EMS ${row.ems_tracking_code}` : row.input,
        source: 'shop',
        createdBy: input.userId || undefined,
      })
    }
    confirmed.push({
      ...row,
      status: 'confirmed',
      message: 'Đã xác nhận hoàn trả shop.',
      order_status: updated?.order_status || 'returned',
    })
  }
  return {
    rows: confirmed,
    confirmed: confirmed.filter((r) => r.status === 'confirmed').length,
    confirmed_count: confirmed.filter((r) => r.status === 'confirmed').length,
    error_count: confirmed.filter((r) => r.status !== 'confirmed' && r.status !== 'already_returned').length,
    already_returned_count: confirmed.filter((r) => r.status === 'already_returned').length,
  }
}

export function parseShopReturnExcelTokens(fileBytes: Buffer): string[] {
  const raw = readSpreadsheetRows(fileBytes)
  const tokens: string[] = []
  for (const row of raw.slice(1)) {
    const v = cellStr(row[0])
    if (v) tokens.push(v)
  }
  return tokens
}

export async function resolveReturnWarehouseSku(partnerId: string, code: string) {
  const token = code.trim()
  const record = await findPartnerEmsRecordByTokenFromPg(partnerId, token)
  const fromRecord = record?.product_code && !looksLikeRecipientNotSku(record.product_code)
    ? extractWarehouseSkuFromEmsLabel(record.product_code)
    : null
  const sku = fromRecord || extractWarehouseSkuFromEmsLabel(token)
  if (!sku) return { sku: null, record, inventory: null, error: 'Không đọc được SKU kho từ mã này.' }
  const inventory = await fetchPartnerInventoryByWarehouseSkuFromPg(partnerId, sku)
  const inv = inventory as Record<string, unknown> | null
  const colors = asNameList(inv?.colors_json)
  const sizes = asNameList(inv?.sizes_json)
  const gallery = Array.isArray(inv?.gallery_urls)
    ? (inv?.gallery_urls as unknown[]).map((url) => String(url || '').trim()).filter(Boolean)
    : []
  const hints = resolveWarehouseIntakeHints({
    sku: String(inv?.sku || sku),
    colors,
    sizes,
    galleryUrls: gallery,
  })
  return {
    sku,
    record,
    inventory: inventory
      ? {
          ...inventory,
          colors,
          sizes,
          parsed_size: hints.size,
          parsed_color: hints.color,
          parsed_base: hints.base,
          parsed_color_image_index: hints.colorImageIndex,
          parsed_color_image_url: hints.colorImageUrl,
        }
      : null,
    error: inventory ? null : `Không thấy SKU «${sku}» trong tồn kho shop.`,
  }
}

export async function intakeReturnWarehouse(input: {
  partnerId: string
  code: string
  qty: number
  markClearance: boolean
}) {
  const resolved = await resolveReturnWarehouseSku(input.partnerId, input.code)
  if (!resolved.inventory || resolved.error) return { ok: false, error: resolved.error || 'Không tìm thấy SKU.' }
  const before = Number(resolved.inventory.stock_qty || 0)
  const updated = await intakePartnerReturnWarehouseFromPg({
    partnerId: input.partnerId,
    inventoryId: String(resolved.inventory.id),
    qty: input.qty,
    markClearance: input.markClearance,
  })
  const added = Math.max(1, Math.floor(input.qty))
  return {
    ok: true,
    sku: resolved.sku,
    inventory: updated,
    added,
    quantity_added: added,
    available_before: before,
    available_after: Number(updated?.stock_qty ?? before + added),
    clearance: input.markClearance,
    message: `Đã cộng ${added} vào tồn «${resolved.sku}» (${before} → ${Number(updated?.stock_qty ?? before + added)}).`,
  }
}
