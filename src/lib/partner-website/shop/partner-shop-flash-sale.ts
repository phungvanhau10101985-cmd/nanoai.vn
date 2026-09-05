/** W1.4 — lightweight flash sale window helpers (no bundle). */

export type FlashSaleFields = {
  priceAmount: number | null
  salePriceAmount: number | null
  saleStartsAt: string | null
  saleEndsAt: string | null
}

/** 0 / null / leftover empty = no sale. `Number(null) === 0` must not become −100%. */
export function normalizePartnerSalePriceAmount(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

export function isPartnerFlashSaleActive(fields: FlashSaleFields, nowMs = Date.now()): boolean {
  const sale = normalizePartnerSalePriceAmount(fields.salePriceAmount)
  if (sale == null) return false
  const base = fields.priceAmount
  if (base != null && Number.isFinite(base) && sale >= base) return false
  const start = fields.saleStartsAt ? Date.parse(fields.saleStartsAt) : NaN
  const end = fields.saleEndsAt ? Date.parse(fields.saleEndsAt) : NaN
  if (Number.isFinite(start) && nowMs < start) return false
  if (Number.isFinite(end) && nowMs >= end) return false
  return true
}

/** Storefront catalog/PDP cards — reject null/0 so leftover JSON does not paint −100% / 0đ. */
export const PW_SALE_VIEW_JS = `function saleView(p){
  if(!p||p.salePriceAmount==null||p.salePriceAmount==='')return null;
  var list=Number(p.priceAmount),sale=Number(p.salePriceAmount);
  if(!Number.isFinite(list)||list<=0||!Number.isFinite(sale)||sale<=0||sale>=list)return null;
  var now=Date.now(),start=p.saleStartsAt?Date.parse(p.saleStartsAt):NaN,end=p.saleEndsAt?Date.parse(p.saleEndsAt):NaN;
  if(Number.isFinite(start)&&now<start)return null;
  if(Number.isFinite(end)&&now>end)return null;
  return {price:money(sale),compare:money(list),percent:Math.max(1,Math.round((list-sale)*100/list))};
}`

export function resolvePartnerEffectiveUnitPrice(fields: FlashSaleFields, nowMs = Date.now()): number | null {
  if (isPartnerFlashSaleActive(fields, nowMs)) return fields.salePriceAmount
  return fields.priceAmount != null && Number.isFinite(fields.priceAmount) ? fields.priceAmount : null
}

export function formatPartnerShopMoneyVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}₫`
}
