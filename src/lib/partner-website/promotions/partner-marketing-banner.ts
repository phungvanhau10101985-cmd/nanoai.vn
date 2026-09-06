import {
  partnerSiteKhoSalePath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

export const PARTNER_MARKETING_BANNER_KINDS = ['sale', 'birthday', 'warehouse', 'regular'] as const
export type PartnerMarketingBannerKind = (typeof PARTNER_MARKETING_BANNER_KINDS)[number]

export const PARTNER_MARKETING_BANNER_SLIDE_ORDER = [
  'birthday',
  'sale',
  'warehouse',
  'regular',
] as const

export const PARTNER_MARKETING_BANNER_ASPECT = '21:9'
export const PARTNER_MARKETING_BANNER_CREDIT_COST = 1.5
export const PARTNER_MARKETING_BANNER_WAREHOUSE_DATE_KEY = 'kho'
export const PARTNER_MARKETING_BANNER_REGULAR_DATE_KEY = 'always'
export const PARTNER_MARKETING_BANNER_CAROUSEL_MS = 6500

export function isPartnerMarketingBannerKind(value: string): value is PartnerMarketingBannerKind {
  return (PARTNER_MARKETING_BANNER_KINDS as readonly string[]).includes(value)
}

export function mapPartnerMarketingBannerKind(value: unknown): PartnerMarketingBannerKind {
  const raw = String(value ?? '')
  return isPartnerMarketingBannerKind(raw) ? raw : 'sale'
}

export function partnerMarketingBannerPctKey(value: number): string {
  const normalized = `${Number(value).toFixed(2)}`.replace(/\.?0+$/, '')
  return normalized.replace('.', '_')
}

export function partnerMarketingBannerCampaignKey(
  kind: PartnerMarketingBannerKind,
  day: number,
  month: number,
  discountPercent: number
): string {
  if (kind === 'warehouse') return `warehouse-p${partnerMarketingBannerPctKey(discountPercent)}`
  if (kind === 'regular') return `regular-${partnerMarketingBannerPctKey(discountPercent)}`
  return `${kind}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-p${partnerMarketingBannerPctKey(discountPercent)}`
}

export function newPartnerMarketingBannerRegularCampaignKey(): string {
  return `regular-${crypto.randomUUID()}`
}

export function partnerMarketingBannerDateKey(day: number, month: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function partnerMarketingBannerDateKeyForKind(
  kind: PartnerMarketingBannerKind,
  day: number,
  month: number
): string {
  if (kind === 'warehouse') return PARTNER_MARKETING_BANNER_WAREHOUSE_DATE_KEY
  if (kind === 'regular') return PARTNER_MARKETING_BANNER_REGULAR_DATE_KEY
  return partnerMarketingBannerDateKey(day, month)
}

export function partnerMarketingBannerPublicHref(kind: PartnerMarketingBannerKind, siteSlug: string): string {
  return kind === 'warehouse' ? partnerSiteKhoSalePath(siteSlug) : partnerSiteProductsPath(siteSlug)
}

/** CMSN slide is only for logged-in shop accounts (guest account or linked user). */
export function partnerMarketingBannerVisitorCanSeeBirthday(input: {
  linkedUserId?: string | null
  guestAccountId?: string | null
}): boolean {
  return Boolean(String(input.linkedUserId ?? '').trim() || String(input.guestAccountId ?? '').trim())
}

export function parsePartnerMarketingBannerDateKey(raw: string): { day: number; month: number } | null {
  const match = /^(\d{2})-(\d{2})$/.exec(raw.trim())
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  if (!isValidPartnerMarketingBannerDayMonth(day, month)) return null
  return { day, month }
}

/** Accepts Feb 29 (leap-year probe). Rejects overflow like 31/02. */
export function isValidPartnerMarketingBannerDayMonth(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const probe = new Date(2000, month - 1, day)
  return probe.getFullYear() === 2000 && probe.getMonth() === month - 1 && probe.getDate() === day
}

/** Widget attr → API/DB kind. `promo` is the shared slider host, not a DB kind. */
export function personalizeBannerToApiKind(
  attr: string | null | undefined
): PartnerMarketingBannerKind | null {
  if (attr === 'birthday') return 'birthday'
  if (attr === 'sale-calendar' || attr === 'sale') return 'sale'
  if (attr === 'warehouse') return 'warehouse'
  if (attr === 'regular') return 'regular'
  return null
}

export function isPartnerMarketingPromoHostAttr(attr: string | null | undefined): boolean {
  const value = String(attr ?? '').trim()
  return (
    value === 'promo' ||
    value === 'birthday' ||
    value === 'sale-calendar' ||
    value === 'sale' ||
    value === 'warehouse' ||
    value === 'regular'
  )
}

export function displayPartnerMarketingBannerPct(value: number): string {
  return `${Number(value)}%`.replace(/\.0%$/, '%')
}

export type PartnerMarketingBannerCopy = {
  verse: string
  cta: string
  art_direction: string
}

export type PartnerMarketingBannerBrand = {
  shopName: string
  industryKey: 'fashion' | 'hotel' | 'food' | 'other' | null
  primaryColor: string
  accentColor: string
  buyButtonColor: string
  logoUrl: string | null
}

function fallbackCopy(
  kind: PartnerMarketingBannerKind,
  day: number,
  month: number,
  version: number
): PartnerMarketingBannerCopy {
  const saleOptions: PartnerMarketingBannerCopy[] = [
    { verse: 'Ngày đôi ưu đãi - chốt ngay kẻo lỡ', cta: 'SĂN DEAL NGAY', art_direction: 'năng lượng tốc độ, ánh sáng chuyển động' },
    { verse: 'Giá hời đúng hẹn - mua liền hôm nay', cta: `CHỐT DEAL ${day}.${month}`, art_direction: 'sân khấu hiện đại, tương phản mạnh' },
    { verse: 'Một ngày giá tốt - bỏ lỡ tiếc lâu', cta: 'MUA NGAY HÔM NAY', art_direction: 'premium editorial, sản phẩm nổi bật' },
  ]
  const birthdayOptions: PartnerMarketingBannerCopy[] = [
    { verse: 'Tuổi mới an vui - quà riêng trao tay', cta: 'NHẬN QUÀ CỦA TÔI', art_direction: 'ấm áp sang trọng, quà tặng tinh tế' },
    { verse: 'Ngày vui rạng rỡ - quà chờ bạn mở', cta: 'MỞ QUÀ SINH NHẬT', art_direction: 'lễ hội thanh lịch, confetti tối giản' },
    { verse: 'Thêm tuổi thêm duyên - nhận liền quà riêng', cta: 'NHẬN QUÀ NGAY', art_direction: 'mềm mại cao cấp, ánh sáng studio' },
  ]
  const warehouseOptions: PartnerMarketingBannerCopy[] = [
    { verse: 'Hàng kho giá sốc - chốt liền hôm nay', cta: 'SĂN HÀNG KHO', art_direction: 'lửa nóng cháy hàng, ánh sáng bùng nổ' },
    { verse: 'Thanh lý gấp - deal lớn trao tay', cta: 'MUA NGAY HÔM NAY', art_direction: 'kho hàng rực lửa, sản phẩm phát sáng' },
    { verse: 'Kho xả giá mạnh - bỏ lỡ tiếc lâu', cta: 'VÀO KHO SALE', art_direction: 'sân khấu cam đỏ, tương phản cực mạnh' },
  ]
  const regularOptions: PartnerMarketingBannerCopy[] = [
    { verse: 'Hàng mới về shop - chọn ngay hôm nay', cta: 'XEM SHOP NGAY', art_direction: 'editorial sạch, sản phẩm nổi bật' },
    { verse: 'Phong cách mới - diện liền đừng chờ', cta: 'MUA NGAY', art_direction: 'studio sang, ánh sáng mềm' },
    { verse: 'Bộ sưu tập đang chờ - vào xem liền', cta: 'KHÁM PHÁ NGAY', art_direction: 'lifestyle hiện đại, tương phản rõ' },
  ]
  const options =
    kind === 'birthday'
      ? birthdayOptions
      : kind === 'warehouse'
        ? warehouseOptions
        : kind === 'regular'
          ? regularOptions
          : saleOptions
  return options[(day + month + version) % options.length]!
}

export function fallbackPartnerMarketingBannerCopy(input: {
  kind: PartnerMarketingBannerKind
  day: number
  month: number
  version: number
}): PartnerMarketingBannerCopy {
  return fallbackCopy(input.kind, input.day, input.month, input.version)
}

function industryArtHint(industryKey: PartnerMarketingBannerBrand['industryKey']): string {
  if (industryKey === 'hotel') return 'phòng nghỉ, kỳ nghỉ, không gian hospitality cao cấp'
  if (industryKey === 'food') return 'món ăn, bàn tiệc, nguyên liệu tươi'
  if (industryKey === 'other') return 'sản phẩm cửa hàng, đời sống hiện đại'
  return 'thời trang, giày dép, phụ kiện hiện đại'
}

export function buildPartnerMarketingBannerPrompt(input: {
  kind: PartnerMarketingBannerKind
  day: number
  month: number
  discountPercent: number
  brand: PartnerMarketingBannerBrand
  copy?: PartnerMarketingBannerCopy | null
}): string {
  const label = `${String(input.day).padStart(2, '0')}/${String(input.month).padStart(2, '0')}`
  const pct = displayPartnerMarketingBannerPct(input.discountPercent)
  const dynamic = input.copy ?? fallbackCopy(input.kind, input.day, input.month, 1)
  const shop = input.brand.shopName.trim() || 'Shop'
  const shared = [
    'Tạo đúng MỘT banner thương mại điện tử siêu rộng 21:9, chất lượng 2K,',
    'dùng nguyên ảnh trên desktop lẫn mobile, không crop. Phong cách cao cấp,',
    'ấn tượng, chuyển đổi cao.',
    `Màu thương hiệu: primary ${input.brand.primaryColor}, accent ${input.brand.accentColor}, nút ${input.brand.buyButtonColor}.`,
    `Logo chữ tên shop rõ ràng: ${shop}. Chữ tiếng Việt phải lớn, ít, đúng chính tả,`,
    'độ tương phản cao; không thêm mức giảm khác. Không dùng watermark hoặc logo hãng khác.',
    `Chủ đề hình: ${industryArtHint(input.brand.industryKey)}.`,
  ].join(' ')

  if (input.kind === 'sale') {
    return (
      shared +
      ` Bắt buộc ghi nguyên văn: "SALE ${input.day}.${input.month} - GIẢM ${pct}".` +
      ` Ghi nguyên văn câu sáng tác mới: "${dynamic.verse}".` +
      ` CTA dạng nút ghi nguyên văn: "${dynamic.cta}".` +
      ` Định hướng mỹ thuật riêng cho phiên bản này: ${dynamic.art_direction}.` +
      ' Tạo cảm giác khẩn cấp. Đặt toàn bộ chữ quan trọng ở giữa ảnh và đủ lớn để đọc trên điện thoại.'
    )
  }
  if (input.kind === 'warehouse') {
    return (
      shared +
      ` Bắt buộc ghi nguyên văn: "SALE KHO - GIẢM ${pct}".` +
      ` Ghi nguyên văn câu sáng tác mới: "${dynamic.verse}".` +
      ` CTA dạng nút ghi nguyên văn: "${dynamic.cta}".` +
      ` Định hướng mỹ thuật riêng cho phiên bản này: ${dynamic.art_direction}.` +
      ' Banner sale kho phải cực ấn tượng, chuyển đổi cao. Không ghi ngày tháng.' +
      ' Đặt toàn bộ chữ quan trọng ở giữa ảnh và đủ lớn để đọc trên điện thoại.'
    )
  }
  if (input.kind === 'regular') {
    return (
      shared +
      ` Banner cửa hàng thường — không ghi ngày sale, không ghi % giảm, không ghi SALE KHO hay MỪNG SINH NHẬT.` +
      ` Ghi nguyên văn câu sáng tác mới: "${dynamic.verse}".` +
      ` CTA dạng nút ghi nguyên văn: "${dynamic.cta}".` +
      ` Định hướng mỹ thuật riêng cho phiên bản này: ${dynamic.art_direction}.` +
      ' Đặt toàn bộ chữ quan trọng ở giữa ảnh và đủ lớn để đọc trên điện thoại.'
    )
  }
  return (
    shared +
    ` Bắt buộc ghi nguyên văn: "MỪNG SINH NHẬT ${label} - TẶNG ${pct}".` +
    ` Ghi nguyên văn câu thơ mới: "${dynamic.verse}".` +
    ` CTA dạng nút ghi nguyên văn: "${dynamic.cta}".` +
    ` Định hướng mỹ thuật riêng cho phiên bản này: ${dynamic.art_direction}.` +
    ' Không ghi tên khách và không ghi năm sinh. Trang trí quà tặng, bánh sinh nhật,' +
    ' confetti vừa đủ, sang trọng và ấm áp. Đặt toàn bộ chữ quan trọng ở giữa ảnh và đủ lớn để đọc trên điện thoại.'
  )
}

export function partnerMarketingBannerAlt(
  locale: string,
  item: { kind: PartnerMarketingBannerKind; date_key: string; discount_percent: number }
): string {
  const pct = displayPartnerMarketingBannerPct(item.discount_percent)
  if (item.kind === 'birthday') {
    if (locale === 'en') return `Birthday banner ${item.date_key}, gift ${pct}`
    if (locale === 'zh') return `生日横幅 ${item.date_key}，赠 ${pct}`
    if (locale === 'ja') return `誕生日バナー ${item.date_key}、${pct} プレゼント`
    if (locale === 'ko') return `생일 배너 ${item.date_key}, ${pct} 선물`
    return `Banner mừng sinh nhật ${item.date_key}, tặng ${pct}`
  }
  if (item.kind === 'warehouse') {
    if (locale === 'en') return `Warehouse sale banner, ${pct} off`
    if (locale === 'zh') return `清仓横幅，减 ${pct}`
    if (locale === 'ja') return `倉庫セールバナー、${pct} オフ`
    if (locale === 'ko') return `창고 세일 배너, ${pct} 할인`
    return `Banner sale kho, giảm ${pct}`
  }
  if (item.kind === 'regular') {
    if (locale === 'en') return 'Shop banner'
    if (locale === 'zh') return '店铺横幅'
    if (locale === 'ja') return 'ショップバナー'
    if (locale === 'ko') return '쇼핑몰 배너'
    return 'Banner cửa hàng'
  }
  if (locale === 'en') return `Sale banner ${item.date_key}, ${pct} off`
  if (locale === 'zh') return `促销横幅 ${item.date_key}，减 ${pct}`
  if (locale === 'ja') return `セールバナー ${item.date_key}、${pct} オフ`
  if (locale === 'ko') return `세일 배너 ${item.date_key}, ${pct} 할인`
  return `Banner sale ${item.date_key}, giảm ${pct}`
}

export function partnerMarketingBannerGreeting(locale: string, displayName: string): string {
  const name = displayName.trim() || (locale === 'vi' ? 'Quý khách' : 'you')
  if (locale === 'en') return `A birthday gift just for ${name}`
  if (locale === 'zh') return `专属生日礼物给 ${name}`
  if (locale === 'ja') return `${name} さんへの誕生日ギフト`
  if (locale === 'ko') return `${name} 님을 위한 생일 선물`
  return `Món quà sinh nhật dành riêng cho ${name}`
}

export type PartnerMarketingBannerPublicItem = {
  id: string
  kind: PartnerMarketingBannerKind
  campaign_key: string
  date_key: string
  discount_percent: number
  image_url: string
  aspect_ratio: string
  event_date: string | null
  greeting: string | null
  version: number
  href: string
  is_test?: boolean
  event_label?: string | null
}

export function composePartnerMarketingBannerSlides(parts: {
  birthday?: PartnerMarketingBannerPublicItem | null
  sale?: PartnerMarketingBannerPublicItem | null
  warehouse?: PartnerMarketingBannerPublicItem | null
  regulars?: PartnerMarketingBannerPublicItem[]
}): PartnerMarketingBannerPublicItem[] {
  return [parts.birthday, parts.sale, parts.warehouse, ...(parts.regulars ?? [])].filter(
    (item): item is PartnerMarketingBannerPublicItem => Boolean(item)
  )
}

export type PartnerMarketingBannerAdminItem = {
  id: string
  kind: PartnerMarketingBannerKind
  campaign_key: string
  date_key: string
  discount_percent: number
  image_url: string | null
  aspect_ratio: string
  image_width: number | null
  image_height: number | null
  prompt: string
  provider: string
  model: string
  status: 'generating' | 'ready' | 'failed'
  error_message: string | null
  version: number
  is_active: boolean
  source: 'ai' | 'upload'
  generated_at: string | null
  created_at: string
}
