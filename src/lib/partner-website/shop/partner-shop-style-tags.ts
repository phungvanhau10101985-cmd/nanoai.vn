/**
 * Bộ lọc «Kiểu» listing — cùng alias / tag chuẩn 188 `style_tag`.
 * Dropdown hiện nhãn tiếng Việt (Váy, Sneaker…), không phải cột Style thô.
 */

export const PARTNER_STYLE_TAG_ALIASES: Record<string, readonly string[]> = {
  Váy: ['váy', 'đầm', 'dress'],
  'Đuôi cá': ['đuôi cá', 'duoi ca', 'mermaid'],
  Xòe: ['xòe', 'xoe', 'flare', 'flared'],
  'Ôm body': ['body', 'ôm body', 'om body', 'bodycon'],
  Suông: ['suông', 'suong'],
  Maxi: ['maxi'],
  Midi: ['midi'],
  'Hai dây': ['hai dây', '2 dây', 'spaghetti strap'],
  'Cổ V': ['cổ v', 'co v', 'v-neck'],
  'Cổ cao': ['cổ cao', 'co cao', 'turtleneck'],
  'Kẻ caro': ['kẻ caro', 'ke caro', 'caro', 'plaid', 'checkered'],
  'Kẻ sọc': ['kẻ sọc', 'ke soc', 'sọc', 'soc', 'striped'],
  'Hoa nhí': ['hoa nhí', 'hoa nhi', 'floral'],
  'Áo thun': ['áo thun', 'ao thun', 't-shirt', 'tee'],
  'Áo sơ mi': ['áo sơ mi', 'ao so mi', 'shirt'],
  'Áo khoác': ['áo khoác', 'ao khoac', 'jacket'],
  Polo: ['polo'],
  Oversize: ['oversize', 'over size'],
  'Slim fit': ['slim fit'],
  'Quần jeans': ['quần jeans', 'quan jeans', 'jean', 'denim'],
  'Quần short': ['quần short', 'quan short', 'shorts'],
  Jogger: ['jogger'],
  Cargo: ['cargo'],
  'Chân váy': ['chân váy', 'chan vay', 'skirt'],
  'Giày lười': ['giày lười', 'giay luoi', 'loafer', 'slip-on', 'slip on'],
  Sneaker: ['sneaker', 'giày thể thao', 'giay the thao'],
  Sandal: ['sandal', 'xăng đan', 'xang dan'],
  'Cao gót': ['cao gót', 'cao got', 'high heel'],
  Boot: ['boot', 'bốt', 'bốt cổ', 'boot cổ'],
  'Búp bê': ['búp bê', 'bup be', 'mary jane'],
  Oxford: ['oxford'],
  Derby: ['derby'],
  Mule: ['mule', 'sục', 'clog'],
}

export const PARTNER_STYLE_TAG_ORDER: Record<string, number> = Object.fromEntries(
  Object.keys(PARTNER_STYLE_TAG_ALIASES).map((label, idx) => [label, idx])
)

/** Ẩn tag có ít hơn N sản phẩm trong tập facet hiện tại — giống 188. */
export const MIN_STYLE_TAG_FACET_PRODUCTS = 3

const APPAREL_ONLY_STYLE_TAGS = new Set([
  'Váy',
  'Đuôi cá',
  'Xòe',
  'Ôm body',
  'Suông',
  'Maxi',
  'Midi',
  'Hai dây',
  'Cổ V',
  'Kẻ caro',
  'Kẻ sọc',
  'Hoa nhí',
  'Áo thun',
  'Áo sơ mi',
  'Áo khoác',
  'Polo',
  'Oversize',
  'Slim fit',
  'Quần jeans',
  'Quần short',
  'Jogger',
  'Cargo',
  'Chân váy',
])

export const FOOTWEAR_STYLE_TAGS = new Set(
  Object.keys(PARTNER_STYLE_TAG_ALIASES).filter((label) => !APPAREL_ONLY_STYLE_TAGS.has(label))
)
export const FASHION_STYLE_TAGS = new Set([...APPAREL_ONLY_STYLE_TAGS, 'Cổ cao'])

export const FOOTWEAR_CATEGORY_L1_NAMES = new Set(['Giày dép Nam', 'Giày dép Nữ'])
export const FASHION_CATEGORY_L1_NAMES = new Set(['Thời trang Nam', 'Thời trang Nữ', 'Thời trang trẻ em'])

export function foldStyleTagText(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function textForStyleTags(values: unknown[]): string {
  const parts: string[] = []
  for (const value of values) {
    if (value == null) continue
    if (typeof value === 'object') {
      try {
        parts.push(JSON.stringify(value))
      } catch {
        parts.push(String(value))
      }
    } else {
      const s = String(value).trim()
      if (s) parts.push(s)
    }
  }
  return foldStyleTagText(parts.join(' '))
}

/** Tag kiểu từ tên / style / chất liệu / product_info / đường danh mục — giống 188. */
export function styleTagsFromProductText(...values: unknown[]): Set<string> {
  const text = textForStyleTags(values)
  const out = new Set<string>()
  if (!text) return out
  for (const [label, aliases] of Object.entries(PARTNER_STYLE_TAG_ALIASES)) {
    for (const alias of aliases) {
      const needle = foldStyleTagText(alias)
      if (!needle) continue
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`)
      if (re.test(text)) {
        out.add(label)
        break
      }
    }
  }
  return out
}

export function styleTagFilterAliases(styleTag: string): string[] {
  const label = styleTag.trim()
  if (!label) return []
  const aliases = PARTNER_STYLE_TAG_ALIASES[label]
  return [...(aliases && aliases.length ? aliases : [label])]
}

/** L1 giày → chỉ tag giày; L1 thời trang → chỉ tag quần áo (+ Cổ cao); khác → mọi tag. */
export function allowedStyleTagsForListingL1(l1Name: string): Set<string> | null {
  const name = l1Name.trim()
  if (!name) return null
  if (FOOTWEAR_CATEGORY_L1_NAMES.has(name) || /giày\s*dép/i.test(name)) return FOOTWEAR_STYLE_TAGS
  if (FASHION_CATEGORY_L1_NAMES.has(name) || /thời\s*trang/i.test(name)) return FASHION_STYLE_TAGS
  return null
}

export function sortStyleTagLabels(labels: Iterable<string>): string[] {
  return [...labels].sort((a, b) => {
    const oa = PARTNER_STYLE_TAG_ORDER[a] ?? 999
    const ob = PARTNER_STYLE_TAG_ORDER[b] ?? 999
    return oa - ob || a.localeCompare(b, 'vi')
  })
}

export function styleTagsMeetingMinCount(
  counts: Map<string, number>,
  opts?: { allowed?: Set<string> | null; minCount?: number }
): Array<{ value: string; count: number }> {
  const minCount = opts?.minCount ?? MIN_STYLE_TAG_FACET_PRODUCTS
  const allowed = opts?.allowed
  const labels: string[] = []
  for (const [label, count] of counts) {
    if (count < minCount) continue
    if (allowed && !allowed.has(label)) continue
    labels.push(label)
  }
  return sortStyleTagLabels(labels).map((value) => ({ value, count: counts.get(value) ?? 0 }))
}
