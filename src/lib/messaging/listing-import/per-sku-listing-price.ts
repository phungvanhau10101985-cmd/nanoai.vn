const CJK_RE = /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/
const MODEL_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._+\-]{2,}$/

/** Mã kiểu 2W41-15GBN-AC220V giữ nguyên. Tên màu tiếng Trung không thuộc dạng này. */
export function listingLabelIsModelCode(name: string): boolean {
  const s = (name || '').trim()
  if (!s || s.includes(' ')) return false
  if (CJK_RE.test(s)) return false
  return MODEL_CODE_RE.test(s) && /\d/.test(s)
}

export function parseCnyAmount(raw: unknown): number {
  let s = String(raw ?? '')
    .trim()
    .replace(/¥/g, '')
    .replace(/\s/g, '')
  if (!s) return 0
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = Number(s.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function formatCnyCell(priceCny: number): string {
  if (!Number.isFinite(priceCny) || priceCny <= 0) return ''
  return priceCny.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

export function positiveVnd(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function normKey(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

export function inventoryCardTieredPrices(row: {
  is_clearance?: boolean | null
  tiered_prices?: boolean | null
  colors_json?: unknown
}): boolean {
  if (row.is_clearance === true) return false
  if (row.tiered_prices === true) return true
  return colorsHaveTieredPrices(row.colors_json)
}

export function colorsHaveTieredPrices(colors: unknown): boolean {
  if (!Array.isArray(colors)) return false
  const prices = new Set<number>()
  for (const item of colors) {
    if (!item || typeof item !== 'object') continue
    const price = positiveVnd((item as { price?: unknown }).price)
    if (price) prices.add(price)
    if (prices.size >= 2) return true
  }
  return false
}

/** Giá niêm yết của mã đang chọn. Không có giá trên màu thì null — caller giữ giá sản phẩm. */
export function storedVariantListPrice(input: {
  colors: unknown
  productInfo: unknown
  colorName: string
  sizeName?: string | null
}): number | null {
  const color = normKey(input.colorName)
  const size = normKey(input.sizeName)
  const info =
    input.productInfo && typeof input.productInfo === 'object' && !Array.isArray(input.productInfo)
      ? (input.productInfo as Record<string, unknown>)
      : null
  const variants =
    info?.variants && typeof info.variants === 'object' && !Array.isArray(info.variants)
      ? (info.variants as Record<string, unknown>)
      : null
  const pairSource = Array.isArray(variants?.price_pairs)
    ? variants.price_pairs
    : Array.isArray(variants?.pairs)
      ? variants.pairs
      : []
  if (color && size) {
    for (const pair of pairSource) {
      if (!pair || typeof pair !== 'object') continue
      const rec = pair as Record<string, unknown>
      if (normKey(rec.color) !== color || normKey(rec.size) !== size) continue
      const price = positiveVnd(rec.price)
      if (price) return price
    }
  }
  if (!color || !Array.isArray(input.colors)) return null
  for (const item of input.colors) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    if (normKey(rec.name || rec.label) !== color) continue
    const price = positiveVnd(rec.price)
    if (price) return price
  }
  return null
}

const PRICE_FROM: Record<string, string> = {
  vi: 'từ',
  en: 'from',
  zh: '低至',
  ja: '〜',
  ko: '최저',
}

export function listingPricePrefix(locale: string, tiered: boolean, clearance = false): string {
  if (!tiered || clearance) return ''
  const word = PRICE_FROM[locale] || PRICE_FROM.en
  return word ? `${word} ` : ''
}

/** Runtime HTML grids: prefix the formatted price when the card is tiered. */
export function listingPricePrefixRuntimeJs(locale: string): string {
  const word = PRICE_FROM[locale] || PRICE_FROM.en || ''
  return `function priceFromPrefix(p){
  if(!p||p.isClearance===true||p.is_clearance===true)return '';
  var tiered=p.tieredPrices===true||p.tiered_prices===true;
  if(!tiered&&Array.isArray(p.colors)){
    var seen={},n=0;
    for(var i=0;i<p.colors.length;i++){
      var price=Math.round(Number(p.colors[i]&&p.colors[i].price)||0);
      if(price>0&&!seen[price]){seen[price]=1;n++;if(n>=2){tiered=true;break;}}
    }
  }
  if(!tiered)return '';
  return ${JSON.stringify(word ? `${word} ` : '')};
}`
}

type PricedProduct = {
  priceAmount?: number | null
  salePriceAmount?: number | null
  siteSaleExpectedPrice?: number | null
  siteSale?: {
    listPrice: number
    displayPrice: number
    savingsAmount: number
    expectedSalePrice: number | null
    percent: number
  } | null
  isClearance?: boolean
  colors?: { name: string; price?: number | null }[] | null
}

/** Khi mã đang chọn khác giá rẻ nhất, nhân lại giá sale theo cùng tỷ lệ. */
export function shopProductForSelectedColor<T extends PricedProduct>(product: T, colorName: string): T {
  if (product.isClearance) return product
  const list = storedVariantListPrice({ colors: product.colors, productInfo: null, colorName })
  const base = Math.round(Number(product.priceAmount) || 0)
  if (!list || !base || Math.abs(list - base) < 1) return product
  const ratio = list / base
  const scale = (amount: number | null | undefined) => {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0 || n >= base) return amount ?? null
    return Math.round(n * ratio)
  }
  const salePriceAmount = scale(product.salePriceAmount)
  const site = product.siteSale
  const expected = scale(site?.expectedSalePrice ?? product.siteSaleExpectedPrice)
  const nextSale = site
    ? {
        ...site,
        listPrice: list,
        displayPrice:
          salePriceAmount != null && salePriceAmount > 0 && salePriceAmount < list
            ? salePriceAmount
            : list,
        expectedSalePrice: expected,
        savingsAmount:
          salePriceAmount != null && salePriceAmount > 0 && salePriceAmount < list
            ? list - salePriceAmount
            : site.savingsAmount,
      }
    : site
  return {
    ...product,
    priceAmount: list,
    salePriceAmount,
    siteSaleExpectedPrice: expected,
    siteSale: nextSale,
  }
}
