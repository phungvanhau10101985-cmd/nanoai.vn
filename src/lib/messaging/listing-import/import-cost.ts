/** Giá nhập gốc — không phải giá bán. Hàng Trung Quốc: tệ lúc cào. Hàng Việt Nam: đồng, nhập tay. */

const CHINA_TOKENS = ['1688', 'taobao', 'tmall', 'vipomall', 'pandamall']

export function scrapedCnyAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text) return null
  if (/[A-Za-z\u00C0-\u024F\u1EA0-\u1EF9]/.test(text)) return null
  const n = Number(text.replace(/¥/g, '').replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function looksLikeChinaSource(origin: unknown, link: unknown): boolean {
  const blob = `${typeof origin === 'string' ? origin : ''} ${typeof link === 'string' ? link : ''}`.toLowerCase()
  return CHINA_TOKENS.some((token) => blob.includes(token))
}

function listingVndPerCnyForCost(): number {
  const n = Number(process.env.LISTING_IMPORT_VND_PER_CNY)
  if (Number.isFinite(n) && n > 0) return n
  return 3580
}

/** Giá gốc tiền Việt = giá gốc tiền tệ × tỷ giá. Không cộng hệ số lưới bán. */
export function sourceCostVndFromCny(cny: number): number {
  return Math.round(cny * listingVndPerCnyForCost())
}

/** Ghi giá gốc tệ và giá gốc tiền Việt từ số tệ đã cào. Không đụng giá bán. Hàng đã có giá Việt Nam thì giữ. */
export function stampScrapedCostCny(payload: Record<string, unknown>): void {
  const existingCny = scrapedCnyAmount(payload.cost_cny)
  const existingVnd = scrapedCnyAmount(payload.cost_vnd)
  if (existingCny != null) {
    if (existingVnd == null) payload.cost_vnd = sourceCostVndFromCny(existingCny)
    return
  }
  if (existingVnd != null) return
  let amount = scrapedCnyAmount(payload.pro_lower_price)
  if (amount == null) {
    const info = payload.product_info
    const market =
      info && typeof info === 'object' && !Array.isArray(info)
        ? (info as Record<string, unknown>).market_info
        : null
    if (market && typeof market === 'object' && !Array.isArray(market)) {
      const m = market as Record<string, unknown>
      amount = scrapedCnyAmount(m.price_cny_low)
      if (amount == null) amount = scrapedCnyAmount(m.source_price)
    }
  }
  if (amount == null) return
  const link = payload.link_default || payload.source_url || payload.product_url
  if (!looksLikeChinaSource(payload.origin, link)) return
  payload.cost_cny = amount
  payload.cost_vnd = sourceCostVndFromCny(amount)
}

/** Đọc cả hai cột giá gốc. Cả hai cùng có số thì giữ cả hai. */
export function singleImportCost(
  cny: unknown,
  vnd: unknown
): { costCny: number | null; costVnd: number | null; both: boolean } {
  const costCny = scrapedCnyAmount(cny)
  const costVnd = scrapedCnyAmount(vnd)
  return { costCny, costVnd, both: costCny != null && costVnd != null }
}
