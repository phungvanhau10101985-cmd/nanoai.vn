/**
 * Tab «Thông tin sản phẩm» trên PDP — render cột AK `product_info` giống 188 ProductTabs.
 * Engine dùng chung mọi shop; nhãn theo locale shop.
 */

import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

const SECTION_LABELS: Record<string, string> = {
  thong_tin_san_pham: '1. Thông tin sản phẩm',
  thong_so_ky_thuat: '2. Thông số kỹ thuật',
  phan_loai: '3. Phân loại',
  doi_tuong_khach_hang: '4. Đối tượng khách hàng',
  thong_tin_thi_truong: '5. Thông tin thị trường',
  product_info: '1. Thông tin sản phẩm',
  specifications: '2. Thông số kỹ thuật',
  variants: '3. Phân loại',
  target_audience: '4. Đối tượng khách hàng',
  market_info: '5. Thông tin thị trường',
}

const FIELD_LABELS: Record<string, Record<WebLocale, string>> = {
  sku: { vi: 'Mã hàng (SKU)', en: 'SKU', zh: '货号', ja: 'SKU', ko: 'SKU' },
  name: { vi: 'Tên sản phẩm', en: 'Name', zh: '名称', ja: '商品名', ko: '상품명' },
  name_vi: { vi: 'Tên sản phẩm', en: 'Name', zh: '名称', ja: '商品名', ko: '상품명' },
  display_name: { vi: 'Tên hiển thị', en: 'Display name', zh: '展示名', ja: '表示名', ko: '표시명' },
  display_name_vi: { vi: 'Tên hiển thị', en: 'Display name', zh: '展示名', ja: '表示名', ko: '표시명' },
  target_audience_suggestion_vi: {
    vi: 'Gợi ý tư vấn',
    en: 'Stylist note',
    zh: '搭配建议',
    ja: 'スタイリストメモ',
    ko: '스타일 노트',
  },
  target_audience_suggestion: {
    vi: 'Gợi ý tư vấn',
    en: 'Stylist note',
    zh: '搭配建议',
    ja: 'スタイリストメモ',
    ko: '스타일 노트',
  },
  brand: { vi: 'Thương hiệu', en: 'Brand', zh: '品牌', ja: 'ブランド', ko: '브랜드' },
  origin: { vi: 'Xuất xứ', en: 'Origin', zh: '产地', ja: '原産地', ko: '원산지' },
  category: { vi: 'Danh mục', en: 'Category', zh: '类目', ja: 'カテゴリ', ko: '카테고리' },
  level_1: { vi: 'Cấp 1', en: 'Level 1', zh: '一级', ja: 'レベル1', ko: '1단계' },
  level_2: { vi: 'Cấp 2', en: 'Level 2', zh: '二级', ja: 'レベル2', ko: '2단계' },
  level_3: { vi: 'Cấp 3', en: 'Level 3', zh: '三级', ja: 'レベル3', ko: '3단계' },
  upper_material: { vi: 'Chất liệu mặt trên', en: 'Upper material', zh: '面料', ja: 'アッパー', ko: '갑피' },
  lining_material: { vi: 'Chất liệu lót trong', en: 'Lining', zh: '内衬', ja: '裏地', ko: '안감' },
  outsole_material: { vi: 'Chất liệu đế ngoài', en: 'Outsole', zh: '外底', ja: 'アウトソール', ko: '밑창' },
  insole_material: { vi: 'Chất liệu lót giày', en: 'Insole', zh: '鞋垫', ja: 'インソール', ko: '안창' },
  construction: { vi: 'Công nghệ đế', en: 'Construction', zh: '工艺', ja: '製法', ko: '제작' },
  toe_shape: { vi: 'Hình dạng mũi', en: 'Toe shape', zh: '鞋头', ja: 'トゥ', ko: '코 모양' },
  heel_height: { vi: 'Chiều cao gót / đế', en: 'Heel / sole height', zh: '跟高', ja: 'ヒール', ko: '굽 높이' },
  weight_grams: { vi: 'Trọng lượng (gram)', en: 'Weight (g)', zh: '重量(克)', ja: '重量(g)', ko: '무게(g)' },
  weight_note_vi: { vi: 'Trọng lượng', en: 'Weight', zh: '重量', ja: '重量', ko: '무게' },
  style: { vi: 'Kiểu dáng', en: 'Style', zh: '款式', ja: 'スタイル', ko: '스타일' },
  occasion: { vi: 'Dịp', en: 'Occasion', zh: '场合', ja: 'シーン', ko: '상황' },
  thong_so_kich_thuoc_vi: { vi: 'Kích thước & form', en: 'Fit & size', zh: '尺码版型', ja: 'サイズ', ko: '핏/사이즈' },
  material_vi: { vi: 'Chất liệu (đầy đủ)', en: 'Material', zh: '材质', ja: '素材', ko: '소재' },
  colors: { vi: 'Màu sắc', en: 'Colors', zh: '颜色', ja: 'カラー', ko: '색상' },
  sizes: { vi: 'Kích cỡ', en: 'Sizes', zh: '尺码', ja: 'サイズ', ko: '사이즈' },
  stock: { vi: 'Tồn kho', en: 'Stock', zh: '库存', ja: '在庫', ko: '재고' },
  season: { vi: 'Mùa', en: 'Season', zh: '季节', ja: 'シーズン', ko: '시즌' },
  lead_time_days: { vi: 'Thời gian chuẩn bị hàng', en: 'Lead time (days)', zh: '备货天数', ja: 'リードタイム', ko: '준비 기간' },
  gender: { vi: 'Giới tính', en: 'Gender', zh: '性别', ja: '性別', ko: '성별' },
  gioi_tinh: { vi: 'Giới tính', en: 'Gender', zh: '性别', ja: '性別', ko: '성별' },
  age_range: { vi: 'Độ tuổi phù hợp', en: 'Age range', zh: '适用年龄', ja: '対象年齢', ko: '연령대' },
  do_tuoi_phu_hop: { vi: 'Độ tuổi phù hợp', en: 'Age range', zh: '适用年龄', ja: '対象年齢', ko: '연령대' },
  wearing_style: { vi: 'Cách mặc', en: 'How to wear', zh: '穿着方式', ja: '着こなし', ko: '착용' },
  features: { vi: 'Tính năng nổi bật', en: 'Features', zh: '卖点', ja: '特徴', ko: '특징' },
  tinh_nang_noi_bat: { vi: 'Tính năng nổi bật', en: 'Features', zh: '卖点', ja: '特徴', ko: '특징' },
  main_sales_regions: { vi: 'Khu vực bán hàng chính', en: 'Main markets', zh: '主要销售地区', ja: '主な販売地域', ko: '주요 판매 지역' },
  export_ready: { vi: 'Xuất khẩu xuyên biên giới', en: 'Export ready', zh: '跨境出口', ja: '輸出対応', ko: '수출 가능' },
  thuong_hieu: { vi: 'Thương hiệu', en: 'Brand', zh: '品牌', ja: 'ブランド', ko: '브랜드' },
  nguon_hang: { vi: 'Nguồn hàng', en: 'Source', zh: '货源', ja: '仕入先', ko: '공급원' },
  danh_muc: { vi: 'Danh mục', en: 'Category', zh: '类目', ja: 'カテゴリ', ko: '카테고리' },
  chat_lieu_mat_tren: { vi: 'Chất liệu mặt trên', en: 'Upper material', zh: '面料', ja: 'アッパー', ko: '갑피' },
  chat_lieu_lot_trong: { vi: 'Chất liệu lót trong', en: 'Lining', zh: '内衬', ja: '裏地', ko: '안감' },
  chat_lieu_de_ngoai: { vi: 'Chất liệu đế ngoài', en: 'Outsole', zh: '外底', ja: 'アウトソール', ko: '밑창' },
  ma_hang: { vi: 'Mã hàng', en: 'SKU', zh: '货号', ja: '品番', ko: '상품코드' },
  ten_san_pham: { vi: 'Tên sản phẩm', en: 'Name', zh: '名称', ja: '商品名', ko: '상품명' },
  phong_cach: { vi: 'Phong cách', en: 'Style', zh: '风格', ja: 'スタイル', ko: '스타일' },
  mua_phu_hop: { vi: 'Mùa phù hợp', en: 'Season', zh: '适合季节', ja: 'シーズン', ko: '시즌' },
  cach_mac: { vi: 'Cách mặc', en: 'How to wear', zh: '穿着方式', ja: '着こなし', ko: '착용' },
  mau_sac: { vi: 'Màu sắc', en: 'Colors', zh: '颜色', ja: 'カラー', ko: '색상' },
  kich_co: { vi: 'Kích cỡ', en: 'Sizes', zh: '尺码', ja: 'サイズ', ko: '사이즈' },
  chat_lieu_lot_giay: { vi: 'Chất liệu lót giày', en: 'Insole', zh: '鞋垫', ja: 'インソール', ko: '안창' },
  cong_nghe_de: { vi: 'Công nghệ đế', en: 'Construction', zh: '工艺', ja: '製法', ko: '제작' },
  hinh_dang_mui: { vi: 'Hình dạng mũi', en: 'Toe shape', zh: '鞋头', ja: 'トゥ', ko: '코 모양' },
  chieu_cao_got: { vi: 'Chiều cao gót', en: 'Heel height', zh: '跟高', ja: 'ヒール', ko: '굽 높이' },
  trong_luong_gram: { vi: 'Trọng lượng (gram)', en: 'Weight (g)', zh: '重量(克)', ja: '重量(g)', ko: '무게(g)' },
  xuat_khau_xuyen_bien_gioi: { vi: 'Xuất khẩu xuyên biên giới', en: 'Export ready', zh: '跨境出口', ja: '輸出対応', ko: '수출 가능' },
  thoi_gian_chuan_bi_hang: { vi: 'Thời gian chuẩn bị hàng', en: 'Lead time', zh: '备货时间', ja: 'リードタイム', ko: '준비 기간' },
  khu_vuc_ban_hang_chinh: { vi: 'Khu vực bán hàng chính', en: 'Main markets', zh: '主要销售地区', ja: '主な販売地域', ko: '주요 판매 지역' },
  price_vnd: { vi: 'Giá tham khảo (VND)', en: 'Reference price (VND)', zh: '参考价(VND)', ja: '参考価格(VND)', ko: '참고가(VND)' },
  price_vnd_display: { vi: 'Giá tham khảo (VND)', en: 'Reference price (VND)', zh: '参考价(VND)', ja: '参考価格(VND)', ko: '참고가(VND)' },
  cap_1: { vi: 'Cấp 1', en: 'Level 1', zh: '一级', ja: 'レベル1', ko: '1단계' },
  cap_2: { vi: 'Cấp 2', en: 'Level 2', zh: '二级', ja: 'レベル2', ko: '2단계' },
  cap_3: { vi: 'Cấp 3', en: 'Level 3', zh: '三级', ja: 'レベル3', ko: '3단계' },
}

const SUPPLIER_RAW_SPEC_KEYS = ['supplier_specs_excerpt', 'hibox_specs_excerpt'] as const
const VARIANT_TECH_KEYS = new Set(['color_swatches', 'pairs', 'source', 'slug'])
const SPEC_WEB_PRIORITY_KEYS = [
  'upper_material',
  'lining_material',
  'outsole_material',
  'heel_height',
  'thong_so_kich_thuoc_vi',
  'weight_note_vi',
  'weight_grams',
  'style',
  'occasion',
]
const VARIANT_DISPLAY_PRIORITY = ['sizes', 'colors']
const PRODUCT_NAME_KEYS = ['display_name_vi', 'display_name', 'name', 'name_vi', 'ten_san_pham']
const CONSULT_SUGGESTION_KEYS = new Set([
  'target_audience_suggestion_vi',
  'target_audience_suggestion',
  'target_audience_suggestion_en',
  'goi_y_tu_van',
  'stylist_note',
  'suggestion_vi',
])
const PRODUCT_INFO_ROOT_KEYS = new Set([
  'product_info',
  'specifications',
  'variants',
  'target_audience',
  'market_info',
  'thong_tin_san_pham',
  'thong_so_ky_thuat',
  'phan_loai',
  'doi_tuong_khach_hang',
  'thong_tin_thi_truong',
])

function looksLikeJsonBlob(raw: string): boolean {
  const t = raw.trim()
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))
}

export function isPdpProductInfoJsonBlob(raw: unknown): boolean {
  const s = String(raw ?? '').trim()
  if (!looksLikeJsonBlob(s)) return false
  const parsed = parsePdpProductInfo(s)
  if (!parsed) return false
  return Object.keys(parsed).some((k) => PRODUCT_INFO_ROOT_KEYS.has(k))
}

function collectConsultSuggestions(val: unknown, out: string[]): void {
  if (val == null) return
  if (Array.isArray(val)) {
    for (const item of val) collectConsultSuggestions(item, out)
    return
  }
  if (typeof val !== 'object') return
  for (const [key, child] of Object.entries(val as Record<string, unknown>)) {
    if (CONSULT_SUGGESTION_KEYS.has(key) && typeof child === 'string' && isDisplayablePdpScalar(child)) {
      out.push(child.trim())
      continue
    }
    if (key === 'target_audience' && typeof child === 'string' && isDisplayablePdpScalar(child)) {
      out.push(child.trim())
      continue
    }
    collectConsultSuggestions(child, out)
  }
}

/** Ô «Gợi ý tư vấn»: text thường giữ nguyên; JSON catalog 188 chỉ lấy câu đối tượng khách. */
export function shopDisplayConsultNote(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s || !isDisplayablePdpScalar(s)) return ''
  if (!looksLikeJsonBlob(s)) return s
  const parsed = parsePdpProductInfo(s)
  if (!parsed) return ''
  const hits: string[] = []
  collectConsultSuggestions(parsed, hits)
  return [...new Set(hits.map((x) => x.trim()).filter(Boolean))].join(' ').trim()
}

function collapseProductInfoNameEntries(entries: [string, unknown][]): [string, unknown][] {
  const nameEntries = entries.filter(([k, v]) => PRODUCT_NAME_KEYS.includes(k) && isDisplayablePdpScalar(v))
  if (nameEntries.length < 2) return entries
  const best = nameEntries
    .map(([k, v]) => [k, displayablePdpText(v)] as const)
    .sort((a, b) => b[1].length - a[1].length)[0]
  if (!best?.[1]) return entries
  return entries
    .filter(([k]) => !PRODUCT_NAME_KEYS.includes(k))
    .concat([['name', best[1]]])
}

export function isDisplayablePdpScalar(val: unknown): boolean {
  if (val === null || val === undefined) return false
  if (typeof val === 'boolean') return true
  if (typeof val === 'number') return Number.isFinite(val) && !Number.isNaN(val)
  if (typeof val === 'string') {
    const t = val.trim()
    if (!t) return false
    const low = t.toLowerCase()
    return low !== 'nan' && low !== 'none' && low !== 'null' && low !== 'undefined'
  }
  return true
}

export function displayablePdpText(val: unknown): string {
  if (!isDisplayablePdpScalar(val)) return ''
  if (typeof val === 'boolean') return val ? '1' : ''
  return String(val).trim()
}

function esc(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatFieldLabel(key: string, locale: WebLocale): string {
  const mapped = FIELD_LABELS[key]?.[locale]
  if (mapped) return mapped
  if ((SUPPLIER_RAW_SPEC_KEYS as readonly string[]).includes(key)) return locale === 'vi' ? 'Thông số gốc (NCC)' : 'Supplier specs'
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatSectionLabel(key: string): string {
  return SECTION_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function orderSpecificationEntries(entries: [string, unknown][]): [string, unknown][] {
  const priority = new Map(SPEC_WEB_PRIORITY_KEYS.map((k, i) => [k, i]))
  const hasViDims = entries.some(([k, v]) => k === 'thong_so_kich_thuoc_vi' && isDisplayablePdpScalar(v))
  let next = entries
  if (hasViDims) {
    next = next.filter(([k]) => !(SUPPLIER_RAW_SPEC_KEYS as readonly string[]).includes(k))
  }
  const rank = (k: string) => {
    if ((SUPPLIER_RAW_SPEC_KEYS as readonly string[]).includes(k)) return 200
    if (priority.has(k)) return priority.get(k)!
    return 50
  }
  return [...next].sort(([a], [b]) => {
    const d = rank(a) - rank(b)
    return d !== 0 ? d : a.localeCompare(b)
  })
}

function orderVariantEntries(entries: [string, unknown][]): [string, unknown][] {
  const pr = new Map(VARIANT_DISPLAY_PRIORITY.map((k, i) => [k, i]))
  return [...entries].sort(([a], [b]) => (pr.get(a) ?? 99) - (pr.get(b) ?? 99))
}

export function parsePdpProductInfo(raw: unknown): Record<string, unknown> | null {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw !== 'string' || !raw.trim()) return null
  let s = raw.trim()
  for (let i = 0; i < 3; i += 1) {
    try {
      const parsed = JSON.parse(s) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
      if (typeof parsed === 'string' && parsed.trim()) {
        s = parsed.trim()
        continue
      }
      break
    } catch {
      break
    }
  }
  return null
}

function formatScalar(val: unknown, t: PartnerSiteShopCopy): string | null {
  if (!isDisplayablePdpScalar(val)) return null
  if (typeof val === 'boolean') return val ? t.pdpYes : t.pdpNo
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return val.trim()
  if (Array.isArray(val)) {
    const parts = val
      .map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)))
      .filter((s) => isDisplayablePdpScalar(s))
    return parts.length ? parts.join(', ') : null
  }
  return null
}

function renderNested(val: unknown, locale: WebLocale, t: PartnerSiteShopCopy): string {
  if (val == null || typeof val !== 'object' || Array.isArray(val)) {
    const s = formatScalar(val, t)
    return s ? esc(s) : ''
  }
  const rows = Object.entries(val as Record<string, unknown>)
    .map(([k, v]) => {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        const inner = renderNested(v, locale, t)
        if (!inner) return ''
        return `<div class="pw-pdp-spec-nested"><span class="pw-pdp-spec-k">${esc(formatFieldLabel(k, locale))}:</span> ${inner}</div>`
      }
      const s = formatScalar(v, t)
      if (!s) return ''
      return `<div class="pw-pdp-spec-nested"><span class="pw-pdp-spec-k">${esc(formatFieldLabel(k, locale))}:</span> ${esc(s)}</div>`
    })
    .filter(Boolean)
    .join('')
  return rows ? `<div class="pw-pdp-spec-tree">${rows}</div>` : ''
}

function specRowHtml(label: string, valueHtml: string): string {
  return `<div class="pw-pdp-spec-row"><span class="pw-pdp-spec-k">${esc(label)}</span><span class="pw-pdp-spec-v">${valueHtml}</span></div>`
}

export type PdpAttrFields = {
  brandName?: string | null
  origin?: string | null
  material?: string | null
  style?: string | null
  occasion?: string | null
  weight?: string | null
  features?: string[] | null
  colorSummary?: string | null
  categoryL1?: string | null
  categoryL2?: string | null
  categoryL3?: string | null
  stockQty?: number | null
}

export function pdpAttrGridHtml(fields: PdpAttrFields, t: PartnerSiteShopCopy): string {
  const rows: Array<[string, string]> = []
  const push = (label: string, raw: unknown) => {
    const v = Array.isArray(raw)
      ? raw.map((x) => String(x || '').trim()).filter(Boolean).join(', ')
      : displayablePdpText(raw)
    if (v) rows.push([label, v])
  }
  push(t.pdpOriginLabel, fields.origin)
  push(t.pdpMaterialLabel, fields.material)
  push(t.pdpStyleLabel, fields.style)
  push(t.pdpBrandLabel, fields.brandName)
  push(t.pdpOccasionLabel, fields.occasion)
  push(t.pdpWeightLabel, fields.weight)
  push(t.pdpFeaturesLabel, fields.features)
  push(t.colorLabel, fields.colorSummary)
  const cats = [fields.categoryL1, fields.categoryL2, fields.categoryL3]
    .map((x) => displayablePdpText(x))
    .filter(Boolean)
  if (cats.length) push(t.pdpCategoryLabel, cats.join(' / '))
  if (!rows.length) return ''
  return `<div class="pw-pdp-attr-grid" data-pw-pdp-slot="attrs">${rows
    .map(([k, v]) => specRowHtml(k, esc(v)))
    .join('')}</div>`
}

export function pdpProductInfoHtml(
  info: Record<string, unknown> | null | undefined,
  locale: WebLocale,
  t: PartnerSiteShopCopy,
  fallback: PdpAttrFields
): string {
  if (info && Object.keys(info).length > 0) {
    const sections = Object.entries(info)
      .map(([sectionKey, sectionVal]) => {
        if (sectionVal == null) return ''
        const title = formatSectionLabel(sectionKey)
        if (typeof sectionVal === 'object' && !Array.isArray(sectionVal)) {
          let entries = Object.entries(sectionVal as Record<string, unknown>)
          if (sectionKey === 'product_info' || sectionKey === 'thong_tin_san_pham') {
            entries = collapseProductInfoNameEntries(entries)
          }
          if (sectionKey === 'variants') {
            entries = entries.filter(([k]) => !VARIANT_TECH_KEYS.has(k))
            entries = orderVariantEntries(entries)
          }
          if (sectionKey === 'specifications') entries = orderSpecificationEntries(entries)
          if (sectionKey === 'market_info') {
            entries = entries.filter(([k, v]) => {
              if (k !== 'note' || typeof v !== 'string') return true
              return !/MNT_PER_CNY/i.test(v)
            })
          }
          const rows = entries
            .map(([key, val]) => {
              if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                const nested = renderNested(val, locale, t)
                if (!nested) return ''
                return `<div class="pw-pdp-spec-block"><div class="pw-pdp-spec-k">${esc(formatFieldLabel(key, locale))}</div>${nested}</div>`
              }
              const s = formatScalar(val, t)
              if (!s) return ''
              return specRowHtml(formatFieldLabel(key, locale), esc(s))
            })
            .filter(Boolean)
            .join('')
          if (!rows) return ''
          return `<div class="pw-pdp-spec-section"><h4>${esc(title)}</h4><div class="pw-pdp-spec-grid">${rows}</div></div>`
        }
        const s = formatScalar(sectionVal, t)
        if (!s) return ''
        return `<div class="pw-pdp-spec-section"><h4>${esc(title)}</h4><div class="pw-pdp-spec-grid">${specRowHtml(title, esc(s))}</div></div>`
      })
      .filter(Boolean)
      .join('')
    if (sections) return `<div data-pw-pdp-slot="specs">${sections}</div>`
  }
  const fallbackGrid = pdpAttrGridHtml(fallback, t)
  if (fallbackGrid) {
    return `<div data-pw-pdp-slot="specs"><p class="pw-shop-muted" style="font-size:12px;margin:0 0 12px">${esc(t.pdpSpecsEmpty)}</p>${fallbackGrid}</div>`
  }
  return `<div data-pw-pdp-slot="specs"><p class="pw-shop-muted" style="font-size:12px;margin:0">${esc(t.pdpSpecsEmpty)}</p></div>`
}

/** Mô tả PDP: HTML catalog (pro_content) hoặc text + xuống dòng. */
export function pdpDescriptionBodyHtml(raw: string): string {
  const t = String(raw || '').trim()
  if (!t || isPdpProductInfoJsonBlob(t)) return ''
  if (!/<[a-z][\s\S]*>/i.test(t)) {
    return t
      .split(/\n{2,}/)
      .map((para) => `<p style="margin:0 0 12px">${esc(para).replace(/\n/g, '<br/>')}</p>`)
      .join('')
  }
  return t
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\b(?:href|src)\s*=\s*(["'])\s*javascript:[^"']*\1/gi, '')
    .replace(/<img\b([^>]*)\/?>/gi, (_full, attrs: string) => {
      let next = attrs
      if (!/\bloading=/.test(next)) next += ' loading="lazy"'
      if (!/\bdecoding=/.test(next)) next += ' decoding="async"'
      return `<img${next}>`
    })
}
