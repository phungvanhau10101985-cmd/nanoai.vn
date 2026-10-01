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

/** Ghi cost_cny từ số tệ đã cào. Không đụng giá bán. Bỏ qua nếu đã có một trong hai giá nhập. */
export function stampScrapedCostCny(payload: Record<string, unknown>): void {
  if (scrapedCnyAmount(payload.cost_cny) != null || scrapedCnyAmount(payload.cost_vnd) != null) return
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
}

/** Một sản phẩm chỉ có một giá nhập. Cả hai cùng có số thì không ghi cột nào. */
export function singleImportCost(
  cny: unknown,
  vnd: unknown
): { costCny: number | null; costVnd: number | null; both: boolean } {
  const costCny = scrapedCnyAmount(cny)
  const costVnd = scrapedCnyAmount(vnd)
  if (costCny != null && costVnd != null) return { costCny: null, costVnd: null, both: true }
  return { costCny, costVnd, both: false }
}
