import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { getDictionary, type NavGroupKey } from '@/lib/i18n/dictionaries'
import { AI_TOOLS, NAV_GROUPS } from '@/lib/nav-config'
import { rewriteLegacyBunnyCdnUrl } from '@/lib/bunny-cdn-url'
import imageOverridesRaw from '@/lib/catalog/nanoai-catalog-feature-image-overrides.json'
import { toNanoAiFeatureCatalogIdFromHref } from '@/lib/catalog/nanoai-feature-catalog-id'

export type NanoAiFacebookCatalogItem = {
  id: string
  title: string
  description: string
  availability: 'in stock' | 'out of stock'
  condition: 'new'
  priceVnd: number
  linkPath: string
  imagePath: string
  brand: string
}

const DEFAULT_FEATURE_PRICE_VND = CREDIT_UNIT_PRICE_VND
const WALLET_TOPUP_ITEM_ID = 'feature_wallet_topup'
const TOOL_ICON_FALLBACK = '/tool-icons/meeting-recorder-report.png'
const IMAGE_OVERRIDES: Record<string, string> =
  imageOverridesRaw && typeof imageOverridesRaw === 'object'
    ? (imageOverridesRaw as Record<string, string>)
    : {}

function stableHashToken(input: string): string {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h.toString(36)
}

const TOOL_IMAGE_BY_HREF: Record<string, string> = {
  '/thu-do-online': '/tool-icons/try-on.webp',
  '/tao-giao-trinh': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776510865296.png',
  '/giao-trinh': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776510865296.png',
  '/tao-bai-thi': TOOL_ICON_FALLBACK,
  '/tao-bai-tap-ve-nha': TOOL_ICON_FALLBACK,
  '/lop': TOOL_ICON_FALLBACK,
  '/hoc-tieng-anh-ai': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776511328378.png',
  '/ghi-am-bao-cao-cuoc-hop': '/tool-icons/meeting-recorder-report.png',
  '/tao-infographic-tu-sach': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776512000095.png',
  '/ke-chuyen-bang-hinh-anh': '/tool-icons/ke-chuyen-bang-hinh-anh.webp',
  '/dich-anh-tai-lieu': '/tool-icons/dich-anh-tai-lieu.webp',
  '/phuc-dung-anh': '/tool-icons/image-restoration.webp',
  '/lam-net-anh': '/tool-icons/lam-net-anh.webp',
  '/lam-dep-anh': '/tool-icons/lam-dep-anh.webp',
  '/ghep-anh': '/tool-icons/ghep-anh.webp',
  '/tao-banner': '/tool-icons/tao-banner.webp',
  '/tao-thiep-moi-cuoi-ai':
    'https://cdn.nanoai.vn/results/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/sticker_1783938451941.png',
  '/tao-anh-tu-chu': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776512163374.png',
  '/du-anh-tu-phac-thao': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776512234653.png',
  '/tao-anh-the': '/tool-icons/tao-anh-the.webp',
  '/thiet-ke-logo': '/tool-icons/thiet-ke-logo.webp',
  '/tao-nhan-gian': '/tool-icons/tao-nhan-gian.webp',
  '/tao-nhan-gioi-thieu-san-pham': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776515779086.png',
  '/tao-tem-niem-phong-bao-hanh': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776512734065.png',
  '/thiet-ke-con-dau': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776512838425.png',
  '/thiet-ke-bao-bi': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776514062010.png',
  '/tao-ma-vach': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776514184037.png',
  '/che-anh': '/tool-icons/che-anh.webp',
  '/xoa-vat-the': '/tool-icons/xoa-vat-the.webp',
  '/xoa-nen-png': '/tool-icons/xoa-nen-png.webp',
  '/thay-nen-san-pham': '/tool-icons/thay-nen-san-pham.webp',
  '/sua-anh-theo-yeu-cau': TOOL_ICON_FALLBACK,
  '/tao-anh-3d': '/tool-icons/tao-anh-3d.webp',
  '/tao-mo-hinh-3d-tu-anh': '/tool-icons/tao-mo-hinh-3d-tu-anh.webp',
  '/thiet-ke-noi-ngoai-that': '/tool-icons/thiet-ke-noi-ngoai-that.webp',
  '/xay-nha-tu-dat-nen': '/tool-icons/xay-nha-tu-dat-nen.webp',
  '/tao-anh-chain-dung': '/tool-icons/tao-anh-chain-dung.webp',
  '/mo-rong-khung-hinh': '/tool-icons/mo-rong-khung-hinh.webp',
  '/hoan-doi-khuon-mat': '/tool-icons/hoan-doi-khuon-mat.webp',
  '/tao-bai-hat-lyria-3': 'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776514289804.png',
}

const FRIENDLY_FEATURE_TITLE_BY_HREF: Record<string, string> = {
  '/thu-do-online': 'Thử đồ ảo AI',
  '/tao-giao-trinh': 'Tạo giáo trình AI',
  '/giao-trinh': 'Quản lý giáo trình',
  '/tao-bai-thi': 'Tạo đề thi online',
  '/tao-bai-tap-ve-nha': 'Tạo bài tập về nhà',
  '/lop': 'Quản lý lớp học',
  '/hoc-tieng-anh-ai': 'Học tiếng Anh với AI',
  '/ghi-am-bao-cao-cuoc-hop': 'Ghi âm & tóm tắt cuộc họp',
  '/tao-infographic-tu-sach': 'Tạo infographic từ tài liệu',
  '/ke-chuyen-bang-hinh-anh': 'Kể chuyện bằng hình ảnh',
  '/dich-anh-tai-lieu': 'Dịch ảnh tài liệu',
  '/phuc-dung-anh': 'Phục dựng ảnh cũ',
  '/lam-net-anh': 'Làm nét ảnh mờ',
  '/lam-dep-anh': 'Làm đẹp ảnh chân dung',
  '/ghep-anh': 'Ghép nhiều ảnh',
  '/tao-banner': 'Thiết kế banner',
  '/tao-anh-tu-chu': 'Tạo ảnh từ mô tả',
  '/du-anh-tu-phac-thao': 'Dựng ảnh từ phác thảo',
  '/tao-anh-the': 'Tạo ảnh thẻ chuẩn',
  '/thiet-ke-logo': 'Thiết kế logo',
  '/tao-nhan-gian': 'Tạo sticker nhãn dán',
  '/tao-nhan-gioi-thieu-san-pham': 'Tạo nhãn giới thiệu sản phẩm',
  '/tao-tem-niem-phong-bao-hanh': 'Tạo tem niêm phong & bảo hành',
  '/thiet-ke-con-dau': 'Thiết kế con dấu',
  '/thiet-ke-bao-bi': 'Thiết kế bao bì',
  '/tao-ma-vach': 'Tạo mã vạch & QR',
  '/che-anh': 'Tạo meme',
  '/xoa-vat-the': 'Xóa vật thể khỏi ảnh',
  '/xoa-nen-png': 'Xóa nền ảnh PNG',
  '/thay-nen-san-pham': 'Thay nền sản phẩm',
  '/sua-anh-theo-yeu-cau': 'Sửa ảnh theo yêu cầu',
  '/tao-anh-3d': 'Tạo ảnh sản phẩm 3D',
  '/tao-mo-hinh-3d-tu-anh': 'Tạo mô hình 3D từ ảnh',
  '/thiet-ke-noi-ngoai-that': 'Thiết kế nội & ngoại thất',
  '/xay-nha-tu-dat-nen': 'Kiểu nhà bạn muốn xây',
  '/tao-anh-chain-dung': 'Tạo ảnh chân dung AI',
  '/mo-rong-khung-hinh': 'Mở rộng khung hình',
  '/hoan-doi-khuon-mat': 'Hoán đổi khuôn mặt',
  '/tao-bai-hat-lyria-3': 'Tạo bài hát AI',
}

const IMAGE_LINK_VERSION_TOKEN = stableHashToken(
  [
    ...Object.entries(IMAGE_OVERRIDES)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`),
    ...Object.entries(TOOL_IMAGE_BY_HREF)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`),
  ].join('|')
)

function normalizeToolImagePath(path: string): string {
  const p = String(path || '').trim()
  if (!p) return TOOL_ICON_FALLBACK
  if (/^\/tool-icons\/.+\.webp$/i.test(p)) return p.replace(/\.webp$/i, '-full.webp')
  return p
}

function pickImagePathForToolHref(href: string): string {
  const raw = normalizeToolImagePath(IMAGE_OVERRIDES[href] || TOOL_IMAGE_BY_HREF[href] || TOOL_ICON_FALLBACK)
  return rewriteLegacyBunnyCdnUrl(raw)
}

function buildGroupByHrefMap(): Map<string, NavGroupKey> {
  const out = new Map<string, NavGroupKey>()
  for (const group of NAV_GROUPS) {
    for (const link of group.links) {
      if (!out.has(link.href)) out.set(link.href, group.titleKey)
      if (link.subLinks) {
        for (const sub of link.subLinks) {
          if (!out.has(sub.href)) out.set(sub.href, group.titleKey)
        }
      }
    }
  }
  return out
}

export function listNanoAiFacebookCatalogItems(): NanoAiFacebookCatalogItem[] {
  const dict = getDictionary('vi')
  const groupByHref = buildGroupByHrefMap()
  const seen = new Set<string>()
  const items: NanoAiFacebookCatalogItem[] = []

  for (const tool of AI_TOOLS) {
    const href = tool.href
    if (!href || seen.has(href)) continue
    seen.add(href)
    const title = FRIENDLY_FEATURE_TITLE_BY_HREF[href] || dict.tool[tool.labelKey] || tool.labelKey
    const groupLabelKey = groupByHref.get(href)
    const groupName = groupLabelKey ? (dict.navGroup[groupLabelKey] || '') : ''
    const description = groupName
      ? `${title} — công cụ AI trên NanoAI, thuộc nhóm ${groupName}.`
      : `${title} — công cụ AI trên NanoAI.`

    items.push({
      id: toNanoAiFeatureCatalogIdFromHref(href),
      title,
      description,
      availability: 'in stock',
      condition: 'new',
      priceVnd: DEFAULT_FEATURE_PRICE_VND,
      linkPath: href,
      imagePath: pickImagePathForToolHref(href),
      brand: 'NanoAI',
    })
  }

  items.push({
    id: WALLET_TOPUP_ITEM_ID,
    title: 'Nạp credit',
    description: 'Nạp credit để sử dụng toàn bộ tính năng AI của NanoAI.',
    availability: 'in stock',
    condition: 'new',
    priceVnd: DEFAULT_FEATURE_PRICE_VND,
    linkPath: '/wallet',
    imagePath: TOOL_ICON_FALLBACK,
    brand: 'NanoAI',
  })

  return items
}

function csvEscapeCell(value: string): string {
  const s = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toAbsoluteUrl(origin: string, path: string): string {
  const absolute = String(path || '').trim()
  const rewritten = rewriteLegacyBunnyCdnUrl(absolute)
  if (/^https?:\/\//i.test(rewritten)) return rewritten
  const base = origin.replace(/\/$/, '')
  const p = rewritten.startsWith('/') ? rewritten : `/${rewritten}`
  return `${base}${p}`
}

function withVersionQuery(url: string, token: string): string {
  const t = String(token || '').trim()
  if (!t) return url
  try {
    const u = new URL(url)
    u.searchParams.set('v', t)
    return u.toString()
  } catch {
    return url
  }
}

function formatPriceVnd(v: number): string {
  return `${Math.max(0, Math.round(v))} VND`
}

export function buildNanoAiFacebookCatalogFeedCsv(origin: string): Buffer {
  const headers = [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
  ]
  const rows = listNanoAiFacebookCatalogItems().map((item) => [
    item.id,
    item.title,
    item.description,
    item.availability,
    item.condition,
    formatPriceVnd(item.priceVnd),
    toAbsoluteUrl(origin, item.linkPath),
    withVersionQuery(toAbsoluteUrl(origin, item.imagePath), IMAGE_LINK_VERSION_TOKEN),
    item.brand,
  ])
  const csv = [headers, ...rows]
    .map((line) => line.map((cell) => csvEscapeCell(String(cell))).join(','))
    .join('\r\n')
  return Buffer.from(`\ufeff${csv}\r\n`, 'utf8')
}

export function getNanoAiCatalogVersionToken(): string {
  return IMAGE_LINK_VERSION_TOKEN
}

export function resolveNanoAiCreditCatalogItem(input: {
  amountVnd: number
  creditsAdded: number
}): NanoAiFacebookCatalogItem {
  void input
  const items = listNanoAiFacebookCatalogItems()
  return items.find((x) => x.id === WALLET_TOPUP_ITEM_ID) ?? items[0]
}

export function buildNanoAiCreditMetaCustomData(input: {
  amountVnd: number
  creditsAdded: number
}): Record<string, string | number | boolean | Array<string | number | boolean>> {
  const item = resolveNanoAiCreditCatalogItem(input)
  const amount = Math.max(0, Math.round(Number(input.amountVnd) || 0))
  const credits = Math.max(0, Math.round(Number(input.creditsAdded) || 0))
  return {
    currency: 'VND',
    value: amount,
    credits_added: credits,
    content_name: 'NanoAI credits top-up',
    content_category: 'credits',
    content_type: 'product',
    content_ids: [item.id],
    num_items: 1,
  }
}
