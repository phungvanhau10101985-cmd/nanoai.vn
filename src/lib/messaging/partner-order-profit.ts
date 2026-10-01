/** Giá vốn đơn shop: hàng tệ × tỷ giá, hàng Việt Nam / sale kho theo giá nhập đồng (sale = 0đ). */

export type ProfitImportLine = {
  quantity: number
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

export function collectedGoodsVnd(amountAfterDiscount: number, subtotal: number): number {
  const after = Math.max(0, Math.round(amountAfterDiscount || 0))
  const sub = Math.max(0, Math.round(subtotal || 0))
  return after > 0 ? after : sub
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
