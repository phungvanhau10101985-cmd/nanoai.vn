/** Giá vốn đơn shop: hàng tệ × tỷ giá, hàng Việt Nam / sale kho theo giá nhập đồng (sale = 0đ). */

import { scrapedCnyAmount } from '@/lib/messaging/listing-import/import-cost'
import { listingVndToCny } from '@/lib/messaging/listing-import/taobao-cards-html-parse'

export const PROFIT_ORDER_LIMIT = 400
export const DEFAULT_PROFIT_VND_PER_CNY = 3580

export type ProfitImportLine = {
  quantity: number
  costCny: number | null
  costVnd: number | null
  isWarehouse: boolean
  isClearance: boolean
}

export type ProfitCatalogLine = {
  quantity: number
  unitPriceVnd: number
  lineTotalVnd: number
  catalogRaw: unknown
  costCny: number | null
  costVnd: number | null
  isWarehouse: boolean
  isClearance: boolean
}

export type ProfitImportSummary = {
  goodsCny: number
  goodsVnd: number
  usesChinaShip: boolean
}

function finite(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return value
}

/** Giá thu = tiền hàng sau sale. Không gồm phí ship khách trả và không trừ ví. */
export function collectedGoodsVnd(subtotal: number, discount: number, amountAfterDiscount = 0): number {
  const sub = Math.max(0, Number(subtotal) || 0)
  const off = Math.max(0, Number(discount) || 0)
  if (sub > 0 || off > 0) return Math.max(0, Math.round(sub - off))
  return Math.max(0, Math.round(Number(amountAfterDiscount) || 0))
}

export function uncollectedGoodsVnd(merchandiseVnd: number, depositPaid: number): number {
  const paid = Math.max(0, Number(depositPaid) || 0)
  return Math.max(0, merchandiseVnd - paid)
}

/** Đơn thường giữ nguyên giá hàng. Đơn hoàn chỉ giữ phần đã cọc. */
export function recognizedGoodsVnd(merchandiseVnd: number, depositPaid: number, returned: boolean): number {
  if (!returned) return merchandiseVnd
  return merchandiseVnd - uncollectedGoodsVnd(merchandiseVnd, depositPaid)
}

function lineListingCny(
  quantity: number,
  unitVnd: number,
  catalogRaw: unknown,
  vndPerCny: number,
  lineTotalVnd: number,
): number | null {
  if (!Number.isFinite(vndPerCny) || vndPerCny <= 0) return null
  const qty = Math.round(quantity)
  const catalog = scrapedCnyAmount(catalogRaw)
  if (catalog != null && qty > 0) return catalog * qty
  if (unitVnd > 0 && qty > 0) {
    const inverted = listingVndToCny(unitVnd, vndPerCny)
    if (inverted != null) return inverted * qty
  }
  if (lineTotalVnd > 0) {
    const inverted = listingVndToCny(lineTotalVnd, vndPerCny)
    if (inverted != null) return inverted
  }
  return null
}

/** Cộng giá tệ từng dòng. Dòng không đảo được thì lấy giá hàng cả đơn. */
export function goodsCnyMatchingListing(
  lines: Array<Pick<ProfitCatalogLine, 'quantity' | 'unitPriceVnd' | 'lineTotalVnd' | 'catalogRaw'>>,
  vndPerCny: number | null,
  merchandiseVnd: number,
): number | null {
  if (vndPerCny == null || !Number.isFinite(vndPerCny) || vndPerCny <= 0) return null
  if (lines.length) {
    let total = 0
    let complete = true
    for (const line of lines) {
      const part = lineListingCny(line.quantity, line.unitPriceVnd, line.catalogRaw, vndPerCny, line.lineTotalVnd)
      if (part == null) {
        complete = false
        break
      }
      total += part
    }
    if (complete) return Math.round(total * 100) / 100
  }
  if (!(merchandiseVnd > 0)) return null
  const inverted = listingVndToCny(merchandiseVnd, vndPerCny)
  return inverted == null ? null : Math.round(inverted * 100) / 100
}

export function unitCatalogCny(raw: unknown): number | null {
  const parsed = scrapedCnyAmount(raw)
  return parsed == null ? null : Math.round(parsed * 100) / 100
}

/** Thành tiền nhập một dòng. Hàng sale / kho không có giá thì 0đ. */
export function lineStoredImport(line: ProfitImportLine): { kind: 'cny' | 'vnd'; amount: number } | null {
  const qty = Math.round(line.quantity)
  if (!Number.isFinite(qty) || qty <= 0) return null
  const cny = finite(line.costCny)
  if (cny != null && cny > 0) return { kind: 'cny', amount: cny * qty }
  const vnd = finite(line.costVnd)
  if (vnd != null) return { kind: 'vnd', amount: vnd * qty }
  if (line.isWarehouse || line.isClearance) return { kind: 'vnd', amount: 0 }
  return null
}

export function summarizeStoredImport(lines: ProfitImportLine[]): ProfitImportSummary | null {
  if (!lines.length) return null
  let goodsCny = 0
  let goodsVnd = 0
  let usesChinaShip = false
  for (const line of lines) {
    const part = lineStoredImport(line)
    if (!part) return null
    if (part.kind === 'vnd') goodsVnd += part.amount
    else {
      goodsCny += part.amount
      usesChinaShip = true
    }
  }
  return { goodsCny, goodsVnd, usesChinaShip }
}

export function orderCostVnd(input: {
  goodsCny: number
  goodsVnd: number
  usesChinaShip: boolean
  shipChinaCny: number
  shipBorderCny: number
  shipHanoiVnd: number
  vndPerCny: number
}): number | null {
  const rate = input.vndPerCny
  const shipCny = input.usesChinaShip ? Math.max(0, input.shipChinaCny) + Math.max(0, input.shipBorderCny) : 0
  const needsRate = input.usesChinaShip || input.goodsCny > 0 || shipCny > 0
  if (needsRate && (!Number.isFinite(rate) || rate <= 0)) return null
  return input.goodsVnd + (input.goodsCny + shipCny) * (needsRate ? rate : 0) + Math.max(0, input.shipHanoiVnd)
}

export type ProfitSheetLine = {
  quantity: number
  unitPriceVnd: number
  lineTotalVnd: number
  catalogCny: number | null
}

export type ProfitSheetOrder = {
  orderId: string
  orderCode: string
  depositedOn: string
  revenueVnd: number
  merchandiseVnd: number
  returned: boolean
  uncollectedVnd: number
  lines: ProfitSheetLine[]
  catalogGoodsCny: number | null
  goodsVnd: number
  usesChinaShip: boolean
  importStored: boolean
  goodsCnyOverride: number | null
  shipChinaOverride: number | null
  shipBorderOverride: number | null
  shipHanoiOverride: number | null
}

export type ProfitOrderDraft = {
  orderId: string
  orderCode: string
  depositedOn: string
  subtotal: number
  discount: number
  amountAfterDiscount: number
  paidAmount: number
  returned: boolean
  lines: ProfitCatalogLine[]
  goodsCnyOverride: number | null
  shipChinaOverride: number | null
  shipBorderOverride: number | null
  shipHanoiOverride: number | null
}

function moneyOrNull(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

/** Một đơn trên bảng hạch toán: giá thu đã cọc, giá tệ catalog hoặc giá nhập đã lưu, override để trống thì null. */
export function assembleProfitOrder(draft: ProfitOrderDraft, vndPerCny: number): ProfitSheetOrder {
  const merchandise = collectedGoodsVnd(draft.subtotal, draft.discount, draft.amountAfterDiscount)
  const returned = draft.returned
  const uncollected = returned ? uncollectedGoodsVnd(merchandise, draft.paidAmount) : 0
  const stored = summarizeStoredImport(draft.lines)
  let catalog: number | null
  let goodsVnd = 0
  let usesChinaShip = true
  if (stored) {
    catalog = Math.round(stored.goodsCny * 100) / 100
    goodsVnd = Math.round(stored.goodsVnd)
    usesChinaShip = stored.usesChinaShip
  } else {
    catalog = goodsCnyMatchingListing(draft.lines, vndPerCny, merchandise)
    goodsVnd = 0
    usesChinaShip = true
  }
  return {
    orderId: draft.orderId,
    orderCode: draft.orderCode,
    depositedOn: draft.depositedOn,
    revenueVnd: recognizedGoodsVnd(merchandise, draft.paidAmount, returned),
    merchandiseVnd: merchandise,
    returned,
    uncollectedVnd: Math.round(uncollected),
    lines: draft.lines.map((line) => ({
      quantity: Math.max(0, Math.round(line.quantity)),
      unitPriceVnd: Math.max(0, Math.round(line.unitPriceVnd || 0)),
      lineTotalVnd: Math.max(0, Math.round(line.lineTotalVnd || 0)),
      catalogCny: unitCatalogCny(line.catalogRaw),
    })),
    catalogGoodsCny: catalog,
    goodsVnd,
    usesChinaShip,
    importStored: stored != null,
    goodsCnyOverride: moneyOrNull(draft.goodsCnyOverride),
    shipChinaOverride: moneyOrNull(draft.shipChinaOverride),
    shipBorderOverride: moneyOrNull(draft.shipBorderOverride),
    shipHanoiOverride: moneyOrNull(draft.shipHanoiOverride),
  }
}
