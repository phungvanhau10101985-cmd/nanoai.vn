/**
 * Trích thông số / CNY từ PDP Vipomall·PandaMall — khớp `_extract_body_specs`
 * của scraper 1688 trên 188 (bảng 货号 / 颜色 / 尺码) + bảng «Thông số sản phẩm»
 * (innerText CJK `nhãn: giá trị`) vốn scrape JS 188 không gom vì root «Chi tiết sản phẩm».
 */
import { estimateCnyFromVnd } from './scrape-common'

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const s = raw.trim()
    if (!s) continue
    const k = s.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out
}

export function listingImportBodyBlob(row: Record<string, unknown>): string {
  const extras = Array.isArray(row.info_texts) ? row.info_texts.map((x) => String(x ?? '')) : []
  return [row.body_text_sample, row.description_text, ...extras]
    .map((x) => String(x || ''))
    .filter(Boolean)
    .join('\n')
}

function splitSpecList(raw: string): string[] {
  return dedupe(raw.split(/[、,，+/;]\s*/).map((p) => p.trim()).filter(Boolean))
}

function firstLineAfterLabel(bodyText: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(`${label}[：:\\t\\s]*([^\\n]+)`, 'i')
    const m = bodyText.match(re)
    if (m) return m[1].trim()
  }
  return ''
}

/** Khớp 188 `import_1688_scraper._extract_body_specs` + bảng «Thông số sản phẩm» tiếng Việt trên Vipomall. */
export function extract1688BodySpecs(bodyText: string): {
  colors_label: string[]
  sizes_label: string[]
  article_no: string
} {
  const out = { colors_label: [] as string[], sizes_label: [] as string[], article_no: '' }
  if (!bodyText) return out
  const colorM = bodyText.match(/颜色[：:\t\s]*([\u4e00-\u9fffA-Za-z0-9，、,\s/+]+)/)
  if (colorM) {
    out.colors_label = splitSpecList(colorM[1].trim().split('\n')[0]).slice(0, 30)
  } else {
    const viColor = firstLineAfterLabel(bodyText, ['Màu sắc'])
    if (viColor) out.colors_label = splitSpecList(viColor).slice(0, 30)
  }
  const sizeM = bodyText.match(/尺码[：:\t\s]*([0-9A-Za-z\s，、,.-]+)/)
  if (sizeM) {
    out.sizes_label = dedupe(sizeM[1].trim().split('\n')[0].split(/[、,，/\s]+\s*/).map((p) => p.trim()).filter(Boolean)).slice(0, 60)
  } else {
    const viSize = firstLineAfterLabel(bodyText, ['Kích cỡ'])
    if (viSize) {
      out.sizes_label = dedupe(viSize.split(/[、,，/\s]+\s*/).map((p) => p.trim()).filter(Boolean)).slice(0, 60)
    }
  }
  const skuM = bodyText.match(/货号[：:\t\s]*([A-Za-z0-9_-]+)/)
  if (skuM) out.article_no = skuM[1].trim().slice(0, 120)
  else {
    const viSku = bodyText.match(/Mã hàng[：:\t\s]*([A-Za-z0-9_-]+)/i)
    if (viSku) out.article_no = viSku[1].trim().slice(0, 120)
  }
  return out
}

function thongSoSection(body: string): string {
  const marker = 'Thông số sản phẩm'
  const idx = body.lastIndexOf(marker)
  if (idx < 0) return body
  let slice = body.slice(idx + marker.length)
  const stop = slice.search(/\n(Đóng|Nền tảng mua hàng|Hỗ trợ khách hàng|Trung tâm hỗ trợ)\b/)
  if (stop >= 0) slice = slice.slice(0, stop)
  return slice
}

const ATTR_KEY_RE = /^([\p{L}\p{N}/%％（）()._\- ]{1,80}?)\s*[:：]\s*(.*)$/u
const BARE_KEY_RE = /^[\p{L}\p{N}/%％（）()._\- ]{1,80}?\s*[:：]\s*$/u
const ATTR_NOISE_RE = /^(Xem thêm|Thu gọn|Đóng|Sản phẩm gốc|Nhà bán|Mua ngay|Thêm giỏ)$/i

function isAttrKey(key: string): boolean {
  if (!key || ATTR_NOISE_RE.test(key)) return false
  if (/[\u3400-\u9fff]/.test(key)) return true
  if (key === 'S' || /货号|尺码|颜色/.test(key)) return true
  return /\p{L}/u.test(key) && key.length <= 80
}

/** Bảng thuộc tính 1688 trên Vipomall (CJK hoặc nhãn tiếng Việt «Thông số sản phẩm»). */
export function extractCjkAttributePairs(bodyText: string): Record<string, string> {
  const section = thongSoSection(bodyText || '')
  const out: Record<string, string> = {}
  const lines = section
    .split(/\n/)
    .map((l) => l.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ATTR_KEY_RE)
    if (!m) continue
    const key = m[1].trim()
    let val = (m[2] || '').trim()
    if (!val && i + 1 < lines.length) {
      const nxt = lines[i + 1]
      const nxtIsBareKey = BARE_KEY_RE.test(nxt)
      if (!nxtIsBareKey && !ATTR_NOISE_RE.test(nxt)) {
        val = nxt
        i += 1
      }
    }
    if (!isAttrKey(key) || !val || ATTR_NOISE_RE.test(val)) continue
    out[key] = val.slice(0, 400)
  }
  return out
}

function formatCny(val: number): string {
  return String(val.toFixed(4)).replace(/0+$/, '').replace(/\.$/, '')
}

function parseCnyToken(raw: string): number | null {
  const s = raw.trim().replace(/,/g, '')
  if (!s) return null
  const val = Number.parseFloat(s)
  if (!Number.isFinite(val) || val <= 0 || val >= 9_999_999) return null
  return val
}

/**
 * CNY: `cny_price_texts` → prefix ¥/元 trên `price_texts` (188 Vipomall)
 * → suffix `349元` / «限售价格» trong body (scraper 1688) → ước từ VNĐ.
 */
export function pickCnyPriceFromScrapeRow(row: Record<string, unknown>, priceVnd: number): string {
  for (const raw of (row.cny_price_texts as unknown[]) || []) {
    const val = parseCnyToken(String(raw || ''))
    if (val != null) return formatCny(val)
  }
  for (const t of (row.price_texts as unknown[]) || []) {
    const m = /(?:¥|￥|CNY|元)\s*([\d.,]+)/.exec(String(t))
    if (m) {
      const val = parseCnyToken(m[1])
      if (val != null) return formatCny(val)
    }
  }
  const body = listingImportBodyBlob(row)
  const floor = body.match(/限售价格[^0-9]{0,12}([\d.,]+)\s*元/)
  if (floor) {
    const val = parseCnyToken(floor[1])
    if (val != null) return formatCny(val)
  }
  const suffix = body.match(/([\d.,]+)\s*元/)
  if (suffix) {
    const val = parseCnyToken(suffix[1])
    if (val != null) return formatCny(val)
  }
  const prefix = /(?:¥|￥|CNY|元)\s*([\d.,]+)/.exec(body)
  if (prefix) {
    const val = parseCnyToken(prefix[1])
    if (val != null) return formatCny(val)
  }
  return estimateCnyFromVnd(priceVnd)
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function hasCjk(s: string): boolean {
  return /[\u3400-\u9fff]/.test(s)
}

function pairValue(pairs: Record<string, string>, ...keys: string[]): string {
  const entries = Object.entries(pairs)
  for (const needle of keys) {
    const n = needle.trim().toLocaleLowerCase()
    for (const [k, v] of entries) {
      if (k.trim().toLocaleLowerCase() === n) return String(v || '').trim()
    }
  }
  return ''
}

function viSpecValue(pairs: Record<string, string>, ...keys: string[]): string {
  const v = pairValue(pairs, ...keys)
  if (!v || hasCjk(v)) return ''
  return v
}

function fillIfEmpty(target: Record<string, unknown>, key: string, value: string, max = 400): void {
  if (!value) return
  if (String(target[key] || '').trim()) return
  target[key] = value.slice(0, max)
}

/**
 * Gắn bảng thông số 1688 / Vipomall vào `product_info` + cột Excel style/material/occasion/features.
 * Giá trị CJK chỉ vào spec; cột tiếng Việt chỉ nhận nhãn đã dịch.
 */
export function enrichListingProductDataFromBody(
  productData: Record<string, unknown>,
  row: Record<string, unknown>
): void {
  const body = listingImportBodyBlob(row)
  if (!body.trim()) return
  const pairs = extractCjkAttributePairs(body)
  const bodySpecs = extract1688BodySpecs(body)
  const articleNo =
    bodySpecs.article_no || pairValue(pairs, '货号', 'Mã hàng')

  const pi = asRecord(productData.product_info)
  const inner = asRecord(pi.product_info)
  const spec = asRecord(pi.specifications)

  if (articleNo) {
    inner.article_no = articleNo.slice(0, 120)
    if (!String(inner.sku || '').trim()) inner.sku = articleNo.slice(0, 120)
  }
  const sizesNow = Array.isArray(productData.sizes) ? productData.sizes : []
  if (!sizesNow.length && bodySpecs.sizes_label.length) {
    productData.sizes = bodySpecs.sizes_label
  }
  for (const [k, v] of Object.entries(pairs)) {
    if (!spec[k]) spec[k] = v
  }
  if (bodySpecs.article_no && !spec['货号'] && !spec['Mã hàng']) spec['货号'] = bodySpecs.article_no
  if (bodySpecs.sizes_label.length && !spec['尺码'] && !spec['Kích cỡ']) spec['尺码'] = bodySpecs.sizes_label.join(',')
  if (bodySpecs.colors_label.length && !spec['颜色'] && !spec['Màu sắc']) spec['颜色'] = bodySpecs.colors_label.join('、')

  const style = viSpecValue(pairs, 'Phong cách', '风格')
  const occasion = viSpecValue(pairs, 'Các tình huống sử dụng', 'Tình huống sử dụng')
  const material = viSpecValue(pairs, 'Chất liệu mặt giày', 'Chất liệu', '材质成分', '材质')
  const upper = viSpecValue(pairs, 'Chất liệu mặt giày')
  const lining = viSpecValue(pairs, 'Chất liệu lót giày', 'Chất liệu bên trong')
  const outsole = viSpecValue(pairs, 'Chất liệu đế giày')
  const featuresRaw = viSpecValue(pairs, 'Chức năng')
  const weight = viSpecValue(pairs, 'Trọng lượng', '重量') || String(spec.weight_note_vi || '').trim()

  fillIfEmpty(spec, 'style', style)
  fillIfEmpty(spec, 'occasion', occasion)
  fillIfEmpty(spec, 'upper_material', upper || material)
  fillIfEmpty(spec, 'lining_material', lining)
  fillIfEmpty(spec, 'outsole_material', outsole)
  fillIfEmpty(productData, 'style', style)
  fillIfEmpty(productData, 'occasion', occasion)
  fillIfEmpty(productData, 'material', material)
  if (!String(productData.weight || '').trim() && weight && !hasCjk(weight)) {
    productData.weight = weight.slice(0, 80)
  }
  const existingFeatures = Array.isArray(productData.features) ? productData.features : []
  if (featuresRaw && existingFeatures.length === 0) {
    productData.features = splitSpecList(featuresRaw).slice(0, 20)
  }

  const specLines = Object.entries(pairs).map(([k, v]) => `${k}: ${v}`)
  if (specLines.length) {
    spec.supplier_specs_excerpt = [String(spec.supplier_specs_excerpt || '').trim(), ...specLines]
      .filter(Boolean)
      .join('\n')
      .slice(0, 4000)
    spec.vipomall_info_texts = specLines.slice(0, 80)
    const desc = String(productData.description || '')
    const block = `--- Thông số ---\n${specLines.slice(0, 60).join('\n')}`
    if (!/货号\s*[:：]/.test(desc) && !/材质成分/.test(desc) && !/Mã hàng\s*[:：]/.test(desc)) {
      const base = desc.replace(/\n*--- Thông số ---\n[\s\S]*$/, '').trim()
      productData.description = (base ? `${base}\n\n${block}` : block).slice(0, 20000)
    }
  }

  pi.product_info = inner
  pi.specifications = spec
  productData.product_info = pi
}

export function reapplyListingLocaleOverlay(
  productData: Record<string, unknown>,
  overlay: Record<string, unknown> | null | undefined
): void {
  if (!overlay) return
  for (const key of ['shop_name_chinese', 'chinese_name'] as const) {
    const val = String(overlay[key] || '').trim()
    if (val) productData[key] = val
  }
}
